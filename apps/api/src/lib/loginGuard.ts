// src/lib/loginGuard.ts
//
// Phase 2c — failed-login lockout (DEPLOYMENT-NAS.md §3 Layer 3, "per account *and* per IP").
//
// Before this, the only brake on password guessing was the /api/auth rate limiter at
// 50/15min — and that is per-IP only. So an attacker with a handful of IPs could grind a
// single admin account indefinitely, and nothing at all tracked failures per account.
//
// Two axes, because either alone is bypassable:
//   • per-email → one account can't be attacked from many IPs
//   • per-IP    → one host can't spray many accounts
//
// ⚠️ Deliberate trade-off: an email lockout is itself a denial-of-service vector — anyone can
// lock a known admin out by failing logins against their address. Mitigated by making the
// lock SHORT and self-expiring (no admin intervention, no permanent disable) rather than
// sticky. For this deployment the exposure is further reduced by Cloudflare Access, which
// gates who can even reach the login page. If staff report being locked out unexpectedly,
// that is the signal to look at — not a bug to tune away.

import prisma from "./prisma"

const num = (name: string, def: number) => {
  const v = Number.parseInt(process.env[name] ?? "", 10)
  return Number.isInteger(v) && v > 0 ? v : def
}

const WINDOW_MIN      = () => num("LOGIN_WINDOW_MINUTES", 15)
const MAX_PER_EMAIL   = () => num("LOGIN_MAX_FAILURES_PER_EMAIL", 5)
const MAX_PER_IP      = () => num("LOGIN_MAX_FAILURES_PER_IP", 20)
const LOCKOUT_MIN     = () => num("LOGIN_LOCKOUT_MINUTES", 15)

export interface LockoutState {
  locked: boolean
  retryAfterSeconds: number
}

/**
 * Is this (email, ip) currently locked out? Counts failures inside the window, ignoring
 * anything before the caller's most recent SUCCESS so a successful login resets the count.
 */
export async function checkLockout(email: string, ip?: string): Promise<LockoutState> {
  const since = new Date(Date.now() - WINDOW_MIN() * 60 * 1000)
  const normalised = email.trim().toLowerCase()

  const lastSuccess = await prisma.loginAttempt.findFirst({
    where: { email: normalised, success: true, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })
  const emailSince = lastSuccess ? lastSuccess.createdAt : since

  const [emailFails, ipFails] = await Promise.all([
    prisma.loginAttempt.count({
      where: { email: normalised, success: false, createdAt: { gte: emailSince } },
    }),
    ip
      ? prisma.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } })
      : Promise.resolve(0),
  ])

  if (emailFails < MAX_PER_EMAIL() && ipFails < MAX_PER_IP()) {
    return { locked: false, retryAfterSeconds: 0 }
  }

  // Lock runs from the most recent failure, so continued guessing extends it.
  const newest = await prisma.loginAttempt.findFirst({
    where: {
      success: false,
      createdAt: { gte: since },
      ...(emailFails >= MAX_PER_EMAIL() ? { email: normalised } : { ip }),
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })
  const until = (newest?.createdAt.getTime() ?? Date.now()) + LOCKOUT_MIN() * 60 * 1000
  const retry = Math.max(1, Math.ceil((until - Date.now()) / 1000))
  return { locked: retry > 0, retryAfterSeconds: retry }
}

/** Record an attempt. Always called, success or failure — successes reset the email counter. */
export async function recordAttempt(
  email: string,
  ip: string | undefined,
  success: boolean,
  kind: "admin" | "client",
): Promise<void> {
  await prisma.loginAttempt
    .create({
      data: { email: email.trim().toLowerCase(), ip: ip ?? null, success, kind },
    })
    .catch((err) => {
      // Never let bookkeeping break a login.
      console.error("[loginGuard] failed to record attempt:", err)
    })
}

/** Housekeeping — safe to run from a scheduler. */
export async function pruneLoginAttempts(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const res = await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } })
  return res.count
}
