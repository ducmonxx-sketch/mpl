// src/lib/csrf.ts
//
// Phase 2b — CSRF protection (DEPLOYMENT-NAS.md §5.2).
//
// Why this becomes necessary the moment cookies carry auth: a browser attaches cookies to
// cross-site requests automatically, so any page on the internet could trigger a
// state-changing call as a logged-in admin. Bearer tokens do not have this problem — an
// attacker cannot set an Authorization header cross-site — which is why the current frontend
// needs no protection, and why enforcement here is CONDITIONAL:
//
//   - safe method (GET/HEAD/OPTIONS)  -> skip
//   - no session cookie on request    -> skip (Bearer path, immune)
//   - otherwise                       -> require a valid token
//
// That conditionality is what keeps this non-breaking before the 2f cutover.
//
// ⚠️ Do not rely on SameSite alone. SameSite=Lax does block cross-SITE POSTs, but "site"
// means registrable domain: app.<domain> -> api.<domain> is SAME-site, so a compromised or
// stale subdomain could still forge requests. And if the client app ends up on a different
// registrable domain (a Vercel/Netlify URL, which §2 explicitly contemplates), SameSite=None
// becomes necessary and that protection disappears entirely. Tokens cover both cases.
//
// ⚠️ CORS is NOT CSRF protection. CORS governs whether a response may be READ; a
// state-changing request has already been delivered by that point.

import crypto from "node:crypto"
import type { Request, Response, NextFunction } from "express"
import { readSessionCookie } from "./session"

export const CSRF_COOKIE = "mpl_csrf"
export const CSRF_HEADER = "x-csrf-token"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

// Exempt endpoints, each for a specific reason:
//   login/register - no session exists yet when they are called, and a second login while
//                    already holding a cookie must not fail for want of a token.
//   logout         - forging a logout is a nuisance, not a breach, and requiring a token
//                    would make logout impossible whenever the CSRF cookie is missing.
//   csrf           - it is a GET anyway; listed for clarity.
const EXEMPT = new Set([
  "/api/auth/login",
  "/api/auth/admin/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/csrf",
])

function secret(): string {
  const s = process.env.CSRF_SECRET || process.env.JWT_SECRET
  if (!s) throw new Error("CSRF_SECRET or JWT_SECRET must be set to sign CSRF tokens.")
  return s
}

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex")

/**
 * Signed double-submit. The token is `nonce.hmac`, where the HMAC covers the nonce AND a
 * hash of the session token — so a token is bound to one session and cannot be forged by an
 * attacker who can merely set cookies on the domain, which is plain double-submit's weak
 * spot.
 */
function mint(sessionToken: string): string {
  const nonce = crypto.randomBytes(16).toString("base64url")
  const sig = crypto
    .createHmac("sha256", secret())
    .update(nonce + "." + sha256(sessionToken))
    .digest("base64url")
  return nonce + "." + sig
}

function verify(token: string, sessionToken: string): boolean {
  const dot = token.lastIndexOf(".")
  if (dot <= 0) return false
  const nonce = token.slice(0, dot)
  const expected = crypto
    .createHmac("sha256", secret())
    .update(nonce + "." + sha256(sessionToken))
    .digest("base64url")
  const a = Buffer.from(token.slice(dot + 1))
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const part of header.split(";")) {
    const eq = part.indexOf("=")
    if (eq > 0 && part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim())
    }
  }
  return undefined
}

/**
 * Issue (or rotate) a CSRF token bound to `sessionToken`. Readable by JS on purpose.
 *
 * The session token is passed in rather than read from the request: at login the session
 * cookie has only been set on the RESPONSE, so reading it back off `req` finds nothing and
 * silently produces no token.
 */
export function issueCsrfToken(res: Response, sessionToken: string): string {
  const token = mint(sessionToken)
  res.cookie(CSRF_COOKIE, token, {
    // NOT httpOnly: the frontend must read this to echo it back in the header. That is safe —
    // the value is useless without the matching session cookie, which IS httpOnly.
    httpOnly: false,
    secure:
      process.env.SESSION_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
    sameSite: (process.env.SESSION_COOKIE_SAMESITE || "lax").toLowerCase() as
      | "lax"
      | "strict"
      | "none",
    path: "/",
    ...(process.env.SESSION_COOKIE_DOMAIN ? { domain: process.env.SESSION_COOKIE_DOMAIN } : {}),
  })
  return token
}

/** Convenience for routes that already have a request carrying the session cookie. */
export function issueCsrfTokenFromRequest(req: Request, res: Response): string | null {
  const sessionToken = readSessionCookie(req)
  if (!sessionToken) return null
  return issueCsrfToken(res, sessionToken)
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next()
  if (EXEMPT.has(req.path)) return next()

  const sessionToken = readSessionCookie(req)
  // No session cookie: this is the Bearer path, or unauthenticated. Immune either way.
  if (!sessionToken) return next()

  // Defence in depth. A browser always sends Origin on a cross-origin state-changing
  // request, so if one is present it must be allowlisted. Absent is allowed, because
  // same-origin requests and non-browser callers may legitimately omit it.
  const origin = req.get("origin")
  if (origin) {
    const allowed = [
      process.env.CLIENT_URL,
      process.env.ADMIN_URL,
      ...(process.env.CORS_ORIGINS?.split(",") ?? []),
    ]
      .map((o) => o?.trim())
      .filter((o): o is string => Boolean(o))
    if (allowed.length > 0 && !allowed.includes(origin)) {
      return res.status(403).json({ message: "Origin tidak diizinkan." })
    }
  }

  const header = req.get(CSRF_HEADER)
  const cookie = readCookie(req, CSRF_COOKIE)
  if (!header || !cookie || header !== cookie || !verify(header, sessionToken)) {
    return res.status(403).json({ message: "CSRF token tidak valid. Muat ulang halaman." })
  }
  next()
}
