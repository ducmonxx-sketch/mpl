---
name: deploy-preflight
description: >
  Run the pre-deployment readiness gate for the MPL logistics app before any
  production/staging deploy. Produces a GO / NO-GO report covering the build &
  type checks, the DEPLOYMENT.md §5 open decisions, and the §3 rate-limit /
  auth hardening checklist. Use when the user says "deploy preflight",
  "are we ready to deploy?", "pre-launch check", "deployment readiness", or is
  about to ship to a public/cloud environment. This skill is READ-ONLY — it
  audits and reports; it never edits code or deploys.
---

# Deploy Preflight — MPL readiness gate

A **read-only** gate. Audit, then output a **GO / NO-GO** report. Do **not** edit
code, run migrations, or deploy from this skill — flag issues for the human to fix.

> Source of truth: [DEPLOYMENT.md](../../../DEPLOYMENT.md) §3 & §5 and
> [RUNBOOK.md](../../../RUNBOOK.md). If those documents have changed, they win —
> re-derive the checklist from them and note any drift in your report.

## Step 1 — Automated checks (run these, capture pass/fail)

From the repo root (`mpl/`):

| Check | Command | Fail = |
|-------|---------|--------|
| API type-check | `cd apps/api && npm run typecheck` | NO-GO |
| API smoke test | `cd apps/api && npm run smoke` | NO-GO |
| Web lint | `cd apps/web && npm run lint` | investigate (warn) |
| Web production build | `cd apps/web && npm run build` | NO-GO |
| Dependency audit | `npm audit --omit=dev` (both apps) | review highs/crits |
| Agent/secrets hygiene | `npm run security:scan` | review findings |
| Secrets not in git | `git ls-files \| grep -E "(^|/)\.env$"` (expect empty) | NO-GO if any real .env tracked |

## Step 2 — Code hardening audit (§3 + §5 rate-limit block)

Grep the codebase and confirm each item. Report ✅ done / ❌ missing / ⚠️ partial:

1. **`trust proxy`** — `app.set("trust proxy", 1)` present in `apps/api` **and**
   deployed behind exactly one proxy hop. Missing behind a LB ⇒ rate limiter
   keys on the proxy IP (useless); blind `trust proxy: true` ⇒ spoofable
   `X-Forwarded-For`. **[CRITICAL]**
2. **Strict auth sub-limiter** (~10–20/15min) on the unauthenticated account/token
   routes: `POST /api/auth/register`, `POST /api/users/magic-link/:token/register`,
   `POST /api/users/reset-password/:token`, and the token-validation `GET`s.
   Today only the general 1500/15min covers them. **[HIGH]**
3. **`/api/files/*` limiter** — it is mounted before `apiLimiter`, so it currently
   has **no** limiter (unbounded storage-IO DoS). Add its own or move it under the
   general one. **[HIGH]**
4. **Redis rate-store** (`rate-limit-redis`) before any multi-instance / cluster
   deploy — in-memory counters multiply the limit per replica. **[HIGH]**
5. **CSP includes the API origin** in **both `img-src`** (avatars/files) **and
   `connect-src`**. Lives in `apps/web/public/_headers` (Netlify/CF Pages) and
   `public/.htaccess` (Apache); **Vercel/nginx read neither** — set CSP in
   `vercel.json`/nginx conf for those hosts. **[HIGH]**
6. **`VITE_API_BASE_URL`** set at build to the real API origin (falls back to
   `http://localhost:3001` otherwise ⇒ prod breaks). **[HIGH]**
7. **Auth rehaul** (§3) — if this deploy is the public client launch, confirm the
   two code gaps are closed: `apps/web/src/lib/api.js` has `credentials: 'include'`,
   and an admin `/me` endpoint exists (`GET /api/auth/admin/me` or `/api/auth/me`).
   If auth rehaul is still deferred, state that explicitly as accepted debt. **[HIGH]**

## Step 3 — Deployment decisions (§5 checklist — confirm each is resolved)

Report each as ✅ decided / ❓ open, with the current answer if known:
- Managed Postgres host chosen + `DATABASE_URL` set (dev DB migrated → cloud)
- Public hosting chosen (frontend + API)
- Domains decided (drives `SameSite` / CORS / cookie config)
- One-backend-twice vs split-backend decision made
- Office static/public IP known for the DB firewall allowlist
- Production secrets present out-of-band: `JWT_SECRET` (+ `CSRF_SECRET` if cookies),
  real SMTP / OpenWA creds
- HTTPS/TLS terminator decided for public surfaces
- OpenWA gateway host decided + reachable from the API

## Step 4 — Output the report

```
# Deploy Preflight — <date>  →  GO | NO-GO

## Automated checks
- [pass/fail per Step 1 row, with the failing output excerpt]

## Code hardening (§3)
- [✅/❌/⚠️ per Step 2 item, most severe first, with file:line]

## Deployment decisions (§5)
- [✅/❓ per Step 3 item]

## Verdict
GO / NO-GO — <one-line reason>. Blocking items: <list, or "none">.
```

**Rule:** any **NO-GO** automated check, or any **unresolved [CRITICAL]** item, ⇒
overall **NO-GO**. Never soften a CRITICAL into a warning.
