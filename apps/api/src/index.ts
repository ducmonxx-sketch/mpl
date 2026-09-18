// src/index.ts
//
// MPL Logistics API — Express entry point
// Compatible with Prisma 7+

import "dotenv/config"
import express    from "express"
import cors       from "cors"
import helmet     from "helmet"
import rateLimit  from "express-rate-limit"

import authRouter          from "./routes/auth"
import shipmentsRouter     from "./routes/shipments"
import trackingRouter      from "./routes/tracking"
import usersRouter         from "./routes/users"
import fleetRouter         from "./routes/fleet"
import notificationsRouter from "./routes/notifications"
import filesRouter         from "./routes/files"
import adminsRouter        from "./routes/admins"
import adminNotificationsRouter from "./routes/adminNotifications"
import auditLogsRouter     from "./routes/auditLogs"
import { startAlertScheduler } from "./services/alertScheduler"

const app  = express()
const PORT = process.env.PORT || 3001

// ── Proxy awareness ──────────────────────────────────────────
// Behind Cloudflare Tunnel the real client IP arrives in X-Forwarded-For. Without this,
// every rate limiter keys on the proxy's IP, so all traffic shares one bucket and a single
// abusive client locks out everyone — the limits become theatre.
//
// ⚠️ The hop count must be EXACT. Too low and the limiter keys on the wrong address; too
// high (or a blind `trust proxy: true`) and any caller can forge X-Forwarded-For to get a
// fresh bucket per request, bypassing rate limiting entirely. Set it to the number of
// proxies actually in front of the app:
//     cloudflared only              → TRUST_PROXY_HOPS=1
//     Caddy in front of cloudflared → TRUST_PROXY_HOPS=2
// Default 0 = no proxy, which is correct for local dev.
const TRUST_PROXY_HOPS = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? "0", 10)
if (Number.isInteger(TRUST_PROXY_HOPS) && TRUST_PROXY_HOPS > 0) {
  app.set("trust proxy", TRUST_PROXY_HOPS)
}

// ── Middleware ───────────────────────────────────────────────

app.use(helmet({
  // The API is consumed cross-origin by the Vite SPA (:5173) — allow cross-origin reads.
  crossOriginResourcePolicy: { policy: "cross-origin" },
}))

// Exact-origin allowlist. This was a single CLIENT_URL, which breaks as soon as client and
// admin live on separate hostnames (app.<domain> + admin.<domain>) — and the tempting fix
// for that is a wildcard, which browsers reject alongside credentials: true anyway.
const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL,
  process.env.ADMIN_URL,
  ...(process.env.CORS_ORIGINS?.split(",") ?? []),
]
  .map((o) => o?.trim())
  .filter((o): o is string => Boolean(o))

if (ALLOWED_ORIGINS.length === 0) {
  // Local dev only. In production CLIENT_URL/ADMIN_URL are expected to be set.
  ALLOWED_ORIGINS.push("http://localhost:5173")
}

app.use(cors({
  origin: (origin, cb) => {
    // No Origin header means same-origin, curl, or server-to-server — not a browser
    // cross-origin request, so there is nothing here for CORS to protect.
    if (!origin) return cb(null, true)
    // Reject by omitting the CORS headers (the browser then blocks it) rather than
    // throwing, which would surface as a 500 instead of a clean CORS failure.
    return cb(null, ALLOWED_ORIGINS.includes(origin))
  },
  credentials: true,
}))

app.use(express.json())

// ── Rate limiting ────────────────────────────────────────────
const RATE_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

// The SPA polls several sections every 8s, so a low ceiling would lock the dashboard out
// for the rest of the window. 1500/15min (~100 req/min) leaves headroom while still
// capping egregious abuse.
// 💡 ShipmentsSection now polls a 54-byte fingerprint instead of refetching a page, so this
// ceiling can likely come down once the other four sections do the same.
const API_MAX = 1500

// Login and the rest of /api/auth.
const AUTH_MAX = 50

// Unauthenticated, token-bearing account endpoints. These do token probing and bcrypt
// hashing, and they live under /api/users — so the /api/auth limiter never covered them and
// they had only the general 1500/15min, which is a very wide brute-force window against a
// token check.
const STRICT_MAX = 15

// Static files (avatars, upload previews). Deliberately outside API_MAX — image loads
// should not consume the dashboard's request budget — but "outside the limiter" previously
// meant no limit at all, leaving an unauthenticated unbounded storage-IO surface. It gets
// its own, looser bucket.
const FILES_MAX = 3000

const limiter = (max: number, message: string) =>
  rateLimit({
    windowMs:        RATE_WINDOW_MS,
    max,
    standardHeaders: true,
    legacyHeaders:   false,
    message:         { message },
  })

const apiLimiter    = limiter(API_MAX,    "Terlalu banyak permintaan. Silakan coba lagi nanti.")
const authLimiter   = limiter(AUTH_MAX,   "Terlalu banyak percobaan. Silakan coba lagi nanti.")
const strictLimiter = limiter(STRICT_MAX, "Terlalu banyak percobaan. Silakan coba lagi nanti.")
const filesLimiter  = limiter(FILES_MAX,  "Terlalu banyak permintaan berkas. Silakan coba lagi nanti.")

// Static file serving — still mounted ahead of apiLimiter, but now rate limited.
app.use("/api/files", filesLimiter, filesRouter)

// Only the token-bearing (unauthenticated) variants:
//   GET|POST /api/users/magic-link/:token[/register]
//   GET|POST /api/users/reset-password/:token
// Deliberately NOT POST /api/users/magic-link or /reset-password-link — those are
// admin-authenticated actions an admin may legitimately repeat while onboarding clients.
const UNAUTH_TOKEN_ROUTE = /^\/api\/users\/(magic-link|reset-password)\/[^/]+/

app.use((req, res, next) =>
  UNAUTH_TOKEN_ROUTE.test(req.path) ? strictLimiter(req, res, next) : next()
)
app.use("/api/auth/register", strictLimiter) // public sign-up: bcrypt on an unauthed route
app.use("/api/auth",          authLimiter)
app.use("/api",               apiLimiter)

// ── Health Check ─────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    status:    "ok",
    service:   "MPL Logistics API",
    timestamp: new Date().toISOString(),
  })
})

// ── Routes ───────────────────────────────────────────────────

app.use("/api/auth",          authRouter)
app.use("/api/shipments",     shipmentsRouter)
app.use("/api/tracking",      trackingRouter)
app.use("/api/users",         usersRouter)
app.use("/api/fleet",         fleetRouter)
app.use("/api/notifications", notificationsRouter)
app.use("/api/admin-notifications", adminNotificationsRouter)
app.use("/api/admins",        adminsRouter)
app.use("/api/audit-logs",    auditLogsRouter)

// ── 404 Fallback ──────────────────────────────────────────────

// Does not echo req.path back — reflecting caller-supplied input in a response body is
// needless surface (and shows up in scanner output as reflected content).
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method}` })
})

// ── Start ─────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   MPL Logistics API — Prisma 7       ║
║   http://localhost:${PORT}               ║
║                                      ║
║   Health  → /health                  ║
║   Auth    → /api/auth                ║
║   Ships   → /api/shipments           ║
║   Track   → /api/tracking            ║
║   Users   → /api/users               ║
║   Fleet   → /api/fleet               ║
║   Notifs  → /api/notifications       ║
╚══════════════════════════════════════╝
  `)
  startAlertScheduler()
})

export default app
