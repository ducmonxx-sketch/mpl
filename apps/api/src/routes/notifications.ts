// src/routes/notifications.ts
//
//   GET    /api/notifications           → get my notifications
//   PATCH  /api/notifications/:id/read  → mark one as read
//   PATCH  /api/notifications/read-all  → mark all as read

import { Router, Response } from "express"
import prisma from "../lib/prisma"
import { authenticate, AuthRequest } from "../middleware/auth"

const router = Router()

// ── GET /api/notifications ────────────────────────────────────
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where:   { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take:    50,
    })

    const unreadCount = notifications.filter((n) => !n.isRead).length

    res.json({ notifications, unreadCount })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch notifications." })
  }
})

// ── PATCH /api/notifications/read-all ────────────────────────
// Must be defined BEFORE /:id/read — otherwise Express
// would treat "read-all" as an :id parameter
router.patch("/read-all", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data:  { isRead: true },
    })

    res.json({ message: "All notifications marked as read." })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to update notifications." })
  }
})

// ── PATCH /api/notifications/:id/read ────────────────────────
router.patch("/:id/read", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.id },
      data:  { isRead: true },
    })

    res.json({ message: "Notification marked as read." })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to update notification." })
  }
})

export default router
