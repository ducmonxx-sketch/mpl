// src/routes/users.ts
//
//   GET    /api/users                  → admin: list all clients
//   GET    /api/users/me               → client: own profile + settings
//   PATCH  /api/users/me               → client: update profile
//   PATCH  /api/users/me/settings      → client: toggle notifications / theme
//   PATCH  /api/users/:id/verify       → admin: verify a pending client
//   PATCH  /api/users/:id/reject       → admin: reject a pending client

import { Router, Response } from "express"
import prisma from "../lib/prisma"
import { authenticate, adminOnly, AuthRequest } from "../middleware/auth"

const router = Router()

// ── GET /api/users ────────────────────────────────────────────
router.get("/", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query

    const users = await prisma.user.findMany({
      where:   status ? { verificationStatus: status as any } : {},
      select: {
        id:                 true,
        fullName:           true,
        companyName:        true,
        email:              true,
        phoneNumber:        true,
        verificationStatus: true,
        createdAt:          true,
        verifiedByAdmin:    { select: { fullName: true } },
        _count:             { select: { shipments: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    res.json({ users })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch users." })
  }
})

// ── GET /api/users/me ─────────────────────────────────────────
router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id:                 true,
        fullName:           true,
        companyName:        true,
        email:              true,
        phoneNumber:        true,
        verificationStatus: true,
        createdAt:          true,
        settings:           true,
      },
    })

    if (!user) return res.status(404).json({ message: "User not found." })

    res.json({ user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch profile." })
  }
})

// ── PATCH /api/users/me ───────────────────────────────────────
router.patch("/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fullName, companyName, phoneNumber } = req.body

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(fullName    && { fullName }),
        ...(companyName && { companyName }),
        ...(phoneNumber && { phoneNumber }),
      },
      select: {
        id:          true,
        fullName:    true,
        companyName: true,
        email:       true,
        phoneNumber: true,
      },
    })

    res.json({ message: "Profile updated.", user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to update profile." })
  }
})

// ── PATCH /api/users/me/settings ─────────────────────────────
// Toggle WhatsApp / email notifications, language, theme
router.patch("/me/settings", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { emailNotifications, whatsappNotifications, language, theme } = req.body

    const settings = await prisma.userSettings.update({
      where: { userId: req.user!.id },
      data: {
        ...(emailNotifications    !== undefined && { emailNotifications }),
        ...(whatsappNotifications !== undefined && { whatsappNotifications }),
        ...(language              && { language }),
        ...(theme                 && { theme }),
      },
    })

    res.json({ message: "Settings updated.", settings })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to update settings." })
  }
})

// ── PATCH /api/users/:id/verify ───────────────────────────────
router.patch("/:id/verify", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        verificationStatus: "VERIFIED",
        verifiedByAdminId:  req.user!.id,
      },
      select: { id: true, fullName: true, email: true },
    })

    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "VERIFY_USER",
        targetTable:    "users",
        targetRecordId: user.id,
        changesSummary: `Verified user ${user.email}`,
      },
    })

    await prisma.notification.create({
      data: {
        userId:  user.id,
        title:   "Account Verified",
        message: "Your account has been verified. You can now create shipment requests.",
      },
    })

    res.json({ message: `${user.fullName} has been verified.`, user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to verify user." })
  }
})

// ── PATCH /api/users/:id/reject ───────────────────────────────
router.patch("/:id/reject", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data:  { verificationStatus: "REJECTED" },
      select: { id: true, fullName: true, email: true },
    })

    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "REJECT_USER",
        targetTable:    "users",
        targetRecordId: user.id,
        changesSummary: `Rejected user ${user.email}`,
      },
    })

    res.json({ message: `${user.fullName} has been rejected.`, user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to reject user." })
  }
})

export default router
