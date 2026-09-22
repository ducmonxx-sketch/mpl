// src/lib/session.ts
//
// Phase 2a — server-side sessions (DEPLOYMENT-NAS.md §5.2).
//
// Chosen over JWT-in-cookie because a JWT cannot be un-issued, and instant revocation is the
// whole point for an internet-facing admin panel: removing an account or changing a role has
// to take effect now, not in up to 7 days.
//
// ⚠️ This is deliberately ADDITIVE. Login creates a session AND still returns the body token,
// and `authenticate` reads the cookie first but falls back to Bearer. So nothing breaks while
// the frontend still uses localStorage — the cutover (2f) is a separate, coordinated step.
//
// Security choices worth keeping:
//   • The cookie carries a 32-byte random token; the DB stores only its SHA-256. A leaked
//     backup or DB dump therefore yields no usable sessions. (MagicLink/reset tokens are
//     still stored raw — lower risk as they're single-use and short-lived, but worth fixing.)
//   • Two independent expiries: an absolute lifetime and an idle timeout. Today's Bearer JWT
//     lives 7 days, which is far too long for a publicly reachable admin panel.
//   • Cookie attributes are env-driven, because `Secure`/`SameSite` depend on the final
//     domains and on the §1 LAN-fallback constraint (admin must resolve under one HTTPS
//     hostname from both the LAN and the tunnel).

import crypto from "node:crypto"
import type { Request, Response } from "express"
import prisma from "./prisma"

export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || "mpl_session"

// Admin sessions are deliberately short: the admin panel is the high-value,
// internet-facing target. Client sessions keep the long life they already had — clients are
// far lower risk, and shortening theirs as a side effect of the admin hardening would just
// log them out mid-errand. Sending cookies from the shared api.js would otherwise have done
// exactly that, since client logins create sessions too.
const ABSOLUTE_HOURS = Number.parseInt(process.env.SESSION_ABSOLUTE_HOURS ?? "8", 10) || 8
const IDLE_MINUTES = Number.parseInt(process.env.SESSION_IDLE_MINUTES ?? "120", 10) || 120
const CLIENT_ABSOLUTE_HOURS = Number.parseInt(process.env.CLIENT_SESSION_ABSOLUTE_HOURS ?? "168", 10) || 168
const CLIENT_IDLE_MINUTES = Number.parseInt(process.env.CLIENT_SESSION_IDLE_MINUTES ?? "10080", 10) || 10080

const absoluteHoursFor = (type: "user" | "admin") =>
  type === "admin" ? ABSOLUTE_HOURS : CLIENT_ABSOLUTE_HOURS
const idleMinutesFor = (type: "user" | "admin") =>
  type === "admin" ? IDLE_MINUTES : CLIENT_IDLE_MINUTES

// lastSeenAt drives the idle timeout, but writing it on every request would mean ~450 writes
// an hour per admin from the dashboard poll alone. Only persist it once it's this stale.
const TOUCH_THROTTLE_MS = 5 * 60 * 1000

export interface Principal {
  id: string
  role: string
  type: "user" | "admin"
}

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex")

function cookieOptions() {
  const sameSite = (process.env.SESSION_COOKIE_SAMESITE || "lax").toLowerCase() as
    | "lax" | "strict" | "none"
  return {
    httpOnly: true,
    // Must be false for local http dev, true in production. `SameSite=None` is meaningless
    // without Secure, so force it on in that case.
    secure:
      process.env.SESSION_COOKIE_SECURE === "true" ||
      sameSite === "none" ||
      process.env.NODE_ENV === "production",
    sameSite,
    path: "/",
    ...(process.env.SESSION_COOKIE_DOMAIN ? { domain: process.env.SESSION_COOKIE_DOMAIN } : {}),
  }
}

/** Express has res.cookie() built in, but no cookie *parser* — one cookie doesn't justify a dep. */
export function readSessionCookie(req: Request): string | undefined {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const part of header.split(";")) {
    const eq = part.indexOf("=")
    if (eq < 0) continue
    if (part.slice(0, eq).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1).trim())
    }
  }
  return undefined
}

/** Create a session row and set the cookie. Returns the raw token (for tests/debugging). */
export async function startSession(
  res: Response,
  principal: Principal,
  req?: Request,
): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url")
  const hours = absoluteHoursFor(principal.type)
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000)

  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      expiresAt,
      ...(principal.type === "admin" ? { adminId: principal.id } : { userId: principal.id }),
      userAgent: req?.get("user-agent")?.slice(0, 300) ?? null,
      // Only meaningful once trust proxy is configured, otherwise this is the proxy's address.
      ip: req?.ip ?? null,
    },
  })

  res.cookie(SESSION_COOKIE, token, {
    ...cookieOptions(),
    maxAge: hours * 60 * 60 * 1000,
  })
  return token
}

/**
 * Resolve a cookie token to a principal, or null. Enforces revocation, absolute expiry and
 * the idle timeout, and lazily refreshes lastSeenAt.
 */
export async function resolveSession(token: string): Promise<Principal | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    select: {
      id: true, adminId: true, userId: true, expiresAt: true, revokedAt: true, lastSeenAt: true,
      admin: { select: { role: true } },
    },
  })
  if (!session) return null

  const now = Date.now()
  if (session.revokedAt) return null
  if (session.expiresAt.getTime() <= now) return null
  const idleLimit = idleMinutesFor(session.adminId ? "admin" : "user") * 60 * 1000
  if (now - session.lastSeenAt.getTime() > idleLimit) {
    // Idle too long. Revoke rather than just refusing, so the row can't be revived by a
    // later request that happens to arrive inside a fresh idle window.
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } })
    return null
  }

  if (now - session.lastSeenAt.getTime() > TOUCH_THROTTLE_MS) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
  }

  if (session.adminId) {
    // Role is read from the Admin row, not stored in the session — so a role change takes
    // effect on the next request instead of being frozen at login time.
    return { id: session.adminId, role: session.admin?.role ?? "OPERATIONS", type: "admin" }
  }
  if (session.userId) return { id: session.userId, role: "user", type: "user" }
  return null
}

/** Revoke the session behind this cookie (logout) and clear the cookie. */
export async function endSession(req: Request, res: Response): Promise<void> {
  const token = readSessionCookie(req)
  if (token) {
    await prisma.session
      .updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } })
      .catch(() => {})
  }
  res.clearCookie(SESSION_COOKIE, cookieOptions())
}

/**
 * Revoke every session for a principal. Call this when a role changes, an account is
 * disabled or removed, or a password is reset — that is the capability JWTs cannot offer.
 */
export async function revokeAllSessions(principal: Pick<Principal, "id" | "type">): Promise<number> {
  const res = await prisma.session.updateMany({
    where: {
      revokedAt: null,
      ...(principal.type === "admin" ? { adminId: principal.id } : { userId: principal.id }),
    },
    data: { revokedAt: new Date() },
  })
  return res.count
}

/** Housekeeping: drop rows that are long dead. Safe to run from a scheduler. */
export async function pruneExpiredSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const res = await prisma.session.deleteMany({
    where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
  })
  return res.count
}

/** Active sessions for a principal — powers the "where am I logged in" view. */
export async function listSessions(principal: Pick<Principal, "id" | "type">) {
  return prisma.session.findMany({
    where: {
      revokedAt: null,
      expiresAt: { gt: new Date() },
      ...(principal.type === "admin" ? { adminId: principal.id } : { userId: principal.id }),
    },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, createdAt: true, lastSeenAt: true, expiresAt: true, userAgent: true, ip: true },
  })
}

/** Revoke one session by id, scoped to its owner so nobody can kill someone else's. */
export async function revokeSessionById(
  id: string,
  principal: Pick<Principal, "id" | "type">,
): Promise<boolean> {
  const res = await prisma.session.updateMany({
    where: {
      id,
      revokedAt: null,
      ...(principal.type === "admin" ? { adminId: principal.id } : { userId: principal.id }),
    },
    data: { revokedAt: new Date() },
  })
  return res.count > 0
}

/** Identify the caller's own session, so the UI can label it and avoid self-revoking. */
export async function currentSessionId(token: string): Promise<string | null> {
  const row = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    select: { id: true },
  })
  return row?.id ?? null
}
