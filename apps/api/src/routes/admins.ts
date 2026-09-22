// src/routes/admins.ts
//
//   GET  /api/admins                      → list admin accounts
//   POST /api/admins                      → create an admin (returns a one-time temp password)
//   POST /api/admins/:id/reset-password   → reset an admin's password (returns a one-time temp password)
//
// All SUPERADMIN-only (requirePermission "admin:manage"). The temp password is returned
// once for the super-admin to relay; the admin should change it after first login.

import { Router, Response } from "express"
import bcrypt from "bcrypt"
import crypto from "crypto"
import prisma from "../lib/prisma"
import { authenticate, adminOnly, AuthRequest } from "../middleware/auth"
import { revokeAllSessions } from "../lib/session"
import { requirePermission } from "../lib/rbac"

const router = Router()

const ADMIN_ROLES = ["SUPERADMIN", "OPERATIONS", "SUPPORT", "KEPALA_ARMADA", "PIC_PABRIK", "PIC_GUDANG"]
const genTempPassword = () => crypto.randomBytes(9).toString("base64url") // ~12 chars

// ── GET /api/admins ───────────────────────────────────────────
router.get("/", authenticate, adminOnly, requirePermission("admin:manage"), async (_req: AuthRequest, res: Response) => {
  try {
    const admins = await prisma.admin.findMany({
      select:  { id: true, fullName: true, email: true, role: true, avatarKey: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    })
    res.json({ admins })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch admins." })
  }
})

// ── POST /api/admins ──────────────────────────────────────────
router.post("/", authenticate, adminOnly, requirePermission("admin:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const { fullName, email, role = "OPERATIONS" } = req.body
    if (!fullName || !email) {
      return res.status(400).json({ message: "Nama dan email wajib diisi." })
    }
    if (!ADMIN_ROLES.includes(role)) {
      return res.status(400).json({ message: "Role admin tidak valid." })
    }

    const existing = await prisma.admin.findUnique({ where: { email } })
    if (existing) {
      return res.status(400).json({ message: "Email admin sudah terdaftar." })
    }

    const tempPassword = genTempPassword()
    const admin = await prisma.admin.create({
      data:   { fullName, email, role, passwordHash: await bcrypt.hash(tempPassword, 10) },
      select: { id: true, fullName: true, email: true, role: true, createdAt: true },
    })

    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "CREATE_ADMIN",
        targetTable:    "admins",
        targetRecordId: admin.id,
        changesSummary: `Created admin ${email} (${role})`,
      },
    })

    // tempPassword returned once — relay to the new admin, who should change it.
    res.status(201).json({ message: "Admin dibuat.", admin, tempPassword })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to create admin." })
  }
})

// ── POST /api/admins/:id/reset-password ───────────────────────
router.post("/:id/reset-password", authenticate, adminOnly, requirePermission("admin:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id)
    const admin = await prisma.admin.findUnique({ where: { id }, select: { id: true, email: true } })
    if (!admin) {
      return res.status(404).json({ message: "Admin tidak ditemukan." })
    }

    const tempPassword = genTempPassword()
    await prisma.admin.update({ where: { id }, data: { passwordHash: await bcrypt.hash(tempPassword, 10) } })

    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "RESET_PASSWORD",
        targetTable:    "admins",
        targetRecordId: id,
        changesSummary: `Reset password for admin ${admin.email}`,
      },
    })

    res.json({ message: "Password admin direset.", tempPassword })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to reset admin password." })
  }
})

// ── POST /api/admins/:id/2fa/reset ────────────────────────────
// Lost-phone recovery. A TOTP secret only exists on the admin's device, so a wiped or lost
// phone otherwise locks that account out permanently — this is the way back in.
//
// SUPERADMIN only, and it revokes the target's sessions so a reset cannot be used to
// quietly keep someone else's session alive.
//
// ⚠️ Escape hatch for the worst case — the LAST superadmin losing their phone, with nobody
// able to call this. Clear it directly in the database:
//     UPDATE admins SET "totpSecret"=NULL, "totpEnabledAt"=NULL, "totpLastUsedStep"=NULL
//     WHERE email='<their email>';
// Or simply set TOTP_ENABLED=false to switch enforcement off for everyone while sorting it out.
router.post("/:id/2fa/reset", authenticate, adminOnly, requirePermission("admin:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const target = await prisma.admin.findUnique({ where: { id }, select: { email: true, totpEnabledAt: true } })
    if (!target) return res.status(404).json({ message: "Admin not found." })

    await prisma.admin.update({
      where: { id },
      data: { totpSecret: null, totpEnabledAt: null, totpLastUsedStep: null },
    })
    const killed = await revokeAllSessions({ id, type: "admin" })

    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "RESET_PASSWORD",   // nearest existing enum value; no RESET_2FA yet
        targetTable:    "admins",
        targetRecordId: id,
        changesSummary: `Reset 2FA for ${target.email}`,
      },
    }).catch(() => {})

    res.json({
      message: `2FA untuk ${target.email} telah direset. Admin tersebut perlu mendaftar ulang.`,
      wasEnabled: !!target.totpEnabledAt,
      sessionsRevoked: killed,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Gagal mereset 2FA." })
  }
})

export default router
