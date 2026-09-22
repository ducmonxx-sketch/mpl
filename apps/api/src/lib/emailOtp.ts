// src/lib/emailOtp.ts
//
// Phase 2d (email variant) — admin 2FA by emailed one-time code.
//
// Replaces the TOTP implementation. Chosen for staff usability: nothing to install, no QR to
// scan, and no lost-phone lockout. There is also NO enrolment step — every admin already has
// an email address — so 2FA is simply on or off globally via ADMIN_2FA_EMAIL, which is a
// good deal simpler than TOTP's per-account setup/enable/disable/reset lifecycle.
//
// ── Accepted trade-offs (user decision 2026-09-22) ──
//   • Weaker than TOTP: whoever controls the mailbox holds the second factor AND the
//     password-reset channel. Accepted because a VPN is planned in front of the admin
//     panel, so an attacker would need network access too — that becomes the real control.
//   • Availability: if SMTP breaks or hits a daily cap, nobody can log in. TOTP had no such
//     dependency. The mitigation is the ADMIN_2FA_EMAIL kill switch.
//
// ── Why this is NOT "emailing a TOTP code" ──
// TOTP codes are derived on the device from a shared secret plus the clock; emailing one
// would defeat the point. This is a plain one-time code: random, server-generated,
// server-remembered, single-use, short-lived.
//
// Security properties:
//   • Only a SHA-256 of the code is stored, so a leaked DB or backup yields no live codes.
//   • Single-use, short expiry, and a per-code attempt cap — six digits is a million
//     combinations, but a code lives for minutes, so the per-code cap is what closes it.
//   • Issuing a new code invalidates any earlier one, so a resend can't widen the window.
//   • The challenge is opaque: verification needs the challenge id AND the code.

import crypto from "node:crypto"
import prisma from "./prisma"
import { sendEmail } from "../services/email"

const num = (name: string, def: number) => {
  const v = Number.parseInt(process.env[name] ?? "", 10)
  return Number.isInteger(v) && v > 0 ? v : def
}

const TTL_MINUTES  = () => num("ADMIN_2FA_TTL_MINUTES", 10)
const MAX_ATTEMPTS = () => num("ADMIN_2FA_MAX_ATTEMPTS", 5)
/** Resends allowed per admin inside the TTL window, to bound email cost and inbox spam. */
const MAX_PER_WINDOW = () => num("ADMIN_2FA_MAX_PER_WINDOW", 5)

export function isEmailOtpEnabled(): boolean {
  return process.env.ADMIN_2FA_EMAIL === "true"
}

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex")

/** Six digits, uniformly distributed. randomInt is rejection-sampled, unlike % on a random byte. */
function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0")
}

export interface Challenge {
  challengeId: string
  /** Populated only when SMTP is unconfigured, so local dev can complete the flow. */
  devCode?: string
  emailed: boolean
}

export interface OtpResult {
  ok: boolean
  adminId?: string
  reason?: "not-found" | "expired" | "used" | "too-many-attempts" | "invalid"
}

/**
 * Create a code, email it, and return an opaque challenge id.
 *
 * Any earlier unused code for this admin is consumed first, so only the newest is live.
 */
export async function createEmailOtp(
  admin: { id: string; email: string; fullName: string },
  ip?: string,
): Promise<Challenge | { rateLimited: true; retryAfterSeconds: number }> {
  const windowStart = new Date(Date.now() - TTL_MINUTES() * 60 * 1000)
  const recent = await prisma.emailOtp.count({
    where: { adminId: admin.id, createdAt: { gte: windowStart } },
  })
  if (recent >= MAX_PER_WINDOW()) {
    return { rateLimited: true, retryAfterSeconds: TTL_MINUTES() * 60 }
  }

  // Invalidate any outstanding code so a resend replaces rather than adds.
  await prisma.emailOtp.updateMany({
    where: { adminId: admin.id, usedAt: null },
    data: { usedAt: new Date() },
  })

  const code = generateCode()
  const row = await prisma.emailOtp.create({
    data: {
      adminId: admin.id,
      codeHash: sha256(code),
      expiresAt: new Date(Date.now() + TTL_MINUTES() * 60 * 1000),
      ip: ip ?? null,
    },
    select: { id: true },
  })

  const emailed = await sendEmail(
    admin.email,
    `Kode masuk MPL: ${code}`,
    `<p>Halo ${admin.fullName},</p>
     <p>Kode masuk Anda adalah:</p>
     <p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
     <p>Kode ini berlaku ${TTL_MINUTES()} menit dan hanya bisa dipakai sekali.</p>
     <p>Jika Anda tidak mencoba masuk, abaikan email ini dan segera ganti password Anda.</p>`,
  )

  // sendEmail() returns false when SMTP is unconfigured (it warns rather than throwing).
  // Surfacing the code in that case is what lets the flow be developed and tested before
  // SMTP credentials exist. Gated on NODE_ENV so it can never leak in production.
  const devCode = !emailed && process.env.NODE_ENV !== "production" ? code : undefined
  if (devCode) {
    console.warn(`[emailOtp] SMTP not configured — dev code for ${admin.email}: ${code}`)
  }

  return { challengeId: row.id, emailed, devCode }
}

/** Verify a code against a challenge. Consumes the challenge on success. */
export async function verifyEmailOtp(challengeId: string, code: string): Promise<OtpResult> {
  const row = await prisma.emailOtp.findUnique({
    where: { id: challengeId },
    select: { id: true, adminId: true, codeHash: true, expiresAt: true, usedAt: true, attempts: true },
  })
  if (!row) return { ok: false, reason: "not-found" }
  if (row.usedAt) return { ok: false, reason: "used" }
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" }
  if (row.attempts >= MAX_ATTEMPTS()) return { ok: false, reason: "too-many-attempts" }

  // Count the attempt BEFORE comparing, so a crash mid-verify can't hand back a free guess.
  await prisma.emailOtp.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } })

  const supplied = sha256((code ?? "").trim())
  const a = Buffer.from(supplied)
  const b = Buffer.from(row.codeHash)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "invalid" }
  }

  await prisma.emailOtp.update({ where: { id: row.id }, data: { usedAt: new Date() } })
  return { ok: true, adminId: row.adminId }
}

/** Housekeeping — safe to run from a scheduler. */
export async function pruneEmailOtps(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const res = await prisma.emailOtp.deleteMany({ where: { createdAt: { lt: cutoff } } })
  return res.count
}
