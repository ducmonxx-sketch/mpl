// src/lib/cfAccess.ts
//
// Verify a Cloudflare Access identity, so app-level 2FA can be skipped when Access has
// already challenged the same person (DEPLOYMENT-NAS.md §5.2 / §1).
//
// The point: on the tunnel path Cloudflare Access already sends an email OTP. Asking for a
// second emailed code there means two emails, two codes, one factor — friction with no
// security gain. On the LAN fallback path Access is bypassed entirely, so the app's own OTP
// is the only second factor and must still apply.
//
// 🔴 THE HEADER ALONE PROVES NOTHING. `Cf-Access-Authenticated-User-Email` is just a header;
// anything can send it. Trusting it would let any caller skip 2FA by adding one line to a
// curl command. So this verifies the SIGNED JWT in `Cf-Access-Jwt-Assertion` against
// Cloudflare's published keys, checks the audience, and only then believes the email.
//
// ⚠️ FAILS CLOSED. Not configured, unreachable keys, bad signature, wrong audience, expired
// — every failure returns null, which means "app 2FA still required". The only way to skip
// is a positively verified assertion.
//
// Config (both required, else this is inert):
//   CF_ACCESS_TEAM_DOMAIN   e.g. mycompany.cloudflareaccess.com
//   CF_ACCESS_AUD           the Application Audience tag from the Access app
//
// Untestable against the real thing until Phase 0/1 stands Access up, which is precisely
// why the default is "don't skip".

import crypto from "node:crypto"
import jwt from "jsonwebtoken"
import type { Request } from "express"

interface Jwk {
  kid: string
  kty: string
  n?: string
  e?: string
  alg?: string
}

let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null
const JWKS_TTL_MS = 60 * 60 * 1000

function teamDomain(): string | null {
  const d = process.env.CF_ACCESS_TEAM_DOMAIN?.trim()
  return d ? d.replace(/^https?:\/\//, "").replace(/\/+$/, "") : null
}

export function isAccessSkipConfigured(): boolean {
  return Boolean(teamDomain() && process.env.CF_ACCESS_AUD?.trim())
}

async function getJwks(domain: string): Promise<Jwk[] | null> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`https://${domain}/cdn-cgi/access/certs`, { signal: controller.signal })
    clearTimeout(t)
    if (!res.ok) return null
    const body = (await res.json()) as { keys?: Jwk[] }
    if (!body.keys?.length) return null
    jwksCache = { keys: body.keys, fetchedAt: Date.now() }
    return body.keys
  } catch {
    // Network failure must not become an auth bypass — caller treats null as "not verified".
    return null
  }
}

/**
 * Return the email Cloudflare Access has verified for this request, or null.
 *
 * null means "no proven Access identity" and therefore "app-level 2FA still applies".
 */
export async function verifiedAccessEmail(req: Request): Promise<string | null> {
  const domain = teamDomain()
  const aud = process.env.CF_ACCESS_AUD?.trim()
  if (!domain || !aud) return null

  const token = req.get("cf-access-jwt-assertion")
  if (!token) return null

  const decoded = jwt.decode(token, { complete: true })
  const kid = decoded?.header?.kid
  if (!kid) return null

  const keys = await getJwks(domain)
  const jwk = keys?.find((k) => k.kid === kid)
  if (!jwk) return null

  try {
    // Node builds a public key straight from a JWK, so no extra dependency is needed.
    // `format: "jwk"` is supported at runtime; the JWK type lives in the global scope
    // rather than the crypto namespace, so it is cast here.
    const key = crypto.createPublicKey({ key: jwk as unknown as Parameters<typeof crypto.createPublicKey>[0], format: "jwk" } as crypto.PublicKeyInput)
    const payload = jwt.verify(token, key, {
      algorithms: ["RS256"],
      audience: aud,
      issuer: `https://${domain}`,
    }) as { email?: string }
    const email = payload.email?.trim().toLowerCase()
    return email || null
  } catch {
    return null
  }
}
