# MPL Runbook — Sync & Integration Audit Cookbook

> **NEW SESSION, READ THIS FIRST.** Do not touch code until you have:
> 1. Read this entire file top-to-bottom.
> 2. Run **§2 Get Local Up To Date** (sync), then **§3 Integration Audit**.
> 3. **Reported findings** (broken / mismatched / client-side-note) to the user *before* editing anything.
> 4. Skimmed the **§6 Session Log** at the bottom for prior context.
>
> Before you finish the session, **append a Session Log entry** (§5). This file is only useful if every session keeps it current.

---

## 1. Project Context

- **Fullstack monorepo**, built by **two people** through one shared GitHub repo (`origin`). Because of the two-person workflow, **local and remote branches drift** and uncommitted local changes are common. Always assume local may be stale and/or dirty.
- **npm workspaces** — root `package.json` declares `"workspaces": ["apps/*"]`. Dependencies resolve to the **root `node_modules`**, not per-app.
- **Structure:**
  | Path | What | Stack |
  |---|---|---|
  | `apps/api` | Backend | Express 5 + Prisma 7, TypeScript, run via **`tsx`** (entry `src/index.ts`, port **3001**) |
  | `apps/web` | Frontend | React 19 + Vite 6 (dev port **5173**) |
  | `apps/api/prisma/schema.prisma` | DB schema | **PostgreSQL** (`datasource db { provider = "postgresql" }`) |
- **Prisma 7 specifics** (different from v6):
  - DB URL lives in **`apps/api/prisma.config.ts`**, *not* in `schema.prisma`.
  - Generator is `prisma-client` (not `prisma-client-js`), output to **`apps/api/src/generated/prisma/`** which is **gitignored** → must be regenerated after every pull.
  - Uses the `PrismaPg` driver adapter + `pg` Pool.
- **Auth model:** JWT, payload `{ id, role, type: "user" | "admin" }`, 7-day expiry. Admin login = `POST /api/auth/admin/login`. Middleware in `apps/api/src/middleware/auth.ts`: `authenticate`, `adminOnly`, `requireRole(...roles)`.
  - Admin roles: `SUPERADMIN | OPERATIONS | SUPPORT`. User `verificationStatus`: `PENDING | VERIFIED | REJECTED`.
- **Seed accounts** (`npx prisma db seed`): admin `admin@mpl.com` / `admin1234` (SUPERADMIN); client `client@mpl.com` / `client1234` (VERIFIED).

### ⚠️ Current focus: ADMIN DASHBOARD ONLY
- Work **only** on the admin side. **Do not modify the client-facing side.**
- When an admin change has client-side implications, **NOTE it for follow-up** (in your report and the Session Log) — do **not** fix the client side.
- **Shared contracts** (touching these affects the client too — see §4): `prisma/schema.prisma` models/enums, routes used by both roles (`/api/users`, `/api/shipments`, `/api/tracking`, `/api/notifications`), `apps/web/src/lib/api.js`, `apps/web/src/contexts/AuthContext.jsx`, `apps/web/src/pages/dashboard/TrackingSection.jsx` (shared via `isAdmin` prop).

**Admin-scope surface (verify each session, it drifts):**
- Backend routers (mounted in `apps/api/src/index.ts`): `users`, `admins`?/`admin-notifications`, `fleet`, `shipments` (assign/status), `tracking` (events), `invoices`.
- Frontend: `apps/web/src/pages/AdminDashboardPage.jsx` + `apps/web/src/pages/AdminComponents/*` (Overview, Shipments, Clients, Drivers, Armada, Invoices, Users) + shared `TrackingSection`.

---

## 2. Get Local Up To Date

### 2.1 Inspect FIRST (never pull blind)
```bash
cd <repo-root>
git fetch --all --prune
git branch --show-current                 # which branch am I on?
git status -sb                            # dirty? ahead/behind?
git branch -vv                            # tracking + ahead/behind for all branches
git log --oneline -8 HEAD                 # local tip
git log --oneline -8 @{u}                 # upstream tip (origin/<branch>)
git diff --stat HEAD @{u}                 # what's INCOMING from remote
git status --porcelain                    # exact local modifications + untracked
```
**Report to the user before proceeding:** current branch, how many commits behind/ahead, the list of incoming files, and the list of locally-modified/untracked files. Flag if incoming changes overlap locally-modified files (merge-conflict risk).

### 2.2 Choose a path

**Decision:** Are the local uncommitted changes worth keeping?

```
behind + DIRTY ──┬─ KEEP local changes      → 2.3a (stash → pull → pop)
                 └─ DISCARD local changes    → 2.3b (restore → pull)

behind + CLEAN                               → just: git pull --ff-only
local has its OWN commits ahead (diverged)   → do NOT ff; branch off and ask the user
```
> If local `main` has its own commits that aren't on remote, **stop** — create a branch (`git switch -c <name>`) and ask the user how to reconcile. Never rewrite shared `main` history.

#### 2.3a — KEEP local changes (stash → pull → pop)
```bash
git stash push -u -m "presync $(git rev-parse --short HEAD)"   # -u also stashes untracked
git pull --ff-only                                             # fast-forward to remote
git stash pop                                                  # reapply; resolve conflicts if any
git status -sb                                                 # confirm changes are back
```
If `stash pop` conflicts: resolve in the listed files, `git add` them, then continue. The stash stays in `git stash list` until cleared.

#### 2.3b — DISCARD local changes (restore → pull)
```bash
# Discard ONLY your own tracked modifications (name them explicitly — don't blow away
# unrelated work or other people's stashes):
git restore <file1> <file2> ...
# Remove your own untracked files (verify each is yours; leave generated/ artifacts):
rm -f <your-untracked-file>
git status --porcelain          # should be clean (or only foreign artifacts)
git pull --ff-only
```

### 2.4 Verify the sync landed
```bash
git status -sb                  # expect: "## <branch>...origin/<branch>" with no [behind]/[ahead]
git log --oneline -3            # tip should match origin
```

### 2.5 Post-pull resync (MANDATORY — code alone isn't enough)
```bash
# 1. Dependencies (workspace-aware; run from each app or root):
( cd apps/api && npm install )
( cd apps/web && npm install )

# 2. Regenerate the Prisma client (gitignored, so the pull did NOT bring it):
cd apps/api
npx prisma generate
#   If you see "exists and is not empty but doesn't look like a generated Prisma Client":
#   rm -rf src/generated/prisma && npx prisma generate

# 3. Apply DB migrations:
npx prisma migrate status        # NOTE: this only checks RECORDED migrations vs the
                                 # migrations folder — it does NOT compare schema↔DB.
                                 # It can say "up to date" while the schema is ahead. (§3.1)
npx prisma migrate deploy        # apply any pending committed migrations
# (dev DB, safe to reset): npx prisma db seed   # ensure seed accounts exist
```
> **`.env` is gitignored** — it does **not** arrive via pull. After syncing, diff your `apps/api/.env` and `apps/web/.env*` against `*.env.example` and any **new** `process.env.*` / `import.meta.env.*` keys the pulled code introduced (see §3.1). Missing keys cause boot crashes or runtime 500s.

---

## 3. Integration Audit (admin-dashboard scope)

> Goal: find **unconnected parts** — code that references things that don't exist, contracts that don't line up, buttons that do nothing. **Report first, fix second.** Do not edit during the audit.

### 3.1 Backend ↔ Database
```bash
cd apps/api
# Models & enums the SCHEMA defines:
grep -nE '^(model|enum) ' prisma/schema.prisma
# Enum VALUES in schema (e.g. AuditActionType):
sed -n '/enum AuditActionType/,/}/p' prisma/schema.prisma
# Are those enum values / tables actually in a MIGRATION?  (schema-ahead drift trap)
grep -rl "AdminNotification\|<EnumValueYouSaw>" prisma/migrations/
# New env vars the pulled code expects:
grep -rhoE 'process\.env\.[A-Z_]+' src/ | sort -u
```
**Checklist:**
- [ ] Every `model`/`enum` in `schema.prisma` is created by a file in `prisma/migrations/`. If not → **schema is ahead of migrations** (an upstream forgot to generate one). `migrate status` will NOT catch this.
- [ ] To confirm DB matches schema, in a dev DB run `npx prisma migrate dev --name <desc>` — if it generates a new migration, the DB was missing those objects. Review + commit that migration.
- [ ] Every enum-value string literal used in route code (`actionType: "..."`, `status: "..."`) exists in the schema enum **and** in an applied migration. A missing value → `invalid input value for enum` 500 at runtime.
- [ ] Every `process.env.*` key has a value in `.env` (or is handled when absent).

### 3.2 Frontend ↔ Backend (the core cross-reference)
```bash
# Backend: every route + its method, path, auth middleware:
grep -rnE 'router\.(get|post|patch|put|delete)\(' apps/api/src/routes/ | sed -E 's|.*/routes/||'
grep -nE 'app\.use\("/api' apps/api/src/index.ts          # router mount prefixes
# Backend: request body/query shapes:
grep -rnE 'const \{[^}]*\} = req\.(body|query|params)' apps/api/src/routes/
# Frontend: every API call the admin UI makes:
sed -n '1,300p' apps/web/src/lib/api.js                    # the central api layer
grep -rnE "api\.(get|post|patch|delete)\(" apps/web/src/lib/api.js
```
Build a **cross-reference table** (one row per admin frontend call). Mark each ✅ match / ⚠️ mismatch / ❌ missing:

| Frontend call (`api.js`) | Method+Path sent | Backend route exists? | Method match? | Body shape match? | Auth (adminOnly?) | Verdict |
|---|---|---|---|---|---|---|
| `fleetAPI.addDriver` | POST /api/fleet/drivers | … | … | … | … | ✅/⚠️/❌ |
| _…one row per admin call…_ | | | | | | |

Check for each call: **path string**, **HTTP method**, **request body keys** vs the route's `req.body` destructuring, **response shape** the component reads (e.g. `data.users`, `data.shipment.id`) vs what the route returns, and **auth** (frontend assumes admin token; route uses `adminOnly`/`requireRole`).

### 3.3 End-to-end admin flows (button → API → DB → UI)
For each admin section (Overview, Shipments, Clients, Drivers/Armada, Invoices, Users, Tracking):
- [ ] **Dead buttons:** every `onClick` either calls an API or is intentionally a placeholder (a `showToast('...dalam pengembangan')` stub = NOT wired — note it).
- [ ] **Calls to nonexistent endpoints:** every `*API.*()` resolves to a real route (from §3.2).
- [ ] **DB writes that never surface:** a create/update succeeds but the list/counter doesn't refetch or doesn't map the returned field.
- [ ] **Counter vs table mismatch:** dashboard KPIs/filters computed from a field that doesn't exist on the API response (e.g. mapping `u.status` when the API returns `verificationStatus`).
- [ ] **Field-name drift:** frontend reads `x.foo`, backend returns `x.bar`.

**Live smoke test** (start a clean server first — see §3.4):
```bash
# Use the harness in Appendix A (apitest.mjs) — logs in as admin+client and
# exercises every route, printing a PASS/FAIL table. Adjust route list per audit.
cd apps/api && node apitest.mjs
```

### 3.4 Running servers safely (avoid the orphan trap)
```bash
# Backend (no watch, for testing):
cd apps/api && npx tsx src/index.ts        # http://localhost:3001
# Frontend:
cd apps/web && npm run dev                 # http://localhost:5173
```
> **Gotcha — orphaned processes:** `tsx` and `vite` spawn child `node` processes that can **survive** a normal stop and keep squatting on the port, so a stale (buggy) build answers your tests. When restarting or finishing:
> ```powershell
> Stop-Process -Name node -Force -ErrorAction SilentlyContinue
> Get-NetTCPConnection -LocalPort 3001,5173 -State Listen -ErrorAction SilentlyContinue
> ```
> Confirm the ports are free before starting a fresh server, and again when you're done.

> **Gotcha — no type-checking at runtime:** `apps/api` has **no `tsconfig.json`** and runs via `tsx`, which **strips types without checking them**. TypeScript errors (undefined identifiers, bad types) **only surface at runtime as 500s.** You MUST exercise the routes — a clean boot does not mean correct code.

> **Gotcha — buffered logs:** a backgrounded server buffers stdout; errors may not flush to the log file, and a hard kill loses them. To capture a specific error, hit the endpoint then read the log, or reproduce the failing DB call in a tiny standalone `tsx` script importing `./src/generated/prisma/client`.

### 3.5 Report format (do this before any edits)
Group findings by priority:
1. **🔴 Broken** — runtime errors, 500s, boot failures, calls to missing endpoints.
2. **🟡 Mismatched** — wrong field name/method/body/auth; data that doesn't surface; dead buttons.
3. **🔵 Client-side note-only** — issues on or affecting the client side. **Record, do not fix.**

For each: file + line (`path:line`), what's wrong, blast radius (admin-only vs shared contract), proposed fix. Then **wait for the user** before editing.

---

## 4. Guardrails

- **Admin-only scope.** Only modify admin dashboard code. For the client side: **note, don't touch.**
- **Don't break shared contracts.** Changing `schema.prisma`, shared routes (`/api/users`, `/api/shipments`, `/api/tracking`, `/api/notifications`), `api.js`, `AuthContext.jsx`, or `TrackingSection.jsx` affects the **client** too. If a fix requires it, flag the client impact in your report + Session Log.
- **Inspect before you mutate.** Read the current file/route/schema before editing. Never blind-edit based on this runbook's examples — verify the real code first (it drifts).
- **Two-person repo etiquette:**
  - `git fetch` + re-pull **immediately before** any push (the other dev may have pushed).
  - **Never force-push `main`** (or any shared branch). Never rewrite shared history.
  - Work on a branch; clear, scoped commit messages; one logical change per commit.
  - If you generated a migration or added a dependency, say so loudly (it requires action on the other dev's machine: `npm install`, `prisma migrate deploy`).
- **Migrations are forward-only on shared DBs.** Don't `migrate reset` anything but a throwaway local DB.

---

## 5. Continuous Learning Flow (what makes this reusable)

**Every session, in order:**
1. **Read** this whole file first (including the Session Log).
2. **Sync** (§2) → **Audit** (§3) → **Report** (§3.5). No edits before the report.
3. Make only the approved, admin-scoped changes.
4. **Before finishing, append a Session Log entry** (template below) recording: what was synced, what was found / fixed / deferred, any **new env vars or migrations**, and outstanding **client-side follow-ups**. Keep newest entries at the top of the log.

**Session Log entry template** (copy, fill, date it `YYYY-MM-DD`):
```md
### YYYY-MM-DD — <one-line summary>
- **Synced:** <branch>, <behind→now>, kept/discarded local changes, landed at <commit>.
- **Resync:** npm install ✓ / prisma generate ✓ / migrate ✓ / seed ✓ (note anything unusual).
- **Found:** 🔴 <broken> / 🟡 <mismatched> / 🔵 <client-side note>.
- **Fixed:** <files + what>. **Deferred:** <what + why>.
- **New env vars:** <KEY=… or "none">. **New migrations:** <name or "none">.
- **Client-side follow-ups:** <noted items the client side needs, or "none">.
- **Server/branch state left:** <servers down? uncommitted changes? branch?>.
```

---

## 6. Session Log

### 2026-06-29 — Backend feature work on `tier1-infra`: quick wins, file-upload + profile pics, RBAC #10, deployment/auth planning
- **Synced:** checked out `tier1-infra` as a local tracking branch (it cleanly descends from `origin/main`; fast-forwarded local `main` to `origin/main` alongside). `npm install` + `npx prisma generate` ✓. All work committed on `tier1-infra`, **not pushed** (per the branch lock).
- **Quick wins** (`d81c9db`): **#9** block faktur creation for FAILED shipments (`invoices.ts`). **#7** `helmet` + `express-rate-limit` (general 300/15m, auth 50/15m) in `index.ts` — also satisfies the Tier-3 helmet/rate-limit item.
- **Tier-2 file-upload primitive** (`a9f20f5`): `lib/storage` (StorageAdapter + LocalAdapter, chosen by `STORAGE_DRIVER`) + `lib/upload.ts` (multer memory, 5MB, JPG/PNG/WEBP, `saveUpload` uuid keys). Pluggable to cloud later. New dep: `multer`.
- **#3 profile pictures** (`48a9e50`, backend): `avatarKey` on Admin + User (migration `20260628140129_add_avatar_key`); `POST /api/users/me/avatar`, `GET /api/auth/admin/me` (+ closes the auth-rehaul gap) + `POST /api/auth/admin/me/avatar`; public `GET /api/files/<key>` serve route; `avatarUrl` in profile responses. **Frontend pending** (friend).
- **RBAC #10 — pieces 1–3** (`237242a`, `d485c23`, `673f228`): `lib/rbac.ts` (capability matrix + `requirePermission`) + `lib/statusFlow.ts`. **(1)** Status state machine — regular admins move shipment/invoice status *forward only*; SUPERADMIN can reverse (new `PATCH /api/invoices/:id/status`); every change audited (`UPDATE_STATUS`, from→to + reversal flag). **(2)** Driver/vehicle expiry — late updates allowed (already were); already-expired dates raise a `compliance` admin-notification (`lib/expiry.ts`, wired into fleet create/update + a daily scheduler sweep). **(3)** Admin management — SUPERADMIN-only `routes/admins.ts` (list/create/reset-password, one-time temp password; migration `20260628172950_add_create_admin_audit`). Full design + frontend handoffs in **[RBAC-PLAN.md](RBAC-PLAN.md)**.
- **Planning/docs:** **DEPLOYMENT.md** (`5e21f8f`) — hybrid topology (public client + client API in cloud, local-only admin, shared cloud Postgres) + deferred httpOnly-cookie auth plan. **Token-storage research** done → httpOnly cookies (sessions leaning); **auth rehaul DEFERRED** to a coordinated pre-launch session (`1789e45`; also in DEPLOYMENT.md §3 + a persistent memory). DEV-PLAN kept current (handoffs, parked PDF, ticks).
- **Verified throughout:** typecheck steady at **54** (one below the prior 55 baseline; no new debt — coerced new `req.params.id` uses), **smoke 26/26** after every feature, plus targeted e2e tests for avatars, RBAC transitions/gating, expiry flagging, and admin management.
- **New env vars:** `STORAGE_DRIVER` / `STORAGE_LOCAL_PATH` (default `local` / `./uploads`; documented in `.env.example`, no action needed for dev). **New deps (`apps/api`):** `helmet`, `express-rate-limit`, `multer` → friend runs `npm install` on pull. **New migrations:** `add_avatar_key`, `add_create_admin_audit` → friend runs `npx prisma migrate deploy` on pull.
- **Client-side follow-ups (friend's frontend):** #3 avatar upload/display UI; RBAC UI — admin-management pages (list/create/reset showing the one-time temp password), the SUPERADMIN invoice-revert control (`PATCH /api/invoices/:id/status`), and graceful 403 handling for regular admins on reversals. All captured in RBAC-PLAN.md + DEV-PLAN "Parked / handoffs".
- **Server/branch state left:** on `tier1-infra`, working tree clean, **not pushed**. Servers stopped, ports free. Dev DB has an extra test admin `ops@mpl.com` / `ops1234` (OPERATIONS) from RBAC testing (harmless, handy for regular-admin testing). PDF generator parked pending design; auth rehaul parked pending the pre-launch coordinated session.

### 2026-06-27 — Tier-1 dev infra (typecheck + smoke + CI) + curated ECC agents/rules
- **Branch:** `tier1-infra` (off `main`).
- **Added:** `apps/api/tsconfig.json` + `npm run typecheck`; committed `apps/api/test/smoke.mjs` + `npm run smoke` (26/26 green locally); `.github/workflows/ci.yml` (Postgres service → generate → migrate deploy → migrate status → seed → typecheck → web build → web lint → smoke).
- **Curated ECC:** `.claude/agents/` (code/ts/react/security/database reviewers + build-error-resolver), `.claude/rules/` (TS/React/common), `npm run security:scan` (AgentShield). No hooks copied.
- **TS pin:** `typescript ^6.0.3 → ~5.8.3` in apps/api (tooling-only; runtime via `tsx` unaffected). Version did NOT change the error count.
- **Known debt — typecheck is NON-BLOCKING in CI for now:** ~55 pre-existing `tsc` errors, all *type-friction, not runtime bugs* — ~11 Prisma-7 `include` payloads not resolving under `tsc` (code is correct; runtime verified by the green smoke), ~42 Express `req.query`/`req.params` `string | string[]` widenings, 2 minor. To make typecheck a hard gate: coerce query/param values to `string` and resolve the Prisma include typing, then flip `continue-on-error: false` in `ci.yml`. Web lint also non-blocking (~26 pre-existing unused-var errors).
- **Hard CI gates that DO pass:** install, prisma generate/migrate/seed, web build, smoke.
- **Client-side follow-ups:** none.

### 2026-06-25 (cont.) — Reconciled diverged `origin/main` (revision-6) onto the OpenWA backend line; pushed to `main`
- **Divergence found:** while preparing to land `update-6`, discovered the friend had pushed **revision-6** (`ae4312c`) to `origin/main` — a large admin dashboard UI/UX overhaul (new sidebar/topbar layout, profile section, rewritten sections, landing-page components, `revision-6.md`/`revision-6-backend.md`). It **branched from before revision-5**, so relative to our line it *lacked/reverted* the OpenWA `whatsapp.ts`, the expanded seed, `polling.js`, the `admin-notifications` migration, and it **deleted** `RUNBOOK.md`/`CLAUDE.md`. `local main` (revision-5, `f1a72e8`) and `origin/main` (`ae4312c`) had genuinely **diverged** (neither an ancestor of the other).
- **Per user — frontend only, do not touch backend:** on a branch off `update-6`, ran `git checkout origin/main -- apps/web/` to overlay revision-6's **entire frontend**, leaving **all of `apps/api` untouched** (verified `git diff --name-only update-6 -- apps/api/` = empty → OpenWA backend + `notify-driver` route intact). Re-applied our OpenWA wiring on top of revision-6's rewritten `ShipmentsSection.jsx`: restored `shipmentsAPI.notifyDriver` in `api.js` and re-pointed the green "Kirim Notifikasi WhatsApp Driver" button at the backend (revision-6 had the old `wa.me` browser-tab button). Removed orphaned `polling.js` (revision-6 dropped the polling refactor; nothing imported it). Grabbed `revision-6.md`/`revision-6-backend.md` from `origin/main`; kept our `RUNBOOK.md`/`CLAUDE.md`/`.env.example`.
- **Smoke test (both servers, live):** API `GET /health` ✓, admin login ✓, `GET /api/shipments` ✓ (6), `POST /:id/notify-driver` on a bogus id → **404** (route wired, **no WA sent**), frontend `:5173` → 200. Web build ✓ (revision-6's heavier bundle). OpenWA on :2785 left untouched throughout.
- **Reconciliation push (no force):** committed the integration, then **`git merge -s ours origin/main`** — we'd already hand-built the exact target tree, so this records `ae4312c` as a parent while keeping our tree; that makes `origin/main` an ancestor so the push is a clean fast-forward. Fast-forwarded `main`, re-fetched as a final guard (`merge-base --is-ancestor`), pushed **`ae4312c..177904d main -> main`**. Net result on `main`: **revision-6 frontend + OpenWA backend + restored docs**.
- **New env vars:** none beyond the `OPENWA_*` already documented. **New migrations:** none.
- **Docs added (option 3):** new **`services/OpenWA-SETUP.md`** (full gateway setup — clone into `services/`, `.env`, run :2785/dashboard :2886, link session, wire `apps/api/.env`, test, contract) + corrected the README OpenWA "Setup" section (was pointing at the non-existent `./OpenWA/`; now `services/OpenWA/` + links the new doc).
- **Client-side / coordination follow-up:** ⚠️ the friend must, on next pull: `git pull` → `npm install` → `npx prisma generate` → `npx prisma migrate deploy` (backend + schema moved forward vs their revision-6 line). Their frontend is fully preserved; only the stale backend is superseded.
- **Branches:** `update-6` + `integrate-rev6-frontend` deleted (local) and `origin/update-6` deleted (remote) — fully contained in `main`.
- **Server/branch state left:** on `main` @ `177904d` (in sync with `origin/main`). mpl servers (`:3001`/`:5173`) + OpenWA (`:2785`) left running by me for the user's click-through.

### 2026-06-25 — Synced `revision-5`; integrated OpenWA WhatsApp gateway; localized + made the driver notification manual
- **Synced:** on `main` @ `074384a`, **dirty** (leftover migration-squash experiment + per-app lockfile noise from a prior local session). Discarded local changes per user (`git restore .` + `git clean -fd`), then `git merge origin/revision-5` **fast-forwarded** `074384a..f1a72e8`. Incoming (13 files): expanded `seed.ts`, new `apps/web/src/lib/polling.js`, `whatsapp.ts` rewritten for OpenWA, admin-section tweaks, README/RUNBOOK.
- **Resync:** `npm install` both apps ✓. `prisma generate` ✓. **`migrate deploy` failed (`P3018` — `type "AdminRole" already exists`):** the dev DB still held schema from the prior squashed-migration experiment while revision-5 restored the original 6 migrations → re-apply collided. Fixed with `npx prisma migrate reset --force` (user consented; **dev DB only**, Prisma AI-consent gate) → 6 migrations applied clean + reseeded (5 clients/5 drivers/5 vehicles/5 shipments + tracking events).
- **OpenWA integration (per user):**
  - Cloned `github.com/rmyndharis/OpenWA` (NestJS WhatsApp API gateway). First into `apps/`, then **moved to `services/OpenWA`** — `apps/*` is an npm-workspace glob, so it would have hoisted OpenWA's NestJS/puppeteer deps into root `node_modules`. Added `services/OpenWA/` to mpl `.gitignore` (own `.git`, runs standalone — not committed into mpl).
  - Created `services/OpenWA/.env` (SQLite, :2785, `ALLOW_DEV_API_KEY=true` → seeds well-known `dev-admin-key`, written to `data/.api-key`). `npm install` incl. dashboard postinstall ✓ on Node 24 (OpenWA targets 22 — no issue hit).
  - Verified the existing `apps/api/src/services/whatsapp.ts` (from revision-5) **already matches OpenWA's REST contract exactly** (`POST /api/sessions/{id}/messages/send-text`, `X-API-Key`, `{chatId,text}`, :2785, global prefix `api`) — confirmed against the cloned `message.controller.ts`/`main.ts`. No code change needed to connect; only the 3 env vars.
  - User linked a session via dashboard (status `ready`, phone `6287875387552`). Added `OPENWA_BASE_URL/API_KEY/SESSION_ID` to `apps/api/.env`. ⚠️ Gotcha: a `qr_ready` session's **id changes once it connects** — had to re-read and update `OPENWA_SESSION_ID` (final `4f7d4745-…`).
- **Driver WA notification — localized + made manual (per user)** in `apps/api/src/routes/shipments.ts`:
  - Rewrote to a **Bahasa Indonesia template** (greeting, shipment id as ref, pickup/dropoff + Google Maps links via `maps.google.com/maps/search/?api=1&query=`, pickup time formatted `id-ID`/WIB, admin phone `087875387552` hardcoded). Pickup/dropoff are **hardcoded placeholders** (Mall Kelapa Gading / Jl. Asia Afrika Bandung) pending real form fields.
  - **Removed the auto-send from `PATCH /:id/assign`**; added **`POST /:id/notify-driver`** (adminOnly) — builds the template, sends via OpenWA, logs `SEND_WHATSAPP_DRIVER`; guards shipment 404 / no-driver 400 / no-phone 400 / OpenWA-fail 502.
  - `apps/web/src/lib/api.js`: added `shipmentsAPI.notifyDriver(id)`. `ShipmentsSection.jsx`: green "Kirim Notifikasi WhatsApp Driver" button now calls it (real OpenWA send) instead of opening a `wa.me` tab; added `handleNotifyDriver`. Web build ✓ (114 modules).
- **Created `apps/api/.env.example`** (none existed) documenting all 14 referenced vars: core (`DATABASE_URL/PORT/CLIENT_URL/JWT_SECRET`), `OPENWA_*`, `SMTP_*`, `ADMIN_EMAIL/WHATSAPP`.
- **New env vars:** `OPENWA_BASE_URL` / `OPENWA_API_KEY` / `OPENWA_SESSION_ID` (in `apps/api/.env`, gitignored; documented in new `.env.example`). **New migrations:** none (reused the 6).
- **Behavior change to note:** driver WA notification is now **manual (button-triggered)**, no longer automatic on assign — as requested.
- **Client-side follow-ups:** friend will add **pickup/dropoff location inputs + an optional Google Maps link** to the new-shipment form (client side). The optional-link field needs a **schema migration** (no column today) — shared contract, requires `prisma migrate deploy` on the other machine. Once those fields exist, swap the 3 hardcoded consts in `notify-driver` (its only consumer) to real shipment fields. This session's `shipments.ts`/`api.js` edits were **additive** (new route + method) — no existing contract broken.
- **Server/branch state left:** on `main` @ `f1a72e8`. **Uncommitted:** `apps/api/src/routes/shipments.ts`, `apps/web/src/lib/api.js`, `apps/web/src/pages/AdminComponents/ShipmentsSection.jsx`, `.gitignore`, new `apps/api/.env.example` — awaiting user decision to commit. OpenWA running on :2785 (user's cmd) with linked session; mpl servers run by user in cmd.

### 2026-06-15 — Merged `update-4` into `main`; reset diverged dev DB; expanded seed
- **Synced:** was on `main` (clean history-wise but **dirty working tree** with the prior local experiment). `main` was **0 ahead / behind `update-4`** content-wise but pointed at `2803979`. Discarded the local working-tree changes (per user) into a **backup stash** (`stash@{0}: backup before update-4 pull (2026-06-15)` — still present, not dropped), then `git merge --ff-only origin/update-4` landed `main` at **`074384a`**. No code commits between this tip and the 2026-06-12 audit → code carries forward as already-audited (44/44).
- **Resync:** `npm install` (workspaces) ✓. `prisma generate` ✓ (7.8.0). `.env` has only `DATABASE_URL/JWT_SECRET/CLIENT_URL/PORT`. **`migrate deploy` was blocked** — dev DB history had **fully diverged**: only `20260610082635_init` (the discarded local consolidated migration, not in the repo) was applied; the 6 committed migrations were unapplied; "last common migration = null".
- **Found:** 🔴 **dev DB diverged & schema-behind** — live DB was missing `admin_notifications` table, audit enum values (`SEND_WHATSAPP_DRIVER/GENERATE_MAGIC_LINK/RESET_PASSWORD`), and `Driver.licenseExpiry` / `Vehicle.stnkExpiry`+`kirExpiry` columns → would 500 on admin-notifications, fleet, assign/magic-link/reset (boot survived via `alertScheduler` try/catch). 🟡 email/WhatsApp/alert env vars (`SMTP_*`, `FONNTE_API_TOKEN`, `ADMIN_EMAIL/WHATSAPP`) unset → delivery is a graceful no-op (verified `email.ts`/`whatsapp.ts` return `false`, no crash). Same as prior session.
- **Fixed:** Ran `npx prisma migrate reset --force` (user consented; **dev DB only** — required Prisma's `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` gate). Replayed all 6 migrations cleanly + reseeded. **Expanded `prisma/seed.ts`** (per user): 5 clients, 5 drivers, 5 vehicles, 5 shipments across **3 distinct clients**, + 7 tracking events; **invoices left blank** (to be generated from shipments); kept `admin@mpl.com`/`client@mpl.com` login accounts. A few driver licenses & vehicle STNK/KIR dates intentionally fall within 30 days to exercise the expiry-alert path. Verified final counts (users 6, drivers 5, vehicles 5, shipments 5, distinct clients 3, invoices 0) and that the previously-missing objects now exist.
- **Env/tooling fix:** user couldn't `npm run dev` — PowerShell **execution policy** was `Undefined`→`Restricted`, blocking `npm.ps1` (`UnauthorizedAccess`). Set **CurrentUser → `RemoteSigned`** (reversible, no admin). Code/build were never at fault (web build passes 113→114 modules). Also noted a stale orphan backend on :3001 from a prior session (the §3.4 orphan trap).
- **Frontend polling refactor (per user — make auto-refresh seamless):** the 8s poll was visible (loading flicker), worst on **Pelacakan** (the one section never converted to the `silent` pattern; it also re-ran its `initialSearchQuery` auto-select every poll). Changes: (1) new **`apps/web/src/lib/polling.js`** — `usePolling()` hook (pauses while tab hidden, refetches on re-focus) + tiered **`POLL_INTERVAL`** (`LIVE` 10s / `REFERENCE` 30s); (2) swapped **all 8 poll sites** off hardcoded `setInterval(…, 8000)` → `usePolling` (shipments/tracking/notifications = LIVE 10s; clients/drivers/vehicles/invoices/users = REFERENCE 30s); (3) made **TrackingSection** polling silent + gated its auto-select to the initial load; (4) made **post-mutation refetches silent** in all 6 admin sections (create/update/delete/assign/status) so adding an entry no longer flashes the loading skeleton. Build ✓ (114 modules).
- **New env vars:** none added (the 🟡 delivery vars remain unset by design). **New migrations:** none authored — the 6 committed ones are now applied to the dev DB.
- **Client-side follow-ups:** `seed.ts` data feeds the **shared** client dashboard (shipments/tracking). ⚠️ The polling refactor touched **shared `dashboard/TrackingSection.jsx`** → the **client** tracking view now also polls at 10s with pause-on-hidden (pure UX improvement, no contract change) — flagged per §4 since it's shared code.
- **Server/branch state left:** on `main` @ `074384a`, servers **not started** by me (stale orphan backend may still hold :3001 — user advised to restart it). **Uncommitted:** `apps/api/prisma/seed.ts`, new `apps/web/src/lib/polling.js`, and edits to `AdminDashboardPage.jsx` + 6 `AdminComponents/*` + `dashboard/TrackingSection.jsx` — awaiting user decision to commit. Backup stash `stash@{0}` still present (do **not** pop its consolidated-migration part). PowerShell CurrentUser policy now `RemoteSigned`.

### 2026-06-12 — Synced stale `main` to remote; fixed 3 boot/runtime bugs; full API audit
- **Synced:** was on `main`, **11 commits behind** `origin/main`. Local had uncommitted edits made against the stale tree → **discarded** them (per user), then `git merge --ff-only origin/main` landed at `0718631`. Created working branch **`update-4`** off it (current focus branch).
- **Resync:** `npm install` both apps ✓. `prisma generate` needed `rm -rf src/generated/prisma` first (stale partial dir) ✓. DB already had 5 migrations applied; **had to generate a missing one** (see below). `prisma db seed` ✓.
- **Found / Fixed (all upstream bugs that made `origin/main` non-functional):**
  - 🔴 **Missing dependency** — `apps/api/src/services/email.ts` imports `nodemailer` but it wasn't in `package.json` → **server crashed on boot** (`ERR_MODULE_NOT_FOUND`). Fixed: `npm install nodemailer` (+ `@types/nodemailer`).
  - 🔴 **Schema ahead of migrations** — `schema.prisma` defined the `AdminNotification` model and audit enum values `SEND_WHATSAPP_DRIVER`, `GENERATE_MAGIC_LINK`, `RESET_PASSWORD` with **no migration creating them** → `admin-notifications` + assign/magic-link routes 500'd (`TableDoesNotExist`, `invalid input value for enum`). `migrate status` falsely reported "up to date." Fixed: generated **`20260611184550_add_admin_notifications_and_audit_actions`**.
  - 🔴 **`ReferenceError`** — `apps/api/src/routes/users.ts:85` called bare `randomBytes(9)` (only `crypto` was imported; lines 303/422 correctly use `crypto.randomBytes`) → every "create klien" 500'd. Fixed: `crypto.randomBytes`.
- **Audit result:** **API 44/44 routes PASS** (auth, users incl. create/verify/reject/edit/delete/magic-link/reset-password, shipments, tracking, fleet drivers+vehicles CRUD, invoices, notifications, admin-notifications). Web **production build passes** (113 modules); dev server serves at :5173. `apps/web` lint has **26 pre-existing** unused-var errors (non-blocking, upstream debt — not fixed).
- **New env vars:** none added, but the new email/WhatsApp services read **`SMTP_HOST/PORT/USER/PASS/FROM`, `FONNTE_API_TOKEN`, `ADMIN_EMAIL`, `ADMIN_WHATSAPP`** — **not set** in `apps/api/.env`, so delivery is a no-op (routes degrade gracefully; magic-link/reset still return the link).
- **Client-side follow-ups:** none introduced. Reminder: `users`/`shipments`/`tracking` routes, `api.js`, `AuthContext`, `TrackingSection` are shared with the client.
- **Server/branch state left:** servers **stopped**, ports free. On branch **`update-4`** with **3 uncommitted fixes** (nodemailer in `package.json`+lock, `users.ts` randomBytes, new migration dir) — awaiting user decision to commit.

### YYYY-MM-DD — <next session: copy the template above>
```

---

## Appendix A — API smoke-test harness (`apps/api/apitest.mjs`)

A throwaway Node script (run with `node apitest.mjs` while the server is up) that logs in as admin + client and walks every route, chaining created IDs, printing a PASS/FAIL table. Recreate/adjust per audit; **delete it before committing** (or keep under a gitignored path). Skeleton:

```js
const BASE = 'http://localhost:3001'
const results = []; let pass = 0, fail = 0
async function call(name, method, path, { token, body, expect = [200, 201] } = {}) {
  const headers = {}; if (token) headers.Authorization = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'
  let code = 0, json = {}
  try {
    const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
    code = res.status; try { json = JSON.parse(await res.text()) } catch {}
  } catch (e) { json = { message: String(e) } }
  const ok = expect.includes(code); ok ? pass++ : fail++
  results.push({ name, code, ok, msg: json.message || '' }); return { code, json, ok }
}
;(async () => {
  const a = await call('admin login','POST','/api/auth/admin/login',{ body:{ email:'admin@mpl.com', password:'admin1234' }})
  const ADMIN = a.json.token
  const c = await call('client login','POST','/api/auth/login',{ body:{ email:'client@mpl.com', password:'client1234' }})
  const CLIENT = c.json.token
  // …one call() per route; capture ids from .json for dependent calls (assign, invoice, etc.)…
  console.log('\n==== RESULTS ====')
  for (const r of results) console.log(`[${r.ok?'PASS':'FAIL'}] ${String(r.code).padEnd(3)} ${r.name}${r.ok?'':' → '+r.msg}`)
  console.log(`TOTAL: ${pass} passed, ${fail} failed`)
  process.exit(0)
})()
```

## Appendix B — Quick command reference
```bash
# Sync
git fetch --all --prune && git status -sb && git diff --stat HEAD @{u}
git pull --ff-only

# Resync
( cd apps/api && npm install ) && ( cd apps/web && npm install )
cd apps/api && npx prisma generate && npx prisma migrate deploy && npx prisma db seed

# Run (then kill orphans when done)
cd apps/api && npx tsx src/index.ts      # :3001
cd apps/web && npm run dev               # :5173
#   PowerShell cleanup: Stop-Process -Name node -Force -ErrorAction SilentlyContinue

# Audit greps
grep -rnE 'router\.(get|post|patch|put|delete)\(' apps/api/src/routes/
grep -rnE 'const \{[^}]*\} = req\.(body|query|params)' apps/api/src/routes/
grep -rnE 'api\.(get|post|patch|delete)\(' apps/web/src/lib/api.js
grep -nE '^(model|enum) ' apps/api/prisma/schema.prisma
```
