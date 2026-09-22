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
import { isEmailOtpEnabled, createEmailOtp, verifyEmailOtp } from "../lib/emailOtp"
import { verifiedAccessEmail } from "../lib/cfAccess"
import { trustDevice, isDeviceTrusted, forgetThisDevice, revokeAllDevices, listDevices } from "../lib/trustedDevice"
import { listSessions, revokeSessionById, currentSessionId, readSessionCookie } from "../lib/session"
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
    // ── Second factor: emailed one-time code ──
    // Skipped when Cloudflare Access has already challenged this same identity on the tunnel
    // path (it sends its own email OTP), because a second emailed code there is two emails
    // for one factor. On the LAN fallback Access is bypassed, so this still applies.
    // verifiedAccessEmail() FAILS CLOSED — anything unproven means the code is required.
    if (isEmailOtpEnabled()) {
      const accessEmail = await verifiedAccessEmail(req)
      const accessSatisfied = !!accessEmail && accessEmail === admin.email.trim().toLowerCase()
      // Or this browser proved the second factor within the trust window (default 7 days).
      // Still requires the password — the device cookie only removes the OTP step.
      const deviceTrusted = accessSatisfied ? false : await isDeviceTrusted(req, admin.id)

      if (!accessSatisfied && !deviceTrusted) {
        const challenge = await createEmailOtp(admin, req.ip)
        if ("rateLimited" in challenge) {
          res.setHeader("Retry-After", String(challenge.retryAfterSeconds))
          return res.status(429).json({ message: "Terlalu banyak permintaan kode. Coba lagi nanti." })
        }
        // 200, not 401: the password WAS correct, authentication is simply incomplete. No
        // token and no session are issued here — those only happen at /login/verify.
        return res.status(200).json({
          message: "Kode masuk telah dikirim ke email Anda.",
          otpRequired: true,
          challengeId: challenge.challengeId,
          // Present only when SMTP is unconfigured and not in production, so the flow can be
          // exercised locally before credentials exist.
          ...(challenge.devCode ? { devCode: challenge.devCode } : {}),
        })
      }
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

    // Changing a password should not leave other sessions alive, and must drop every

    // remembered browser: if the password was changed because someone else is suspected

    // to be in, their device must stop skipping the second factor.

    const currentToken = readSessionCookie(req)

    const keepId = currentToken ? await currentSessionId(currentToken) : null

    await revokeAllSessions({ id: req.user!.id, type: "admin" })

    await revokeAllDevices(req.user!.id)

    // Re-open the caller's own session so changing a password doesn't log you out of

    // the tab you did it in.

    if (keepId) {

      await prisma.session.update({ where: { id: keepId }, data: { revokedAt: null } }).catch(() => {})

    }

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
  // Opt-in: ?forgetDevice=1 also drops the 7-day OTP exemption for this browser, for
  // "I'm on someone else's computer".
  if (req.query.forgetDevice === "1" || req.body?.forgetDevice === true) {
    await forgetThisDevice(req, res)
  }
  res.json({ message: "Logged out." })
})

// GET /api/auth/csrf - mint a CSRF token for the current session. Needed because a page
// reload loses any in-memory copy. 401 without a session, since there is nothing to bind to.
router.get("/csrf", async (req: AuthRequest, res: Response) => {
  const token = issueCsrfTokenFromRequest(req, res)
  if (!token) return res.status(401).json({ message: "No session." })
  res.json({ csrfToken: token })
})


// ── POST /api/auth/admin/login/verify ─────────────────────────
// Step two of the emailed-code login. Only here is a session actually created.
// No CSRF token is needed: the first step issues no session cookie, so csrfProtection skips.
router.post("/admin/login/verify", async (req: AuthRequest, res: Response) => {
  try {
    const challengeId = String(req.body?.challengeId ?? "").trim()
    const code = String(req.body?.code ?? "").trim()
    if (!challengeId || !code) {
      return res.status(400).json({ message: "Challenge dan kode wajib diisi." })
    }

    const result = await verifyEmailOtp(challengeId, code)
    if (!result.ok || !result.adminId) {
      const msg =
        result.reason === "expired"            ? "Kode sudah kedaluwarsa. Silakan login ulang." :
        result.reason === "used"               ? "Kode sudah dipakai. Silakan login ulang." :
        result.reason === "too-many-attempts"  ? "Terlalu banyak percobaan kode. Silakan login ulang." :
                                                 "Kode tidak valid."
      return res.status(401).json({ message: msg, otpRequired: true })
    }

    const admin = await prisma.admin.findUnique({
      where: { id: result.adminId },
      select: { id: true, fullName: true, email: true, role: true },
    })
    if (!admin) return res.status(401).json({ message: "Akun tidak ditemukan." })

    const token = generateToken(admin.id, admin.role, "admin")
    const sessionToken = await startSession(res, { id: admin.id, role: admin.role, type: "admin" }, req)
    // Recorded as the successful login, since this is the point authentication completes —
    // which also resets the per-email failure counter from lib/loginGuard.
    await recordAttempt(admin.email, req.ip, true, "admin")
    issueCsrfToken(res, sessionToken)
    // Second factor satisfied — remember this browser so the next 7 days need only a
    // password. The session itself stays short; this only skips the OTP.
    await trustDevice(res, admin.id, req)

    res.json({
      token,
      admin: { id: admin.id, fullName: admin.fullName, email: admin.email, role: admin.role },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Gagal memverifikasi kode." })
  }
})

// ── Session & device management (Phase 2e) ────────────────────
// "Where am I logged in, and make it stop." This is the capability sessions exist for —
// a JWT cannot be listed or revoked.

// GET /api/auth/admin/sessions → active sessions + remembered browsers
router.get("/admin/sessions", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const token = readSessionCookie(req)
    const [sessions, devices, currentId] = await Promise.all([
      listSessions({ id: req.user!.id, type: "admin" }),
      listDevices(req.user!.id),
      token ? currentSessionId(token) : Promise.resolve(null),
    ])
    res.json({
      // `current` lets the UI label "this device" and avoid offering to revoke it.
      sessions: sessions.map((s) => ({ ...s, current: s.id === currentId })),
      trustedDevices: devices,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Gagal memuat sesi." })
  }
})

// DELETE /api/auth/admin/sessions/:id → revoke one session
router.delete("/admin/sessions/:id", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    // Scoped to the caller inside revokeSessionById, so an admin cannot kill another
    // admin's session through this endpoint.
    const done = await revokeSessionById(String(req.params.id), { id: req.user!.id, type: "admin" })
    if (!done) return res.status(404).json({ message: "Sesi tidak ditemukan." })
    res.json({ message: "Sesi dihentikan." })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Gagal menghentikan sesi." })
  }
})

// DELETE /api/auth/admin/sessions → revoke everything, including remembered browsers.
// The blunt instrument for "I think someone else is in".
router.delete("/admin/sessions", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const [sessions, devices] = await Promise.all([
      revokeAllSessions({ id: req.user!.id, type: "admin" }),
      revokeAllDevices(req.user!.id),
    ])
    res.json({ message: "Semua sesi dihentikan.", sessionsRevoked: sessions, devicesForgotten: devices })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Gagal menghentikan sesi." })
  }
})

export default router
