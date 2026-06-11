// src/index.ts
//
// MPL Logistics API — Express entry point
// Compatible with Prisma 7+

import "dotenv/config"
import express    from "express"
import cors       from "cors"

import authRouter          from "./routes/auth"
import shipmentsRouter     from "./routes/shipments"
import trackingRouter      from "./routes/tracking"
import usersRouter         from "./routes/users"
import fleetRouter         from "./routes/fleet"
import notificationsRouter from "./routes/notifications"
import invoicesRouter      from "./routes/invoices"
import adminNotificationsRouter from "./routes/adminNotifications"
import { startAlertScheduler } from "./services/alertScheduler"

const app  = express()
const PORT = process.env.PORT || 3001

// ── Middleware ───────────────────────────────────────────────

app.use(cors({
  origin:      process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}))

app.use(express.json())

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
