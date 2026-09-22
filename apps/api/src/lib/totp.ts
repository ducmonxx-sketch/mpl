// src/lib/totp.ts
//
// Phase 2d — admin two-factor auth via TOTP (DEPLOYMENT-NAS.md §5.2).
//
// Kept entirely in this one module so the feature can be reverted as a unit.
//
// ── Why app-level 2FA when Cloudflare Access already does email OTP ──
// Because the §1 LAN fallback bypasses Access completely. On-site staff reach the admin
// panel over the local network so an ISP outage doesn't lock them out — and on that path a
// password is the only factor. TOTP is the only second factor that covers BOTH routes.
//
// ── Optional and reversible, by design ──
//   • TOTP_ENABLED=false (or unset) → enforcement off entirely, no deploy needed.
//   • Per-admin opt-in: nobody is affected until they enrol, because enforcement keys off
//     `totpEnabledAt` being non-null.
//   • The migration adds NULLABLE columns only, so reverting this code leaves them unused
//     and harmless rather than breaking anything.
//
// ⚠️ `totpSecret` is stored in plaintext, and has to be: verification recomputes the code
// from the secret, so unlike a password it cannot be hashed. The control for it is
// encryption at rest (§3 Layer 5 — encrypted volume + encrypted backups), not hashing.
// Treat a DB dump as equivalent to handing over every enrolled admin's second factor.

import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from "otplib"

/** otplib v13 needs its crypto/base32 plugins supplied explicitly. */
function totp(): TOTP {
  return new TOTP({
    crypto: new NobleCryptoPlugin(),
    base32: new ScureBase32Plugin(),
  })
}

export function isTotpEnforced(): boolean {
  return process.env.TOTP_ENABLED === "true"
}

/** A fresh base32 secret. Not persisted as "enabled" until a code has been verified. */
export function generateTotpSecret(): string {
  return totp().generateSecret()
}

/**
 * The `otpauth://` URI an authenticator app consumes.
 *
 * Deliberately returned as a string rather than a rendered QR image: that keeps the `qrcode`
 * dependency out of the API, and the admin UI can render the QR (plus show the secret as
 * text, since some people cannot scan).
 */
export async function totpUri(secret: string, email: string): Promise<string> {
  return await totp().toURI({
    secret,
    label: email,
    issuer: process.env.TOTP_ISSUER || "MPL Logistics",
  })
}

export interface TotpCheck {
  valid: boolean
  /** Which 30-second step matched. Persisted to block replay of the same code. */
  timeStep?: number
  reason?: "malformed" | "invalid" | "replayed"
}

/**
 * Verify a code.
 *
 * `lastUsedStep` blocks replay: a TOTP code stays valid for its whole 30-second window, so
 * without this an intercepted code could be used again inside that window. Any step at or
 * below the last accepted one is refused.
 */
export async function verifyTotp(
  code: string,
  secret: string,
  lastUsedStep?: number | null,
): Promise<TotpCheck> {
  const token = (code ?? "").trim()
  if (!/^\d{6}$/.test(token)) return { valid: false, reason: "malformed" }

  let result: { valid: boolean; timeStep?: number }
  try {
    result = (await totp().verify(token, {
      secret,
      // Seconds of clock tolerance, not steps. Default is 0 — current period only — which
      // rejects a phone whose clock is a few seconds out. ±30s accepts the adjacent steps;
      // wider than that starts meaningfully widening the replay window.
      epochTolerance: 30,
    })) as { valid: boolean; timeStep?: number }
  } catch {
    return { valid: false, reason: "invalid" }
  }
  if (!result.valid) return { valid: false, reason: "invalid" }

  if (lastUsedStep != null && result.timeStep != null && result.timeStep <= lastUsedStep) {
    return { valid: false, reason: "replayed" }
  }
  return { valid: true, timeStep: result.timeStep }
}
