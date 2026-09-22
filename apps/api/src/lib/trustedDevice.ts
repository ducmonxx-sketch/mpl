// src/lib/trustedDevice.ts
//
// Phase 2e — "don't ask for an email code on this browser for 7 days."
//
// Kept deliberately separate from Session rather than simply making sessions 7 days long.
// The distinction matters: a session cookie is the thing an attacker replays to BE you, so
// it stays short (8h absolute / 2h idle). This cookie only records that the second factor
// was satisfied recently — its entire capability is "let a password login skip the OTP",
// which is far weaker than a session.
//
// So the posture is:
//   session        → short, revocable, the actual credential
//   trusted device → 7 days, only removes the OTP step, still needs the password
//
// Security properties:
//   • httpOnly, so page JavaScript cannot read it.
//   • Only a SHA-256 is stored, so a leaked DB yields no OTP-skipping devices.
//   • Bound to one admin: a device trusted for A cannot skip the OTP for B.
//   • Revoked on password change — if you changed it because you suspect someone is in,
//     their remembered browser must stop bypassing the second factor.

import crypto from "node:crypto"
import type { Request, Response } from "express"
import prisma from "./prisma"

export const DEVICE_COOKIE = process.env.TRUSTED_DEVICE_COOKIE_NAME || "mpl_device"

const DAYS = () => {
  const v = Number.parseInt(process.env.TRUSTED_DEVICE_DAYS ?? "7", 10)
  return Number.isInteger(v) && v > 0 ? v : 7
}

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex")

function cookieOptions() {
  const sameSite = (process.env.SESSION_COOKIE_SAMESITE || "lax").toLowerCase() as
    | "lax" | "strict" | "none"
  return {
    httpOnly: true,
    secure:
      process.env.SESSION_COOKIE_SECURE === "true" ||
      sameSite === "none" ||
      process.env.NODE_ENV === "production",
    sameSite,
    path: "/",
    ...(process.env.SESSION_COOKIE_DOMAIN ? { domain: process.env.SESSION_COOKIE_DOMAIN } : {}),
  }
}

function readDeviceCookie(req: Request): string | undefined {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const part of header.split(";")) {
    const eq = part.indexOf("=")
    if (eq > 0 && part.slice(0, eq).trim() === DEVICE_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1).trim())
    }
  }
  return undefined
}

/** Remember this browser for the configured window. Called after a successful OTP. */
export async function trustDevice(res: Response, adminId: string, req?: Request): Promise<void> {
  const token = crypto.randomBytes(32).toString("base64url")
  const maxAgeMs = DAYS() * 24 * 60 * 60 * 1000

  await prisma.trustedDevice.create({
    data: {
      adminId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + maxAgeMs),
      userAgent: req?.get("user-agent")?.slice(0, 300) ?? null,
      ip: req?.ip ?? null,
    },
  })

  res.cookie(DEVICE_COOKIE, token, { ...cookieOptions(), maxAge: maxAgeMs })
}

/**
 * Is this request coming from a browser already trusted FOR THIS ADMIN?
 *
 * Returns false on anything doubtful — no cookie, unknown, revoked, expired, or belonging to
 * a different admin — so the OTP is simply required, which is the safe default.
 */
export async function isDeviceTrusted(req: Request, adminId: string): Promise<boolean> {
  const token = readDeviceCookie(req)
  if (!token) return false

  const device = await prisma.trustedDevice.findUnique({
    where: { tokenHash: sha256(token) },
    select: { id: true, adminId: true, expiresAt: true, revokedAt: true },
  })
  if (!device) return false
  // The binding check: a cookie trusted for one admin must not skip the OTP for another.
  if (device.adminId !== adminId) return false
  if (device.revokedAt) return false
  if (device.expiresAt.getTime() <= Date.now()) return false

  await prisma.trustedDevice
    .update({ where: { id: device.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {})
  return true
}

/** Forget the browser making this request ("this isn't my device"). */
export async function forgetThisDevice(req: Request, res: Response): Promise<void> {
  const token = readDeviceCookie(req)
  if (token) {
    await prisma.trustedDevice
      .updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } })
      .catch(() => {})
  }
  res.clearCookie(DEVICE_COOKIE, cookieOptions())
}

/** Forget every remembered browser for an admin. Used on password change. */
export async function revokeAllDevices(adminId: string): Promise<number> {
  const res = await prisma.trustedDevice.updateMany({
    where: { adminId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return res.count
}

export async function listDevices(adminId: string) {
  return prisma.trustedDevice.findMany({
    where: { adminId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
    select: { id: true, createdAt: true, lastUsedAt: true, expiresAt: true, userAgent: true, ip: true },
  })
}

/** Housekeeping — safe to run from a scheduler. */
export async function pruneTrustedDevices(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const res = await prisma.trustedDevice.deleteMany({
    where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
  })
  return res.count
}
