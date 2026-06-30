# DEPLOYMENT — architecture & auth plan

> **Status:** PLANNING (not yet deployed). Captures the target topology, the auth/token
> hardening plan, and the open decisions. Last updated: 2026-06-27.
> Related: [DEV-PLAN.md](DEV-PLAN.md) · [RUNBOOK.md](RUNBOOK.md) · auth research summary (see DEV-PLAN roadmap).

---

## 1. Target topology (hybrid: public client + local admin + shared DB)

```
        Internet                          MPL office LAN
   ┌──────────────────┐              ┌──────────────────────┐
   │ Client web app   │              │ Admin web app + API  │
   │ + Client API     │              │ (local-only, NOT     │
   │ (public)         │              │  internet-exposed)   │
   └────────┬─────────┘              └──────────┬───────────┘
            │   both connect to the same DB     │
            └───────────────┬───────────────────┘
                    ┌────────▼─────────┐
                    │  Managed cloud   │  ← single source of truth
                    │  Postgres        │     (Supabase / Neon / RDS / Railway)
                    └──────────────────┘
```

**The shared cloud Postgres is the link.** Admin updates shipment/tracking progress from the
local network → it lands in the cloud DB → public clients read it. That is how clients stay
updated while the admin surface never touches the public internet.

### Components

| Component | Where | Exposure | Notes |
|---|---|---|---|
| **Client web app** (`apps/web`, client routes) | Cloud (e.g. Vercel/Netlify) | Public (HTTPS) | The MPL clients' dashboard. |
| **Client API** (`apps/api`) | Cloud (e.g. Railway/Render/Fly) | Public (HTTPS) | Serves client + shared routes. |
| **Admin web app + Admin API** (`apps/web` admin routes + `apps/api`) | **MPL office server (LAN)** | **Local only** — not port-forwarded / not internet-exposed | Admins on office PCs use it over the LAN. Reaches *out* to the cloud DB. |
| **Database** | Managed cloud Postgres | Private; firewall-allowlisted | Single source of truth for both surfaces. |

---

## 2. Access control model

### Client side — "whitelist" = application-level, NOT IP
IP-whitelisting public clients is **not viable** (we don't control or know their networks).
The effective whitelist is the **existing** account model:
- **Invite-only registration** — admin issues magic links (`/api/users/magic-link`); no open sign-up.
- **Verification gate** — `PENDING / VERIFIED / REJECTED`; only `VERIFIED` accounts can use the app.
- Layer with: rate limiting (✅ done — `helmet` + `express-rate-limit`), HTTPS, and httpOnly auth (see §3).

### Admin / super-admin — local-only = enforced by NETWORK, not app logic
- Do **not** expose the admin API/UI to the internet (no port-forward; LAN-bound; behind the office router).
- App auth alone cannot make something "local-only" — the firewall/network does.
- Layer the **RBAC role check** (DEV-PLAN #10: super-admin vs admin) on top for in-app authorization.
- The cloud DB firewall should **allowlist the office's public IP** (this is the one network we control — IP-allowlisting is appropriate *here*).

---

## 3. Auth / token plan (deferred to pre-launch hardening)

**Decision: do the auth rehaul as part of the pre-deployment hardening pass — NOT now.**
Rationale: cookie config (`SameSite`/`Secure`, same-site vs cross-site, CSRF) depends on the
*final domains*; doing it before the topology is fixed means rework. Pre-launch the current
localStorage approach is acceptable debt.

### Current state (to be replaced)
JWT (`{id,role,type}`, 7-day expiry) returned in the login JSON body, stored in
`localStorage['mpl_token']`, sent as `Authorization: Bearer`. **XSS-exfiltratable** — one XSS =
silent 7-day account takeover. (Violates `.claude/rules/react/security.md`.)

### Target — per surface (different threat models)
- **Public client (high exposure):** move to **httpOnly cookie auth**.
  - Either **server-side sessions** (session id in httpOnly cookie + session row in Postgres — *leaning this way*: easy revocation, no JWT footguns, we already run Postgres), **or** **JWT-in-httpOnly-cookie + CSRF** (smallest delta from today; use `csrf-csrf` — `csurf` is deprecated).
  - If client app + client API share a registrable domain (e.g. `app.mpl.com` + `api.mpl.com`) → `SameSite=Lax`. Genuinely cross-site → `SameSite=None; Secure`.
- **Local admin (low exposure):** can keep localStorage short-term, but ride the same cookie mechanism for consistency once built. CSRF is simpler here (same-origin, LAN).

### Two gaps the migration MUST close (found in code)
1. `apps/web/src/lib/api.js` `fetch` is **missing `credentials: 'include'`** — without it, cookie auth login "works" but every later request 401s.
2. **Admin has no `/me` endpoint** — once the token isn't JS-readable, `AuthContext` can't validate admin sessions on reload. Add `GET /api/auth/admin/me` (or generic `/api/auth/me`).

### Alternatives (later / optional)
- **Short-lived access + refresh-token rotation** — more robust, more moving parts; a follow-up hardening step.
- **Managed auth provider (Clerk / Supabase Auth / Auth0)** — offloads auth security off a 2-person team; trade-off is vendor lock-in + cost + replacing the working bcrypt/JWT/magic-link system. Consider for the public client only.

---

## 4. Codebase implication — one backend, two deployments

Today `apps/api` is a **single** Express app serving both client and admin routes
(`/api/auth`, `/api/users`, `/api/shipments` are used by both; some routes are `adminOnly`).

For this topology you would run that **same backend in two places** against the shared DB:
- a **public instance** for clients (could firewall/disable the admin-only routes), and
- a **local instance** for admin (LAN-only).

Alternative: split the backend into client/admin services. Either way this is a real
architectural decision to make **before** launch. Shared routes are fine — both deployments
run the same code against the same DB; just control *exposure* per instance.

---

## 5. Open decisions (TODO before deploying)
- [ ] **Managed Postgres host** — Supabase / Neon / Railway / RDS? (Migrate dev DB → cloud; set `DATABASE_URL`.)
- [ ] **Public hosting** — frontend (Vercel/Netlify?) + API (Railway/Render/Fly?).
- [ ] **Domains** — decide client app + client API domains (drives `SameSite`/CORS/cookie config).
- [ ] **One-backend-twice vs split** — how to run the admin backend locally against the cloud DB.
- [ ] **Office static/public IP** — for the DB firewall allowlist (admin → cloud DB).
- [ ] **Auth rehaul** — execute §3 in the pre-launch hardening pass (coordinate with the friend; shared contracts).
- [ ] **Secrets** — production `JWT_SECRET` (+ `CSRF_SECRET` if cookie/CSRF), real SMTP/OpenWA creds, etc. (none in git).
- [ ] **HTTPS/TLS** — reverse proxy / platform-managed certs for the public surfaces.
- [ ] **OpenWA** — where the WhatsApp gateway runs (local with admin? its own host?) and how the API reaches it.
- [ ] **Rate-limit hardening (security-reviewed 2026-06-29)** — the general limiter was raised 300→1500/15min for the polling SPA; that flat ceiling now also covers unauthenticated CPU-heavy routes. Before public deploy:
  - **[CRITICAL]** Set `app.set("trust proxy", 1)` (only after confirming exactly one proxy hop) — behind a LB/Nginx the limiter keys on the proxy IP and is otherwise useless; blind `trust proxy: true` makes `X-Forwarded-For` spoofable → full bypass.
  - **[HIGH]** Dedicated strict sub-limiter (~10–20/15min) on the unauth account/token routes — `POST /api/auth/register`, `POST /api/users/magic-link/:token/register`, `POST /api/users/reset-password/:token`, and the `GET` token-validation endpoints (all unauthenticated + `bcrypt.hash` / token-probing; only the general 1500 today).
  - **[HIGH]** `/api/files/*` has **no** limiter (mounted before `apiLimiter` on purpose) — add its own limiter or move it under the general one; it's an unbounded storage-IO DoS surface.
  - **[HIGH]** Swap the in-memory store for Redis (`rate-limit-redis`) before any multi-instance/cluster deploy (per-process counters otherwise multiply the limit by replica count).
  - **[MED/LOW]** Consider sliding window (fixed-window allows ~2× burst at boundaries); `/api/auth` double-counting is benign (slightly protective); 404 handler reflects `req.path` (info-disclosure only, already URL-decoded — low).

---

## 6. Notes
- This is early-stage; the topology is a recommendation, not a commitment. Revisit as decisions land.
- Keep the auth rehaul **coordinated** — it touches shared contracts (`api.js`, `AuthContext.jsx`, auth middleware/routes) affecting both client and admin, in a two-agent repo.
