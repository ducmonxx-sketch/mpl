// src/routes/auth.ts
//
//   POST /api/auth/register        → client registers
//   POST /api/auth/login           → client logs in
//   POST /api/auth/admin/login     → admin logs in

import { Router, Request, Response } from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import prisma from "../lib/prisma"

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

export default router
