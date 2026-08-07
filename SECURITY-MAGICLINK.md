# SECURITY — Public magic-link / registration surface

> **Status: PLAN (not yet implemented).** Execute before the public client app goes live.
> Created 2026-08-07. Companion to **[DEPLOYMENT.md](DEPLOYMENT.md) §3** (auth/token rehaul) and
> **§5** (rate-limit hardening) — those still apply; this doc adds the magic-link-specific items.
> The **admin** dashboard/API stay LAN-only (DEPLOYMENT.md §1); everything below is about the
> **internet-exposed client surface only**.

---

## 1. The public attack surface

When the client app ships, these unauthenticated endpoints become internet-facing:

| Endpoint | Method | Purpose | Risk highlights |
|---|---|---|---|
| `/api/auth/register` | POST | direct client sign-up → PENDING | bcrypt DoS, spam accounts, **open sign-up vs invite-only** |
| `/api/auth/login` | POST | client login | credential brute-force, bcrypt DoS |
| `/api/auth/registration-status` | POST | poll verification status by email (NEW) | **email enumeration** |
| `/api/users/magic-link/:token` | GET | validate a registration link | token probing |
| `/api/users/magic-link/:token/register` | POST | create account from link | bcrypt DoS, input validation, token probing |
| `/api/users/reset-password/:token` | GET/POST | password reset | token probing, bcrypt DoS |
| `/api/files/*` | GET | avatars/uploads | **no rate limiter today** (DEPLOYMENT.md §5), storage-IO DoS |

Admin-only (must stay LAN / never public): `POST /api/users/magic-link` (generate), user CRUD,
`/verify`, `/reject`, all admin routes.

---

## 2. Concerns & mitigations — prioritized

### 🔴 Critical (block public launch)
- **Rate limiting on every unauth endpoint above.** The general limiter (1500/15min) is far too loose
  for `bcrypt.hash` / token-probing routes. Add a dedicated strict sub-limiter (~10–20/15min per IP)
  on register, magic-link register/validate, `registration-status`, login, reset-password. Give
  `/api/files/*` its own limiter. **Swap the in-memory store for Redis** before any multi-instance
  deploy. (This is DEPLOYMENT.md §5 — extend that list with `registration-status` and the magic-link routes.)
- **`app.set("trust proxy", 1)`** behind the LB/reverse proxy (only after confirming one hop), else the
  limiter keys on the proxy IP and is useless. (DEPLOYMENT.md §5.)
- **HTTPS/TLS** on all public surfaces; **CSP** including the API origin in `img-src` + `connect-src`. (DEPLOYMENT.md §5.)
- **Decide: open sign-up vs invite-only.** DEPLOYMENT.md §2 says *invite-only, no open sign-up*, but
  `POST /api/auth/register` + the client register form are currently **open**. Either disable direct
  registration (magic-link only) or accept it and protect it (CAPTCHA + strict limit). Pick one.

### 🟠 High
- **Input validation & caps** on `register` and magic-link `register`: email format, password policy
  (min length — none enforced today; align with the admin change-password min of 6+), field length
  caps (reject oversized `fullName`/`email`/`password` to blunt DoS). Today only
  `password === confirmPassword` + presence are checked.
- **Email enumeration.** `registration-status` and register's "Email is already registered" both reveal
  which emails exist. Mitigate: rate-limit hard, consider generic responses, and/or gate
  `registration-status` behind the magic-link token instead of raw email. (Login already returns a
  generic "invalid email or password" — keep it that way.)
- **Bot / spam registrations** on the public register (and magic-link, though the token limits that).
  Add CAPTCHA or proof-of-work if direct sign-up stays open.
- **Token-in-URL leakage.** The magic-link token rides in the URL path → can leak via `Referer`,
  history, logs. Entropy (256-bit), 7-day expiry, and one-time use are already good; add a strict
  `Referrer-Policy` (e.g. `no-referrer`) on the register page and consider a shorter expiry.

### 🟡 Medium / ongoing
- Error hygiene — never return stack traces / DB errors to the client; `console.error` server-side only.
- Ensure tokens, password hashes, and PII are never logged.
- Failed-login throttling / temporary lockout per account+IP.
- `npm audit --omit=dev` clean; `npm run security:scan` (AgentShield) clean.
- Confirm `apps/web/src/lib/api.js` sends `credentials: 'include'` and the admin `/me` gap is closed
  **if** the auth rehaul (httpOnly cookies) lands first — see DEPLOYMENT.md §3.

---

## 3. How to check (run this review every time before a public deploy)

1. `/security-review` (built-in skill) on the branch diff.
2. `security-reviewer` subagent (`.claude/agents/`) for a focused audit of the endpoints in §1.
3. `npm run security:scan` (AgentShield — config/secrets hygiene) and `npm audit --omit=dev`.
4. `deploy-preflight` skill — it already gates §3/§5; extend it to assert the §2 items here.
5. Manually walk §2 against the diff; anything unchecked is a launch blocker if 🔴.

---

## 4. Phased execution (next time)

- **Phase A — pre-public (mandatory):** strict rate limits + Redis store, `trust proxy`, HTTPS + CSP,
  open-signup decision, input validation/caps, password policy.
- **Phase B — hardening:** enumeration mitigation, CAPTCHA, `Referrer-Policy`, failed-login lockout.
- **Phase C — auth rehaul:** httpOnly-cookie + CSRF migration per DEPLOYMENT.md §3 (coordinate — touches
  shared contracts).
