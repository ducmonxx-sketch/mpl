import { Router, Response } from "express"
import prisma from "../lib/prisma"
import { authenticate, adminOnly, AuthRequest } from "../middleware/auth"

const router = Router()

router.get("/", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await prisma.adminNotification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const unreadCount = await prisma.adminNotification.count({
      where: { isRead: false },
    })

    res.json({ notifications, unreadCount })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch admin notifications." })
  }
})

router.patch("/read-all", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.adminNotification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    })
    res.json({ message: "All notifications marked as read." })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to mark notifications as read." })
  }
})

router.patch("/:id/read", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const notification = await prisma.adminNotification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    })
    res.json({ message: "Notification marked as read.", notification })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to mark notification as read." })
  }
})

export default router
