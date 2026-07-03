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
import invoicesRouter      from "./routes/invoices"
import filesRouter         from "./routes/files"
import adminsRouter        from "./routes/admins"
import adminNotificationsRouter from "./routes/adminNotifications"
import auditLogsRouter     from "./routes/auditLogs"
import { startAlertScheduler } from "./services/alertScheduler"

const app  = express()
const PORT = process.env.PORT || 3001

// ── Middleware ───────────────────────────────────────────────

app.use(helmet({
  // The API is consumed cross-origin by the Vite SPA (:5173) — allow cross-origin reads.
  crossOriginResourcePolicy: { policy: "cross-origin" },
}))

app.use(cors({
  origin:      process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}))

app.use(express.json())

// Static file serving (avatars, etc.) — public, mounted before rate limiting so
// image loads are not counted against the API limit.
app.use("/api/files", filesRouter)

// ── Rate limiting ────────────────────────────────────────────
// General limiter caps abuse across the API; the auth limiter is stricter
// to slow brute-force on login.
const RATE_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

// The SPA polls several sections every 8s (~15 req/min while idle, more with
// navigation + multiple tabs), so a low ceiling locks the dashboard out for the
// rest of the window. 1500/15min (~100 req/min) leaves comfortable headroom for
// legitimate use while still capping egregious abuse.
const API_MAX  = 1500
// Stricter on auth: protects login/magic-link against brute force. Nothing polls
// these endpoints, so a low limit is safe.
const AUTH_MAX = 50

const apiLimiter = rateLimit({
  windowMs:        RATE_WINDOW_MS,
  max:             API_MAX,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { message: "Terlalu banyak permintaan. Silakan coba lagi nanti." },
})

const authLimiter = rateLimit({
  windowMs:        RATE_WINDOW_MS,
  max:             AUTH_MAX,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { message: "Terlalu banyak percobaan. Silakan coba lagi nanti." },
})

app.use("/api/auth", authLimiter)
app.use("/api",      apiLimiter)

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
app.use("/api/invoices",      invoicesRouter)
app.use("/api/admins",        adminsRouter)
app.use("/api/audit-logs",    auditLogsRouter)

// ── 404 Fallback ──────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.path}`,
  })
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
║   Invoice → /api/invoices            ║
╚══════════════════════════════════════╝
  `)
  startAlertScheduler()
})

export default app
