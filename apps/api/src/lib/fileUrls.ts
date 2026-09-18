// src/lib/fileUrls.ts
//
// Signed URLs for /api/files.
//
// The file route has to stay cookie-less and header-less: a browser cannot attach an
// Authorization header to <img src>, which is exactly why files.ts was left public. A signed
// URL solves that without waiting for the cookie-auth rehaul — the proof of authorisation
// travels in the URL itself, so <img> works unchanged.
//
// Only the API mints these (StorageAdapter.getUrl), and it only does so inside a response
// the caller was already authorised to receive. So possessing a valid file URL means the
// server handed it to you.
//
// ⚠️ Why the expiry is bucketed rather than "now + TTL":
// the dashboard re-fetches every 8s, and every response regenerates file URLs. If the
// signature changed each time, the <img src> would change each time, so the browser could
// never cache a photo and would re-download it on every poll — ruinous for full-size
// evidence photos on a limited office uplink. Rounding the expiry to a fixed boundary makes
// the URL byte-identical for every response inside the same bucket, so it caches normally
// and rotates once per bucket.
//
// Trade-offs worth knowing:
//   • The signature is in the URL, so it appears in logs and Referer headers. Bounded by the
//     TTL rather than eliminated — that is inherent to signed URLs.
//   • A URL pasted somewhere durable (a WhatsApp message, a bookmark) stops working after
//     the TTL. If a file URL ever needs to survive longer, mint it deliberately with a
//     longer window rather than raising the global TTL.

import crypto from "node:crypto"

// Bucket size. A URL is valid for between TTL and 2×TTL depending on where in the bucket it
// was minted, and is stable (therefore cacheable) for the remainder of its bucket.
const DEFAULT_TTL_MS = 60 * 60 * 1000 // 1 hour

function ttlMs(): number {
  const raw = Number.parseInt(process.env.FILE_URL_TTL_MINUTES ?? "", 10)
  return Number.isInteger(raw) && raw > 0 ? raw * 60 * 1000 : DEFAULT_TTL_MS
}

// Dedicated secret if provided, else reuse JWT_SECRET so this works with no new config.
// Rotating either invalidates outstanding file URLs, which self-heal on the next page load.
function secret(): string {
  const s = process.env.FILE_URL_SECRET || process.env.JWT_SECRET
  if (!s) throw new Error("FILE_URL_SECRET or JWT_SECRET must be set to sign file URLs.")
  return s
}

function hmac(key: string, exp: number): string {
  return crypto.createHmac("sha256", secret()).update(`${key}:${exp}`).digest("base64url")
}

/** Expiry for the current bucket. Constant within a bucket → identical, cacheable URLs. */
function currentExpiry(): number {
  const ttl = ttlMs()
  return (Math.floor(Date.now() / ttl) + 2) * ttl
}

/** Append a signature to a file key, producing a relative URL for the client. */
export function signFileUrl(key: string): string {
  const exp = currentExpiry()
  // The key is part of the signed payload, so a signature can't be lifted onto another file.
  return `/api/files/${key}?exp=${exp}&sig=${hmac(key, exp)}`
}

/** Validate `?exp`/`?sig` for `key`. Returns why it failed, for server-side logging only. */
export function verifyFileUrl(
  key: string,
  exp: unknown,
  sig: unknown,
): { ok: true } | { ok: false; reason: string } {
  if (typeof exp !== "string" || typeof sig !== "string") {
    return { ok: false, reason: "missing-signature" }
  }
  const expNum = Number(exp)
  if (!Number.isFinite(expNum)) return { ok: false, reason: "bad-expiry" }
  if (expNum < Date.now()) return { ok: false, reason: "expired" }

  const expected = hmac(key, expNum)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  // Length check first: timingSafeEqual throws on a length mismatch.
  if (a.length !== b.length) return { ok: false, reason: "bad-signature" }
  if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: "bad-signature" }
  return { ok: true }
}
