// src/routes/auditLogs.ts
//
//   GET /api/audit-logs  → admin activity feed (SUPERADMIN only)
//     ?scope=normal|all   (default "all") — "normal" = every non-SUPERADMIN role
//       (OPERATIONS, SUPPORT + the pipeline roles KEPALA_ARMADA / PIC_PABRIK / PIC_GUDANG)
//     ?adminId=<id>        — filter to a single admin (for a future per-admin profile log)
//     ?limit=<n>&offset=<n> — pagination (limit default 20, max 100)
//
// SUPERADMIN-gated (requirePermission "admin:manage"). AdminAuditLog records every admin
// write across all tables; this is the read side for oversight. The Beranda panel calls
// this with scope=normal; scope=all (incl. the superadmin's own actions) is available for
// the deferred Profil-page activity log.

import { Router, Response } from "express"
import prisma from "../lib/prisma"
import { authenticate, adminOnly, AuthRequest } from "../middleware/auth"
import { requirePermission } from "../lib/rbac"

const router = Router()

// "normal" = every admin role except SUPERADMIN (the feed is the superadmin's oversight of
// everyone else's actions). Pipeline roles included so their pipeline actions surface.
const NORMAL_ROLES = ["OPERATIONS", "SUPPORT", "KEPALA_ARMADA", "PIC_PABRIK", "PIC_GUDANG"]
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

router.get("/", authenticate, adminOnly, requirePermission("admin:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const scope = String(req.query.scope ?? "all")
    const adminId = req.query.adminId ? String(req.query.adminId) : undefined

    const rawLimit = Number(req.query.limit)
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_LIMIT) : DEFAULT_LIMIT
    const rawOffset = Number(req.query.offset)
    const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.trunc(rawOffset) : 0

    const where = {
      ...(adminId ? { adminId } : {}),
      ...(scope === "normal" ? { admin: { role: { in: NORMAL_ROLES as any } } } : {}),
    }

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        include: { admin: { select: { id: true, fullName: true, role: true } } },
        orderBy: { timestamp: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.adminAuditLog.count({ where }),
    ])

    res.json({ logs, total })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch activity log." })
  }
})

export default router
