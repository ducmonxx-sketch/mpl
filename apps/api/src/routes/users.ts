// src/routes/users.ts
//
//   GET    /api/users                  → admin: list all clients
//   POST   /api/users                  → admin: create a client account
//   GET    /api/users/me               → client: own profile + settings
//   PATCH  /api/users/me               → client: update profile
//   PATCH  /api/users/me/settings      → client: toggle notifications / theme
//   PATCH  /api/users/:id/verify       → admin: verify a pending client
//   PATCH  /api/users/:id/reject       → admin: reject a pending client
//   PATCH  /api/users/:id              → admin: update a client account
//   DELETE /api/users/:id              → admin: delete a client (+ shipments, invoices)

import { Router, Response } from "express"
import bcrypt from "bcrypt"
import crypto from "crypto"
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
        city:               true,
        address:            true,
        npwp:               true,
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

// ── POST /api/users ───────────────────────────────────────────
// Admin creates a client account. Only fullName + email are required.
// A temporary password is auto-generated and returned ONCE in the response
// so the admin can share it with the client. The account is auto-verified
// since an admin vouches for it.
// TODO (Option B): once email (Resend/Nodemailer) is wired up, email the
// temporary password to the client instead of returning it in the response.
router.post("/", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const {
      fullName,
      companyName,
      email,
      password,
      phoneNumber,
      city,
      address,
      npwp,
    } = req.body

    if (!fullName || !email) {
      return res.status(400).json({ message: "fullName and email are required." })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(400).json({ message: "Email already registered." })
    }

    // Use an admin-supplied password if one was sent, otherwise auto-generate
    // a temporary one (~12 chars). Flag whether we generated it so we only
    // surface it back to the admin in that case.
    const generated     = !password
    const plainPassword = password || randomBytes(9).toString("base64url")
    const passwordHash  = await bcrypt.hash(plainPassword, 10)

    const user = await prisma.user.create({
      data: {
        fullName,
        companyName:        companyName ?? null,
        email,
        passwordHash,
        phoneNumber:        phoneNumber ?? null,
        city:               city ?? null,
        address:            address ?? null,
        npwp:               npwp ?? null,
        verificationStatus: "VERIFIED",
        verifiedByAdminId:  req.user!.id,
        settings:           { create: {} }, // default notification/theme prefs
      },
      select: {
        id:                 true,
        fullName:           true,
        companyName:        true,
        email:              true,
        phoneNumber:        true,
        city:               true,
        address:            true,
        npwp:               true,
        verificationStatus: true,
        createdAt:          true,
      },
    })

    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "CREATE_USER",
        targetTable:    "users",
        targetRecordId: user.id,
        changesSummary: `Created client ${user.email}`,
      },
    })

    res.status(201).json({
      message: "Client account created.",
      user,
      // Surfaced once so the admin can pass it to the client. Will be emailed
      // directly to the client in a future update (Option B).
      ...(generated && { temporaryPassword: plainPassword }),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to create client." })
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

// ── GET /api/users/companies ──────────────────────────────────
router.get("/companies", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { companyName: { not: null } },
      select: { companyName: true },
      distinct: ['companyName'],
    })
    const companies = users.map(u => u.companyName).filter(Boolean)
    res.json({ companies })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch companies." })
  }
})

// ── POST /api/users/magic-link ───────────────────────────────
router.post("/magic-link", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { companyName } = req.body
    if (!companyName) {
      return res.status(400).json({ message: "Company name is required." })
    }

    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // Valid for 7 days

    await prisma.magicLink.create({
      data: {
        token,
        type: "registration",
        companyName,
        expiresAt,
      },
    })

    await prisma.adminAuditLog.create({
      data: {
        adminId: req.user!.id,
        actionType: "GENERATE_MAGIC_LINK",
        targetTable: "magic_links",
        targetRecordId: token,
        changesSummary: `Generated registration magic link for ${companyName}`,
      },
    })

    const link = `${process.env.CLIENT_URL || "http://localhost:5173"}/register/magic?token=${token}`
    res.status(201).json({ message: "Magic link generated.", link })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to generate magic link." })
  }
})

// ── GET /api/users/magic-link/:token ─────────────────────────
router.get("/magic-link/:token", async (req: AuthRequest, res: Response) => {
  try {
    const link = await prisma.magicLink.findUnique({
      where: { token: req.params.token },
    })

    if (!link || link.type !== "registration") {
      return res.status(404).json({ message: "Invalid magic link." })
    }

    if (link.used) {
      return res.status(400).json({ message: "Magic link has already been used." })
    }

    if (new Date() > link.expiresAt) {
      return res.status(400).json({ message: "Magic link has expired." })
    }

    res.json({ companyName: link.companyName })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to validate magic link." })
  }
})

// ── POST /api/users/magic-link/:token/register ───────────────
router.post("/magic-link/:token/register", async (req: AuthRequest, res: Response) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." })
    }

    const link = await prisma.magicLink.findUnique({
      where: { token: req.params.token },
    })

    if (!link || link.type !== "registration" || link.used || new Date() > link.expiresAt) {
      return res.status(400).json({ message: "Invalid or expired magic link." })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return res.status(400).json({ message: "Email is already registered." })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        companyName: link.companyName,
        passwordHash,
        verificationStatus: "VERIFIED",
        settings: {
          create: {
            emailNotifications: true,
            whatsappNotifications: true,
          },
        },
      },
    })

    await prisma.magicLink.update({
      where: { id: link.id },
      data: { used: true },
    })

    res.status(201).json({ message: "Registration successful.", user: { id: user.id, email: user.email } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to register user via magic link." })
  }
})

// ── POST /api/users/reset-password-link ──────────────────────
router.post("/reset-password-link", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.body

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return res.status(404).json({ message: "User not found." })
    }

    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // Valid for 24 hours

    await prisma.magicLink.create({
      data: {
        token,
        type: "reset_password",
        companyName: user.companyName || "Unknown",
        userId: user.id,
        expiresAt,
      },
    })

    await prisma.adminAuditLog.create({
      data: {
        adminId: req.user!.id,
        actionType: "RESET_PASSWORD",
        targetTable: "users",
        targetRecordId: user.id,
        changesSummary: `Generated password reset link for ${user.email}`,
      },
    })

    const link = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password?token=${token}`
    res.status(201).json({ message: "Reset password link generated.", link })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to generate reset password link." })
  }
})

// ── GET /api/users/reset-password/:token ─────────────────────
router.get("/reset-password/:token", async (req: AuthRequest, res: Response) => {
  try {
    const link = await prisma.magicLink.findUnique({
      where: { token: req.params.token },
    })

    if (!link || link.type !== "reset_password") {
      return res.status(404).json({ message: "Invalid reset password link." })
    }

    if (link.used) {
      return res.status(400).json({ message: "Reset link has already been used." })
    }

    if (new Date() > link.expiresAt) {
      return res.status(400).json({ message: "Reset link has expired." })
    }

    const user = await prisma.user.findUnique({ where: { id: link.userId! } })
    if (!user) {
      return res.status(404).json({ message: "User not found." })
    }

    res.json({ fullName: user.fullName, companyName: user.companyName })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to validate reset link." })
  }
})

// ── POST /api/users/reset-password/:token ────────────────────
router.post("/reset-password/:token", async (req: AuthRequest, res: Response) => {
  try {
    const { password, confirmPassword } = req.body

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." })
    }

    const link = await prisma.magicLink.findUnique({
      where: { token: req.params.token },
    })

    if (!link || link.type !== "reset_password" || link.used || new Date() > link.expiresAt) {
      return res.status(400).json({ message: "Invalid or expired reset link." })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    await prisma.user.update({
      where: { id: link.userId! },
      data: { passwordHash },
    })

    await prisma.magicLink.update({
      where: { id: link.id },
      data: { used: true },
    })

    res.json({ message: "Password reset successful." })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to reset password." })
  }
})

// ── PATCH /api/users/:id ──────────────────────────────────────
// Admin updates a client's profile fields.
// NOTE: registered AFTER /me and /me/settings so those take precedence.
router.patch("/:id", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { fullName, companyName, email, phoneNumber, city, address, npwp } = req.body

    // If email is changing, make sure it isn't taken by someone else
    if (email) {
      const clash = await prisma.user.findUnique({ where: { email } })
      if (clash && clash.id !== req.params.id) {
        return res.status(400).json({ message: "Email already registered to another account." })
      }
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(fullName    !== undefined && { fullName }),
        ...(companyName !== undefined && { companyName }),
        ...(email       !== undefined && { email }),
        ...(phoneNumber !== undefined && { phoneNumber }),
        ...(city        !== undefined && { city }),
        ...(address     !== undefined && { address }),
        ...(npwp        !== undefined && { npwp }),
      },
      select: {
        id:          true,
        fullName:    true,
        companyName: true,
        email:       true,
        phoneNumber: true,
        city:        true,
        address:     true,
        npwp:        true,
      },
    })

    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "UPDATE_USER",
        targetTable:    "users",
        targetRecordId: user.id,
        changesSummary: `Updated client ${user.email}`,
      },
    })

    res.json({ message: "Client updated.", user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to update client." })
  }
})

// ── DELETE /api/users/:id ─────────────────────────────────────
// Admin deletes a client. Their invoices and shipments are removed too.
router.delete("/:id", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id

    const user = await prisma.user.findUnique({
      where:  { id },
      select: { id: true, email: true },
    })

    if (!user) {
      return res.status(404).json({ message: "User not found." })
    }

    await prisma.$transaction([
      prisma.invoice.deleteMany({ where: { clientId: id } }),
      prisma.shipment.deleteMany({ where: { clientId: id } }),
      prisma.user.delete({ where: { id } }),
    ])

    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "DELETE_USER",
        targetTable:    "users",
        targetRecordId: id,
        changesSummary: `Deleted client ${user.email} and related shipments/invoices`,
      },
    })

    res.json({ message: "Client deleted." })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to delete client." })
  }
})

export default router
