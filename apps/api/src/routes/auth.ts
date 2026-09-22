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
import { requireTurnstile } from "../lib/turnstile"
import { startSession, endSession } from "../lib/session"
import { checkLockout, recordAttempt } from "../lib/loginGuard"
import { issueCsrfToken, issueCsrfTokenFromRequest } from "../lib/csrf"
import { isTotpEnforced, generateTotpSecret, totpUri, verifyTotp } from "../lib/totp"
import { revokeAllSessions } from "../lib/session"
import { validateBody, registerSchema, loginSchema, emailOnlySchema, changePasswordSchema } from "../lib/validate"
import { uploadImageField, saveUpload, deleteUpload, ImageProcessingError } from "../lib/upload"
import { getStorage } from "../lib/storage"

const router = Router()

const generateToken = (id: string, role: string, type: "user" | "admin") =>
  jwt.sign({ id, role, type }, process.env.JWT_SECRET!, { expiresIn: "7d" })

// ── POST /api/auth/register ──────────────────────────────────
router.post("/register", requireTurnstile, validateBody(registerSchema), async (req: Request, res: Response) => {
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
router.post("/login", requireTurnstile, validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    // Phase 2c: refuse before touching bcrypt, so a locked-out attacker gets no CPU either.
    const lock = await checkLockout(email, req.ip)
    if (lock.locked) {
      res.setHeader("Retry-After", String(lock.retryAfterSeconds))
      return res.status(429).json({
        message: `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(lock.retryAfterSeconds / 60)} menit.`,
      })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      await recordAttempt(email, req.ip, false, "client")
      return res.status(401).json({ message: "Invalid email or password." })
    }

    const match = await bcrypt.compare(password, user.passwordHash)
    if (!match) {
      await recordAttempt(email, req.ip, false, "client")
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
    // Phase 2a: also open a server-side session. The body token stays for now so the
    // existing localStorage frontend keeps working until the 2f cutover.
    const sessionToken = await startSession(res, { id: user.id, role: "user", type: "user" }, req)
    await recordAttempt(email, req.ip, true, "client")
    issueCsrfToken(res, sessionToken)

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

// ── POST /api/auth/registration-status ───────────────────────
// Public: lets the verification page poll whether a pending account has been
// approved (sessionless — pending users hold no token). Returns the account's
// verification status by email, or "NONE" if there's no such account.
router.post("/registration-status", validateBody(emailOnlySchema), async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({ message: "Email is required." })
    }
    const user = await prisma.user.findUnique({
      where:  { email },
      select: { verificationStatus: true },
    })
    res.json({ status: user?.verificationStatus ?? "NONE" })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to check status." })
  }
})

// ── POST /api/auth/admin/login ───────────────────────────────
router.post("/admin/login", requireTurnstile, validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    // Phase 2c: refuse before touching bcrypt, so a locked-out attacker gets no CPU either.
    const lock = await checkLockout(email, req.ip)
    if (lock.locked) {
      res.setHeader("Retry-After", String(lock.retryAfterSeconds))
      return res.status(429).json({
        message: `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(lock.retryAfterSeconds / 60)} menit.`,
      })
    }

    const admin = await prisma.admin.findUnique({ where: { email } })
    if (!admin) {
      await recordAttempt(email, req.ip, false, "admin")
      return res.status(401).json({ message: "Invalid email or password." })
    }

    const match = await bcrypt.compare(password, admin.passwordHash)
    if (!match) {
      await recordAttempt(email, req.ip, false, "admin")
      return res.status(401).json({ message: "Invalid email or password." })
    }

    const token = generateToken(admin.id, admin.role, "admin")
    // Phase 2a: also open a server-side session. The body token stays for now so the
    // existing localStorage frontend keeps working until the 2f cutover.
    // ── Phase 2d: second factor ──
    // Only bites when the admin has actually enrolled AND the feature is switched on, so
    // this is inert for everyone until both are true.
    if (isTotpEnforced() && admin.totpEnabledAt && admin.totpSecret) {
      const code = (req.body.totpCode ?? "").trim()
      if (!code) {
        // Counted as a failed attempt so the 2c lockout also throttles code guessing —
        // 6 digits is only a million combinations, which 5-per-15-minutes makes hopeless.
        await recordAttempt(email, req.ip, false, "admin")
        return res.status(401).json({ message: "Kode 2FA diperlukan.", totpRequired: true })
      }
      const check = await verifyTotp(code, admin.totpSecret, admin.totpLastUsedStep)
      if (!check.valid) {
        await recordAttempt(email, req.ip, false, "admin")
        return res.status(401).json({
          message: check.reason === "replayed"
            ? "Kode ini sudah dipakai. Tunggu kode berikutnya."
            : "Kode 2FA tidak valid.",
          totpRequired: true,
        })
      }
      // Remember the accepted step so the same code can't be replayed inside its window.
      await prisma.admin.update({ where: { id: admin.id }, data: { totpLastUsedStep: check.timeStep } })
    }

    const sessionToken = await startSession(res, { id: admin.id, role: admin.role, type: "admin" }, req)
    await recordAttempt(email, req.ip, true, "admin")
    issueCsrfToken(res, sessionToken)

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
      select: { id: true, fullName: true, email: true, role: true, avatarKey: true, createdAt: true,
                pickupPlantId: true, pickupPlant: { select: { name: true } } },
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
    if (err instanceof ImageProcessingError) {
      return res.status(400).json({ message: "Gambar tidak dapat diproses. Pastikan file tidak rusak." })
    }
    console.error(err)
    res.status(500).json({ message: "Gagal mengunggah foto profil." })
  }
})

// ── PATCH /api/auth/admin/me/password ────────────────────────
// Admin changes their OWN password (any role — self-service). Verifies the
// current password before setting the new one.
router.patch("/admin/me/password", authenticate, adminOnly, validateBody(changePasswordSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Password saat ini dan password baru wajib diisi." })
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "Password baru minimal 6 karakter." })
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ message: "Password baru harus berbeda dari password saat ini." })
    }

    const admin = await prisma.admin.findUnique({
      where:  { id: req.user!.id },
      select: { id: true, passwordHash: true },
    })
    if (!admin) return res.status(404).json({ message: "Admin tidak ditemukan." })

    const match = await bcrypt.compare(currentPassword, admin.passwordHash)
    if (!match) {
      return res.status(400).json({ message: "Password saat ini salah." })
    }

    await prisma.admin.update({
      where: { id: admin.id },
      data:  { passwordHash: await bcrypt.hash(newPassword, 10) },
    })

    await prisma.adminAuditLog.create({
      data: {
        adminId:        admin.id,
        actionType:     "RESET_PASSWORD",
        targetTable:    "admins",
        targetRecordId: admin.id,
        changesSummary: "Changed own password",
      },
    })

    res.json({ message: "Password berhasil diperbarui." })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Gagal memperbarui password." })
  }
})

// ── POST /api/auth/logout ─────────────────────────────────────
// Did not exist before Phase 2a — with a stateless Bearer JWT there was nothing to revoke,
// so "logging out" was purely a client-side localStorage wipe and the token stayed valid for
// its full 7 days. Now it revokes the session server-side and clears the cookie.
// Unauthenticated on purpose: logging out must work even with an already-dead session.
router.post("/logout", async (req: AuthRequest, res: Response) => {
  await endSession(req, res)
  res.json({ message: "Logged out." })
})

// GET /api/auth/csrf - mint a CSRF token for the current session. Needed because a page
// reload loses any in-memory copy. 401 without a session, since there is nothing to bind to.
router.get("/csrf", async (req: AuthRequest, res: Response) => {
  const token = issueCsrfTokenFromRequest(req, res)
  if (!token) return res.status(401).json({ message: "No session." })
  res.json({ csrfToken: token })
})

// ── Admin 2FA (Phase 2d) ──────────────────────────────────────
// Enrolment is two steps on purpose: /setup stores a secret but leaves it DISABLED, and
// /enable only switches it on once the admin has proved a working code. Otherwise a bad
// scan would lock them out of their own account.

// POST /api/auth/admin/2fa/setup → returns the otpauth URI + the secret to display.
// The QR is rendered by the admin UI, which keeps a qrcode dependency out of the API.
router.post("/admin/2fa/setup", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await prisma.admin.findUnique({ where: { id: req.user!.id }, select: { email: true, totpEnabledAt: true } })
    if (!admin) return res.status(404).json({ message: "Admin not found." })
    if (admin.totpEnabledAt) {
      return res.status(409).json({ message: "2FA sudah aktif. Matikan dulu sebelum mendaftar ulang." })
    }
    const secret = generateTotpSecret()
    await prisma.admin.update({ where: { id: req.user!.id }, data: { totpSecret: secret, totpLastUsedStep: null } })
    res.json({
      secret,                                   // shown as text, for people who can't scan
      uri: await totpUri(secret, admin.email),  // the admin UI renders this as a QR
      enabled: false,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Gagal menyiapkan 2FA." })
  }
})

// POST /api/auth/admin/2fa/enable → prove a code, then switch it on.
router.post("/admin/2fa/enable", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await prisma.admin.findUnique({ where: { id: req.user!.id }, select: { totpSecret: true, totpEnabledAt: true } })
    if (!admin?.totpSecret) return res.status(400).json({ message: "Jalankan setup 2FA terlebih dahulu." })
    if (admin.totpEnabledAt) return res.status(409).json({ message: "2FA sudah aktif." })

    const check = await verifyTotp(String(req.body?.code ?? ""), admin.totpSecret, null)
    if (!check.valid) return res.status(400).json({ message: "Kode tidak valid. Coba kode terbaru dari aplikasi." })

    await prisma.admin.update({
      where: { id: req.user!.id },
      data: { totpEnabledAt: new Date(), totpLastUsedStep: check.timeStep },
    })
    // A change of second factor should not leave older sessions alive elsewhere.
    await revokeAllSessions({ id: req.user!.id, type: "admin" })
    res.json({ message: "2FA aktif.", enabled: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Gagal mengaktifkan 2FA." })
  }
})

// POST /api/auth/admin/2fa/disable → requires a current code, so a hijacked session alone
// cannot strip the second factor.
router.post("/admin/2fa/disable", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await prisma.admin.findUnique({ where: { id: req.user!.id }, select: { totpSecret: true, totpEnabledAt: true, totpLastUsedStep: true } })
    if (!admin?.totpEnabledAt || !admin.totpSecret) return res.status(400).json({ message: "2FA belum aktif." })

    const check = await verifyTotp(String(req.body?.code ?? ""), admin.totpSecret, admin.totpLastUsedStep)
    if (!check.valid) {
      // "Already used" is a genuinely different failure from "wrong", and saying so avoids
      // a confusing dead end: a code is only valid for its 30s window and cannot be reused,
      // so enabling then immediately disabling would otherwise report a correct code as bad.
      return res.status(400).json({
        message: check.reason === "replayed"
          ? "Kode ini sudah dipakai. Tunggu kode berikutnya dari aplikasi."
          : "Kode tidak valid.",
      })
    }

    await prisma.admin.update({
      where: { id: req.user!.id },
      data: { totpSecret: null, totpEnabledAt: null, totpLastUsedStep: null },
    })
    await revokeAllSessions({ id: req.user!.id, type: "admin" })
    res.json({ message: "2FA dimatikan.", enabled: false })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Gagal mematikan 2FA." })
  }
})

// GET /api/auth/admin/2fa → current state, for the Profil page to render.
router.get("/admin/2fa", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  const admin = await prisma.admin.findUnique({ where: { id: req.user!.id }, select: { totpEnabledAt: true } })
  res.json({ enabled: !!admin?.totpEnabledAt, enforced: isTotpEnforced(), enabledAt: admin?.totpEnabledAt ?? null })
})

export default router
