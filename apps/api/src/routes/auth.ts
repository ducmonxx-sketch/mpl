// src/routes/auth.ts
//
//   POST /api/auth/register        → client registers
//   POST /api/auth/login           → client logs in
//   POST /api/auth/admin/login     → admin logs in
//   GET  /api/auth/admin/me        → admin: own profile
//   POST /api/auth/admin/me/avatar → admin: upload profile picture

import { Router, Request, Response } from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import prisma from "../lib/prisma"
import { authenticate, adminOnly, AuthRequest } from "../middleware/auth"
import { uploadImageField, saveUpload, deleteUpload } from "../lib/upload"
import { getStorage } from "../lib/storage"

const router = Router()

const generateToken = (id: string, role: string, type: "user" | "admin") =>
  jwt.sign({ id, role, type }, process.env.JWT_SECRET!, { expiresIn: "7d" })

// ── POST /api/auth/register ──────────────────────────────────
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { fullName, companyName, email, password, phoneNumber } = req.body

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(400).json({ message: "Email already registered." })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        fullName,
        companyName,
        email,
        passwordHash,
        phoneNumber,
        settings: {
          create: {
            emailNotifications:    true,
            whatsappNotifications: true,
          },
        },
      },
      select: {
        id:                 true,
        fullName:           true,
        companyName:        true,
        email:              true,
        verificationStatus: true,
        createdAt:          true,
      },
    })

    res.status(201).json({
      message: "Registration successful. Please wait for admin verification.",
      user,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Server error during registration." })
  }
})

// ── POST /api/auth/login ─────────────────────────────────────
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." })
    }

    const match = await bcrypt.compare(password, user.passwordHash)
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password." })
    }

    if (user.verificationStatus === "PENDING") {
      return res.status(403).json({
        message: "Your account is pending verification.",
      })
    }

    if (user.verificationStatus === "REJECTED") {
      return res.status(403).json({
        message: "Your account has been rejected. Please contact support.",
      })
    }

    const token = generateToken(user.id, "user", "user")

    res.json({
      token,
      user: {
        id:          user.id,
        fullName:    user.fullName,
        companyName: user.companyName,
        email:       user.email,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Server error during login." })
  }
})

// ── POST /api/auth/admin/login ───────────────────────────────
router.post("/admin/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    const admin = await prisma.admin.findUnique({ where: { email } })
    if (!admin) {
      return res.status(401).json({ message: "Invalid email or password." })
    }

    const match = await bcrypt.compare(password, admin.passwordHash)
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password." })
    }

    const token = generateToken(admin.id, admin.role, "admin")

    res.json({
      token,
      admin: {
        id:       admin.id,
        fullName: admin.fullName,
        email:    admin.email,
        role:     admin.role,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Server error during login." })
  }
})

// ── GET /api/auth/admin/me ───────────────────────────────────
// Admin's own profile (also the server-side check needed for the future cookie auth).
router.get("/admin/me", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await prisma.admin.findUnique({
      where:  { id: req.user!.id },
      select: { id: true, fullName: true, email: true, role: true, avatarKey: true, createdAt: true },
    })
    if (!admin) return res.status(404).json({ message: "Admin not found." })

    const { avatarKey, ...rest } = admin
    const avatarUrl = avatarKey ? await getStorage().getUrl(avatarKey) : null
    res.json({ admin: { ...rest, avatarUrl } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch admin profile." })
  }
})

// ── POST /api/auth/admin/me/avatar ───────────────────────────
// Admin uploads / replaces their profile picture.
router.post("/admin/me/avatar", authenticate, adminOnly, uploadImageField(), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Tidak ada file gambar." })

    const current = await prisma.admin.findUnique({
      where:  { id: req.user!.id },
      select: { avatarKey: true },
    })
    if (current?.avatarKey) await deleteUpload(current.avatarKey).catch(() => {})

    const { key, url } = await saveUpload("avatars", req.user!.id, req.file)
    await prisma.admin.update({ where: { id: req.user!.id }, data: { avatarKey: key } })

    res.json({ message: "Foto profil diperbarui.", avatarUrl: url })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Gagal mengunggah foto profil." })
  }
})

export default router
