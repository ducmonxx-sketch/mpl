// src/lib/turnstile.ts
//
// Server-side verification for Cloudflare Turnstile.
//
// Why this exists: the SPA already renders a Turnstile widget and obtains tokens, but
// nothing ever validated them — `CloudflareTurnstile.jsx` still carries a literal
// "TODO: Send this token to your backend for server-side verification". An unverified token
// provides **zero** protection: the widget is client-side decoration, and any caller can
// skip it entirely with a direct request. Verification has to happen here or not at all.
//
// ⚠️ Current state of the frontend (2026-09-18), because it changes what this can protect:
//   • HomePage.jsx renders the widget with NO props, so its token is discarded.
//   • DeactivateModal.jsx (client dashboard) uses the token only to enable a button.
//   • No login / registration / password-reset form uses the widget at all.
// So today no attackable endpoint receives a token. This module is the prerequisite half;
// the forms still need wiring, which is client-facing work (see DEV-PLAN).
//
// Because of that, `requireTurnstile` is deliberately NOT fail-closed by default — see the
// comment on TURNSTILE_ENFORCE below.

import { Response, NextFunction } from "express"
import { AuthRequest } from "../middleware/auth"

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

// Cloudflare's documented always-passes secret, the counterpart to the test site key the
// widget uses on localhost. https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const TEST_SECRET = "1x0000000000000000000000000000000AA"

export interface TurnstileResult {
  success: boolean
  errorCodes: string[]
}

/**
 * Validate a Turnstile token against Cloudflare's siteverify API.
 *
 * Tokens are **single-use and expire after ~300s**, so this must be called at most once per
 * token — a retry with the same token fails with `timeout-or-duplicate`.
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    return { success: false, errorCodes: ["missing-secret-key"] }
  }

  const body = new URLSearchParams({ secret, response: token })
  // Optional but recommended: lets Cloudflare factor the caller's address into scoring.
  // Only meaningful once `trust proxy` is configured, otherwise this is the proxy's IP.
  if (remoteIp) body.set("remoteip", remoteIp)

  try {
    // Never let a slow/unreachable Cloudflare hang a request thread.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return { success: false, errorCodes: [`siteverify-http-${res.status}`] }
    }
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] }
    return {
      success: data.success === true,
      errorCodes: data["error-codes"] ?? [],
    }
  } catch (err) {
    // Network failure or the 5s abort. Treated as a verification failure, but the caller
    // decides whether that blocks the request (see requireTurnstile).
    return {
      success: false,
      errorCodes: [err instanceof Error && err.name === "AbortError" ? "siteverify-timeout" : "siteverify-unreachable"],
    }
  }
}

let warnedMissingSecret = false

/**
 * Express middleware. Reads the token from `captchaToken` / `turnstileToken` in the body, or
 * the `cf-turnstile-response` header.
 *
 * Behaviour is intentionally in three tiers:
 *
 *  1. **No `TURNSTILE_SECRET_KEY` configured** → skip, warn once at runtime. Keeps local dev
 *     and the current deployment working rather than 500-ing every public endpoint.
 *  2. **Token present** → always verified. A bad token is rejected with 403 regardless of the
 *     enforce flag, so the check can never be cosmetic for a caller that does send one.
 *  3. **Token absent** → rejected only when `TURNSTILE_ENFORCE=true`.
 *
 * Tier 3 is a flag rather than the default because no frontend form sends a token yet;
 * failing closed now would break client registration and password reset, which are
 * client-facing flows outside this workstream. **Flip TURNSTILE_ENFORCE=true at launch, once
 * the forms are wired** — otherwise the protection stays optional and therefore useless.
 */
export async function requireTurnstile(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true
      console.warn(
        "[turnstile] TURNSTILE_SECRET_KEY is not set — bot protection is DISABLED on public endpoints. " +
        `Set it (dev/test value: ${TEST_SECRET}) before exposing this API.`,
      )
    }
    return next()
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  const raw = body.captchaToken ?? body.turnstileToken ?? req.get("cf-turnstile-response")
  const token = typeof raw === "string" ? raw.trim() : ""

  if (!token) {
    if (process.env.TURNSTILE_ENFORCE === "true") {
      res.status(400).json({ message: "Verifikasi captcha diperlukan." })
      return
    }
    return next()
  }

  const result = await verifyTurnstileToken(token, req.ip)
  if (!result.success) {
    // Logged server-side only — the error codes describe our own configuration and are not
    // useful to a caller.
    console.warn("[turnstile] verification failed:", result.errorCodes.join(", "))
    res.status(403).json({ message: "Verifikasi captcha gagal. Silakan coba lagi." })
    return
  }

  next()
}
