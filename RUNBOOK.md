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
- **Frontend-first before adding/changing any backend field, route, or contract.** The friend builds UI ahead of the backend, so `apps/web` often already sends/expects a field the backend lacks — and the backend **silently drops it** (no error). BEFORE adding a column/route/payload key, `grep` the frontend (`apps/web/src`, esp. `lib/api.js` + the relevant `*Section.jsx`) for it: adopt the frontend's existing **name + shape** instead of inventing a new one, and surface any "frontend-ahead-of-backend" gaps you find. _Lesson (2026-06-30): the Armada form already sent `serviceDate` / `chassisNumber` / `engineNumber` (with a date-picker, a service modal, and an overdue badge), all silently dropped — and we nearly added a mismatched `serviceExpiry`. Checking the frontend first caught it._
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

### 2026-07-16 — Merge friend's parallel Kepala Armada work + adopt diterima/diturunkan vocab + remove invoices entirely
- **Synced:** `git fetch origin main` — friend's agent had pushed **"Refine Kepala_Armada role"** + a landing-page refresh (`9f38e98`), overlapping the exact role we overhauled. Merged `origin/main` into `tier1-infra` (`141a132`), then removed invoices (`e6b43df`). Not pushed.
- **Collision (two-agent repo):** friend independently built overlapping Kepala Armada work in the same files (`ShipmentsSection.jsx`, `shipments.ts`, `AdminModal.jsx`) **+ a duplicate migration** (`20260715090316_add_kepala_armada_roles`, byte-identical to our `…040528`). Presented a full merge map to the user before touching anything (option A).
- **Conflict resolutions:** `AdminModal.jsx` — both portaled to `<body>`; kept ours (`backdrop-blur-md`) + their SSR guard. `ShipmentsSection.jsx` — kept ours as base (STANDBY flow, reconfirm, Tipe Pengiriman, delete, substitute, status mirror) and **adopted their armada UX** (Dalam Proses/Selesai views + date sort, centered detail modal, armada status-filter dropdown, `rawPickupDate`). `shipments.ts` — kept both (our routes + their WhatsApp-on-assign, disjoint). **Dropped the duplicate migration** `…090316` (would double-create → break `migrate deploy`).
- **Decisions (user):** (1) **Armada visibility → friend's model** — removed our "sees only Menunggu+Standby" restriction; armada now sees the full lifecycle split Dalam Proses/Selesai. (2) **Adopt `diterima`/`diturunkan` vocab.**
- **New statuses:** `ShipmentStatus += DITERIMA, DITURUNKAN` (`migration add_diterima_diturunkan_status`); `statusFlow` `Transit → Diterima → Diturunkan → Delivered` (+ kept `Transit→Delivered` for direct handover); frontend `mapStatus`/badges (cyan/teal)/`FORWARD_STATUS`/`RAW_STATUS_OPTIONS`/filter tabs; **`DELIVERED` label → "Selesai"** (admin badge). **Triggers deferred** to the Pabrik/Gudang flow.
- **🔴 Invoices removed entirely (`e6b43df`, −1523 lines):** `Invoice` model + `InvoiceStatus` enum + 3 relations, `routes/invoices.ts`, mount, `migration remove_invoices` (DROP TABLE + TYPE), `shipments.ts` include/guard, `users.ts` cascade, `statusFlow` invoice kind, smoke cases; frontend `invoicesAPI`, admin+client `InvoicesSection` + `InvoiceTable`, dashboards' imports/routes/alerts, both sidebars' Faktur groups. **Left harmless:** invoice display mappings (notification panels, OverviewSection audit localization) + `*_INVOICE` audit enum values (Postgres enum-value drop is destructive).
- **Verified:** web build ✓; API typecheck 43 (down from 53, no new); smoke 22/22 (was 26 — 4 invoice cases gone); full chain `STANDBY→…→DELIVERED` walks via `/status`; `/api/invoices` → 404.
- **New env vars:** none. **New migrations:** `add_diterima_diturunkan_status`, `remove_invoices` (this session); dropped friend's dup `…090316`.
- **Client-side follow-ups:** 🔵 **client Faktur pages removed** (dashboard InvoicesSection/InvoiceTable/route/sidebar) — friend's domain; flag so their agent doesn't re-add. 🔵 friend's auto-WhatsApp-on-assign now **double-fires** with our manual `/notify-driver`. 🔵 TrackingSection ETA still blank (est. column dropped earlier). 🔵 new statuses client-visible when client dashboard is built.
- **Deferred:** Pengurus Pabrik / Kepala Gudang flow (wire `AT_PLANT`/`Diterima`/`Diturunkan` triggers; **`AT_PLANT` keep-or-drop** still open; pabrik/gudang list visibility; "vehicle data & accessories" fields) · **context.md refresh** (do after pabrik flow).
- **Server/branch state left:** servers stopped, ports free, DB reset+seeded clean. On `tier1-infra`, committed (`141a132`, `e6b43df`), **not pushed** (per lock). ⚠️ re-login after reseed.

### 2026-07-15 — Pulled main (pipeline roles) + Kepala Armada flow overhaul (STANDBY, status mirror, Tipe Pengiriman, substitute display, delete)
- **Synced:** pulled `main` (was 42 behind → fast-forward to `2c20b9a`). Friend's agent had added the **3 pipeline roles** (`KEPALA_ARMADA`, `PIC_PABRIK`, `PIC_GUDANG`) + `AT_PLANT` shipment status + `PickupPlant`/`Manufacturer` + pipeline Shipment fields **in `schema.prisma` with NO migration**, and the plant-check/handover routes. Reconciled DB to schema and built the armada flow on top.
- **Resync:** npm install n/a · prisma generate ✓ · migrate deploy ✓ · seed ✓ (⚠️ `migrate reset` does NOT auto-seed here — always run `npx prisma db seed` after).
- **Backend — schema + migrations (all admin-scope, additive except the price/eta drop):**
  - `20260715040528_add_pipeline_roles_plant_fields` — the friend's un-migrated schema diff (roles, AT_PLANT, PickupPlant table + FK, 9 pipeline Shipment cols).
  - `20260715062022_add_standby_status` — `STANDBY` shipment status.
  - `20260715071056_drop_shipment_price_eta` — **dropped `Shipment.price` + `Shipment.estimatedArrival`** (verified unused outside create route; invoices use their own `subtotal`).
  - `20260715074954_add_driver_vehicle_standby` — `STANDBY` on `DriverStatus` + `VehicleStatus`.
- **New shipment flow:** `Menunggu(PENDING) → Standby(STANDBY) → Ditugaskan → [AT_PLANT] → Dalam Perjalanan(TRANSIT) → Berhasil(DELIVERED)/Dibatalkan(CANCELLED)`. Armada-created shipments start at **STANDBY** (server-derived by role); reconfirm advances STANDBY→DITUGASKAN. `statusFlow.ts` updated; `rbac.ts` lists the 3 new roles with `[]`.
- **Status mirror (1:1 shipment→driver→armada):** Standby→driver+vehicle STANDBY; Ditugaskan/Transit→ON_DUTY/IN_USE(Digunakan); Delivered/Cancelled→release ACTIVE/AVAILABLE. Centralized in `/status`; create route mirrors on STANDBY; `/handover` frees both. **Departure guard rewritten** — checks for a *different* TRANSIT shipment (excludes self) instead of gating on ON_DUTY (which now starts at Ditugaskan).
- **Fixed 🔴 (friend's pipeline routes, `shipments.ts`):** duplicate `plant-check`/`handover` routes defined after `export default router` (dead) — deleted; live copies wrote invalid audit enum `"UPDATE_SHIPMENT_STATUS" as any` (500 on every call) → `"UPDATE_STATUS"`; preserved the driver ON_DUTY→ACTIVE release the dead copy had.
- **Tipe Pengiriman:** table column Layanan→**Tipe Pengiriman** (Unit/Cargo/Container); per-type create persists all fields (`-` for non-applicable strings); **Unit** stores Asal=selected plant label, Tujuan="Gudang MPL"; detail modal differentiates by type, **removed Harga + Est.Tiba**, **Dibuat Oleh** now = real creator's fullName (added `createdByAdmin`/`pickupPlant` to GET includes). Kepala Armada list shows only PENDING+STANDBY; detail view open to all admin roles.
- **Fleet / UI:** AdminModal portaled to `<body>` (fixes trapped z-index/blur on create + status modals app-wide); create-form driver list = paired **and** armada Tersedia; pair modal excludes already-paired drivers; substitute ("Pengganti") shown in Armada "Driver Utama" column + Driver page (via new active-shipment includes on `/fleet/vehicles` + `/fleet/drivers`); removed the driver On-Duty badge on Armada; **Bertugas** badge → blue (Standby indigo); **delete shipment** button (regular: STANDBY only; SUPERADMIN: any; frees pair, blocks if invoice); Edit button in driver detail panel.
- **Seed rewrite:** 5 drivers (3 paired 1:1 to 3 clean vehicles, 2 spare), no shipments (create from dashboard).
- **Verified:** web build ✓; API typecheck no new errors (18 pre-existing in shipments.ts, fleet.ts clean); smoke 26/26; live: create→STANDBY(+driver/veh STANDBY), reconfirm→DITUGASKAN(ON_DUTY/IN_USE), complete→release; substitute shows on both pages; delete 200/403/superadmin-200.
- **New env vars:** none. **New migrations:** 4 (listed above).
- **Client-side follow-ups:** 🔵 dropping `estimatedArrival` blanks the ETA on the shared **TrackingSection** (client tracking) — its ETA-edit was already non-persisting (the `/status` route ignores it); did NOT modify TrackingSection. 🔵 `InvoicesSection` reads `shipment.price` (now gone) → subtotal prefill empty (moot — invoice removal is next). 🔵 new DITUGASKAN/STANDBY/pipeline statuses are client-visible when the client dashboard is built.
- **Deferred:** DEV-PLAN logging (this entry) · **full invoice removal** (user: "drop all of invoice") · **Pengurus Pabrik** flow · admin-created→Menunggu→armada pickup path (future) · old KEPALA_ARMADA PENDING assign-modal branch left in place (dead for armada; OPERATIONS still uses it) · plant-check bypasses departure-guard/ON_DUTY-promotion (flagged in DEV-PLAN).
- **Server/branch state left:** servers stopped, ports free, DB reset+seeded clean. On `tier1-infra`, uncommitted (per push lock). ⚠️ re-login after reseed (IDs regenerated).

### 2026-07-07 — Armada Lepas-modal + pairing gating, Klien input styling, admin avatar upload (+CSP fix), ponytail plugin
- **Context:** continued on `tier1-infra` (the 3 commits from 2026-07-04 already landed). No sync/pull this session; all edits admin-scope frontend + CSP + docs. Ponytail plugin installed (user) → worked in "full" lazy mode.
- **Armada (`ArmadaSection.jsx`):** (1) "Lepas" driver confirmation now uses `AdminModal` (was `window.confirm`) — in-flight "Melepaskan…", stays open on error, drops the driver from the open detail panel on success so "Pasangkan" re-enables. (2) **Pairing gated to a Lepas-first flow:** the row `person_add` button is disabled when the vehicle already has a primary driver; the detail-panel button is disabled ("Ganti Driver Utama") while paired and only becomes an enabled "Pasangkan Driver" after Lepas. (`window.confirm` on delete-vehicle left as-is — not requested.)
- **Klien (`ClientsSection.jsx`):** the Edit/Tambah Klien form inputs were bare `<input>` (flat, unstyled); added a shared `INPUT_CLASS` (border + rounded-xl + gray-50 bg + focus ring) matching the Armada form. UI-only, no format/logic change. (Chose NOT to push styling into `AdminFormField` — it wraps heterogeneous controls: input/select/AdminDatePicker; per-caller class is intentional.)
- **Admin avatar upload — #3 admin frontend DONE (`AdminProfileSection.jsx` + `api.js`):** backend was already there (`GET /api/auth/admin/me` → `avatarUrl`; `POST /api/auth/admin/me/avatar`, field `file` → `{ avatarUrl }` — verified live 200 + file serves 200 image/png). Wired: `api.js` — exported `BASE_URL`, made `request` FormData-aware (no forced JSON Content-Type for multipart), added `authAPI.getAdminMe` + `uploadAdminAvatar(file)`. `AdminProfileSection` — click hero avatar → `AdminModal` **dropzone (click OR drag-and-drop)** with circular preview + filename, "Unggah Foto" submit; validates JPG/PNG/WEBP ≤5MB; loads saved avatar on mount via `getAdminMe`.
- **🔴→FIXED CSP block:** uploaded avatars were blocked by `img-src 'self' data: blob:` (API is a different origin). Added the API origin to `img-src` in all 3 CSP defs: `vite.config.js` (dev, + `http://localhost:3001`), `public/_headers` (Cloudflare/Netlify), `public/.htaccess` (Apache) — mirrors what `connect-src` already trusted. **Dev server must be restarted** for the vite.config header to take effect.
- **Docs:** `DEPLOYMENT.md` §5 — added a "CSP must include the API origin (img-src + connect-src), per host; Vercel/nginx read neither `_headers` nor `.htaccess`" open-decision. `DEV-PLAN.md` — #3 admin frontend marked done; **added the admin-topbar avatar as the next frontend-only task** (needs an additive `AuthContext.updateUser`); client avatar still pending.
- **Ponytail plugin:** installed via marketplace (`DietrichGebert/ponytail`), enabled in `~/.claude/settings.json` (global, user); statusline badge wired into global settings. Assessed as low-risk dev-workflow tool that overlaps the existing `.claude/rules` (KISS/DRY/YAGNI).
- **Verified:** `vite build` ✓ after each change; avatar upload smoke ✓ (upload 200 → file 200 image/png `CORP: cross-origin` → `/me` returns avatarUrl). No typecheck impact (frontend-only + api.js).
- **New env vars:** none. **New migrations:** none. **Client-side follow-ups:** client avatar UI (reuse the FormData path + dropzone modal); the CSP `img-src` change is shared (helps client avatars too).
- **Server/branch state left:** servers stopped, ports free. On `tier1-infra`. **Committing this session's work now** (Armada, Klien, avatar+CSP, docs) — NOT pushed (per lock). Untracked `.claude/settings.json` (local per-session command allowlist) intentionally NOT committed — belongs in gitignored `.claude/settings.local.json`.

### 2026-07-04 (cont.) — Beranda "Log Aktivitas" panel → real AdminAuditLog (SUPERADMIN-only, normal-admin actions)
- **Found:** Overview (Beranda) "Log Aktivitas" panel was `MOCK_ACTIVITIES` (hardcoded). `AdminAuditLog` is **written** by 7 route files but had **no read endpoint** (frontend-ahead-of-backend again).
- **Decision (asked user):** Beranda panel is **SUPERADMIN-only** and shows **normal-admin (OPERATIONS/SUPPORT) actions** (oversight view). Backend endpoint tracks **all** admins' activity (scope filter) so a **deferred** Profil-page log (superadmin's OWN actions) can reuse it — user asked to defer that to DEV-PLAN.
- **Fixed — backend (`apps/api`):** new `src/routes/auditLogs.ts` → `GET /api/audit-logs` gated `authenticate + adminOnly + requirePermission("admin:manage")` (SUPERADMIN-only). Params: `scope=normal|all` (default all; `normal` = `where.admin.role in [OPERATIONS,SUPPORT]`), `adminId`, `limit`(1..100, default 20)/`offset`. Returns `{ logs, total }`, `logs[].admin { id, fullName, role }`, `orderBy timestamp desc`. Mounted `/api/audit-logs` in `src/index.ts`. No new audit action / no schema change (read-only over existing table).
- **Fixed — frontend (`apps/web`):** `src/lib/api.js` → `auditLogsAPI.list(params)`. `src/pages/AdminComponents/OverviewSection.jsx`: `useAuth()` → `isSuperAdmin`; panel wrapped in `{isSuperAdmin && …}` and left pane goes `lg:col-span-3` (full width) for non-super; removed `MOCK_ACTIVITIES`; fetch `scope=normal` (limit 8) with working "Muat Lebih Banyak" (offset append, hides when `activities.length >= total`); module-scope helpers `activityVisual` (actionType→icon/color), `humanizeAction`, `relativeTime` (id-ID); loading + empty states; removed the item-stagger anime (items load async → would've been left invisible under `opacity-0`; items now render without it, card still animates).
- **Verified:** api typecheck **45** (unchanged baseline; `auditLogs.ts` + `index.ts` clean → zero new); web `vite build` ✓ (8.30s); **live smoke 10/10** — super/ops login; ops create+update driver (OPERATIONS audit) + super create (SUPERADMIN audit); `scope=normal` (22 rows, all OPS/SUPPORT, includes ops, **excludes** superadmin); shape has admin.fullName/role/actionType/timestamp/changesSummary; `scope=all` (25, both); **OPS GET → 403** ("Khusus Super Admin"); pagination `limit=1`→1 row/total=22; cleaned up 2 test driver rows (audit entries intentionally retained → panel now has real data).
- **Localized the feed to Indonesian (display layer, per user):** `OverviewSection.formatAuditSummary()` maps all 27 `changesSummary` templates + status tokens to Indonesian using the **exact UI labels** (from `AdminStatusBadge`, uppercased): TRANSIT→DALAM PERJALANAN, DITUGASKAN→DITUGASKAN, PENDING→MENUNGGU, DELIVERED→TERKIRIM, FAILED/CANCELLED→DIBATALKAN; invoice DRAFT→KONSEP/SENT→TERKIRIM/PAID→LUNAS/OVERDUE→LEWAT JATUH TEMPO. Full-line regex per template (entity detail preserved); status changes → "Mengubah status … → …" (+ "dikembalikan/diubah paksa oleh ROLE"). Domain loanwords kept as the UI uses them (driver/invoice/admin/password/WhatsApp). **Frontend-only** (stored summaries unchanged → existing dev rows localize on render too). Verified: standalone test **31/31 templates translate**, `vite build` ✓. (User first said TRANSIT→DITUGASKAN, then corrected to DALAM PERJALANAN = the real UI label.)
- **Panel scroll + admin filter (per user, iterated):** panel now **matches the left column ("Pengiriman Terbaru") height** and scrolls the log list inside. On lg the card is `lg:absolute lg:inset-0` inside a `lg:col-span-1 relative` cell (grid-stretched to the left column height) so a long log list can't push the row taller (which would gap the left panel); list is `flex-1 min-h-0 overflow-y-auto custom-scrollbar` (mobile fallback `max-h-[560px] lg:max-h-none`) with a nested `relative` content div so the timeline rail spans full content. `ACTIVITY_LIMIT` 8→12 so the first page fills the matched height. "Muat Lebih Banyak" grows the scroll area, not the panel. Added a **filter-by-admin dropdown** below the subtitle: new `adminsAPI.list()` (`api.js` → `GET /api/admins`, SUPERADMIN) populates it with normal admins; selecting one refetches server-side via the endpoint's `adminId` param (effect keyed on `filterAdminId`); filter-aware empty state. Verified: `vite build` ✓; live smoke 4/4 (GET /api/admins → normal admins; `adminId` filter returns only that admin's rows).
- **New env vars:** none. **New migrations:** none. **Client-side follow-ups:** none (admin-only oversight; audit read is SUPERADMIN-gated).
- **Deferred → DEV-PLAN "🚧 Next planned — Profil-page Log Aktivitas":** wire `AdminProfileSection`'s mock activity list to `GET /api/audit-logs?adminId=<self>` (frontend-only; backend ready). If a normal admin should see their OWN log there, loosen the gate for `adminId === self`.
- **Server/branch state left:** servers **stopped**, ports free. On `tier1-infra`, **uncommitted, not pushed** — adds `src/routes/auditLogs.ts`, `src/index.ts`, `api.js`, `OverviewSection.jsx`, DEV-PLAN + this log (on top of the brand/color batch below).

### 2026-07-04 — Wired Armada brand/model/color + Brands/Colors lookup lists to backend
- **Synced:** on `tier1-infra`, ahead of `origin/tier1-infra` by 3 (our unpushed work), nothing incoming. `origin/main` tip `220c4a1` already in our history → no friend work to merge. (Local `main` shows "behind origin/main by 32" — the stale `ducmonxx-sketch` fork-merge pointer on the untouched `main` branch; irrelevant to admin-scope work.) No pull → skipped `npm install`; ran `prisma generate` after the schema edit. DB `mpl_logistics` was up + all migrations applied.
- **Found (frontend-ahead pattern, as expected):** `ArmadaSection` captured `brand`/`modelName`/`color` form state + had mock `availableBrands`/`availableColors` arrays + Add-Brand/Add-Color modals that only pushed to local state — all **silently dropped** (create/update payloads omitted the 3 fields; no DB columns; no `/brands`/`/colors` routes; edit never prefilled them; list/table/detail never showed them). Confirmed against `fleet.ts` (POST/PATCH didn't read them) + `schema.prisma` (no columns).
- **Decisions (asked user):** brand/model/color **required on create** (DB columns still nullable for backward compat); **any admin** may create brands/colors (`adminOnly`, matching other fleet routes — UI still only shows the "Tambah" buttons to SUPERADMIN, backend just isn't restricted). Approach was already locked in DEV-PLAN: lookup tables + free-text columns, `modelName` not `model`.
- **Fixed — backend (`apps/api`):**
  - `prisma/schema.prisma`: `Vehicle` += `brand String?` / `modelName String?` / `color String?`; new `VehicleBrand` + `VehicleColor` models (`id`, `name @unique`, `createdAt`; `@@map` vehicle_brands/vehicle_colors).
  - **New migration `20260703171800_add_vehicle_brand_color`** — additive (3 nullable cols + 2 tables + 2 unique indexes), no data loss.
  - `src/routes/fleet.ts`: POST/PATCH `/vehicles` now persist `brand`/`modelName`/`color` (`|| null`, `!== undefined` guards — so the Service modal's partial update won't wipe them). New `GET`/`POST` `/api/fleet/brands` + `/colors` (adminOnly; POST trims, rejects empty→400 / dup→409; no audit action — lookups are minor, avoids an enum-migration). Updated the route-list header comment.
  - `prisma/seed.ts`: seed 5 brands (Toyota/Mitsubishi/Hino/Isuzu/Fuso) + 5 colors (Hitam/Putih/Kuning/Merah/Silver) via idempotent upsert; backfill brand/model/color onto the 9 seed vehicles (upsert `update` now sets the 3 fields so re-running `db seed` backfills pre-existing rows).
- **Fixed — frontend (`apps/web`):**
  - `src/lib/api.js`: `fleetAPI.getBrands/addBrand/getColors/addColor`.
  - `src/pages/AdminComponents/ArmadaSection.jsx`: mock arrays → empty + `fetchLookups()` (on mount + when opening the create modal + after adding); list mapping maps `brand/modelName/color`; create sends them + **enforces required**; update sends them (no hard block, so legacy vehicles stay editable); edit prefills from row; Add-Brand/Add-Color modals now `POST` then refetch (with saving state); brand/color `<select>`s use `brandOptions`/`colorOptions` so a current value not in the lookup list is still shown; table "Jenis" column shows `brand model` subtitle; detail panel gained Merk/Model/Warna rows.
- **Verified:** `prisma generate` ✓; `prisma migrate dev` applied clean (no reset/reseed); `npx prisma db seed` ✓ ("5 vehicle brands + 5 colors", 9 vehicles backfilled — idempotent upserts, no re-login needed); **api typecheck = 45** (was ~54 baseline; **`fleet.ts` clean → zero new errors**; remainder is the known `string|string[]`/Prisma-include friction, non-blocking by design); **web `vite build` ✓** (12.18s, only pre-existing chunk-size warning); **live route smoke 7/7** (login; GET brands=5 sorted; GET colors=5; GET vehicles all 9 branded e.g. Isuzu/Giga/Silver; POST brands dup→409, empty→400; POST colors dup→409 — non-polluting, no rows added).
- **New env vars:** none. **New migrations:** `20260703171800_add_vehicle_brand_color` (additive — apply on the other machine with `prisma migrate deploy` + `prisma generate`; safe on a live DB).
- **Client-side follow-ups:** none — brand/model/color are admin-armada-only; client shipment reads unaffected. (If the client ever displays vehicle info, the 3 new nullable fields are available.)
- **Server/branch state left:** servers **stopped**, ports 3001/5173 free. On `tier1-infra`, **all changes uncommitted, not pushed** (per lock). Files: `schema.prisma`, new migration dir, `fleet.ts`, `seed.ts`, `api.js`, `ArmadaSection.jsx`, + these docs.

### 2026-07-02 — Pulled main UI refresh; recovered CLAUDE.md/.claude; brands/colors wiring deferred
- **Pulled `origin/main` → tier1-infra (FF to `220c4a1`).** main had been fast-forwarded from our tip (`18f4f07`) + 1 commit "Update admin components and configurations" (friend's UI refresh). Clean FF, **our backend wiring preserved** (verified: no API calls removed; create-pairing intact). `vite build` ✓.
  - **UI in:** ArmadaSection (brand/model/color fields + Add-Brand/Add-Color **mock** modals), Clients/Drivers/Overview/TrackingSection tweaks, new `AdminDateTimePicker`, minor component updates.
  - **⚠️ Same commit also DELETED `CLAUDE.md` + `.claude/agents/*` + `.claude/rules/*`** (friend migrated to `.agents/skills/**` + `AGENTS.md`) and added `docker-compose.yml`.
- **Recovered** `CLAUDE.md` + `.claude/agents` (6 review subagents) + `.claude/rules` from `18f4f07` (per user) — **kept** the friend's `.agents/` + `AGENTS.md` alongside. (Restoring agent `.md`s mid-session doesn't re-register subagent types for the current run; available next session.)
- **Deferred (design only):** wiring the mock Brands/Colors + Vehicle `brand`/`modelName`/`color` to the backend → captured as a "🚧 Next planned" section in DEV-PLAN + memory `mpl-vehicle-brand-color-wiring`. User will BUILD IN A NEW SESSION.
- **Server/branch:** on `tier1-infra` = `220c4a1` + this recovery/docs commit; ahead of `origin/tier1-infra`; API server stopped.

### 2026-07-01 (cont.³) — Phase ②③: ON_DUTY lifecycle + Ditugaskan status + ShipmentsSection full rewrite
- **Synced:** resumed from context summary; no pull/sync needed (same session, local tree unchanged from prior cont.² entry).
- **Found:** ShipmentsSection.jsx had never been updated to use the driver-vehicle pairing logic; AdminModal rendered behind the detail panel (z-[100] < z-[101]).
- **Fixed — backend (all `apps/api`):**
  - `prisma/schema.prisma`: added `DITUGASKAN` to `ShipmentStatus` enum.
  - `prisma/migrations/20260701130000_add_ditugaskan_status/migration.sql`: `ALTER TYPE "ShipmentStatus" ADD VALUE 'DITUGASKAN' AFTER 'PENDING'` (non-transactional ADD VALUE).
  - `src/lib/statusFlow.ts`: FORWARD map updated — PENDING→DITUGASKAN, DITUGASKAN→TRANSIT, TRANSIT→DELIVERED/CANCELLED; FAILED kept as legacy terminal.
  - `src/routes/shipments.ts`: GET includes `vehicle.primaryDriverId`; assign route conditionally sets DITUGASKAN only when from PENDING (SUPERADMIN re-assign on TRANSIT preserves status); high-workload check counts DITUGASKAN; status route adds departure guard (409 if driver ON_DUTY on another TRANSIT shipment) + Phase ② ON_DUTY auto-lifecycle (`updateMany` with status filter for idempotency) + client notify on CANCELLED.
- **Fixed — frontend (all `apps/web/src/pages/AdminComponents`):**
  - `components/AdminModal.jsx`: z-index `z-[100]` → `z-[200]` (above detail panel at z-[101]).
  - `components/AdminStatusBadge.jsx`: added `assigned` config (label "Ditugaskan", blue).
  - `ShipmentsSection.jsx`: **full rewrite** (was 983 lines, now ~760 lines). Key changes: `mapStatus` adds DITUGASKAN→assigned; `FORWARD_STATUS` updated to match backend flow; `RAW_STATUS_OPTIONS` drops FAILED, adds DITUGASKAN; filter tabs add Ditugaskan, rename Gagal→Dibatalkan; `vehiclePrimaryDriverId` added to mapped shipment; `ExpiryLabel` + `DriverVehicleCard` helper components (2-col driver+vehicle card with near-due/overdue coloring); `openStatusModal` fetches fleet vehicles for PENDING/DITUGASKAN states; `handleConfirmStatus` branches per role+rawStatus (regular admin PENDING→assign+optional link shipment, DITUGASKAN→optional ganti driver+TRANSIT, TRANSIT→DELIVERED/CANCELLED; SUPERADMIN→generic picker); Pengganti badge (shown when driverId ≠ vehiclePrimaryDriverId); SUPERADMIN row assign button kept; regular admin no longer has a row assign button (uses modal).
- **Verified:** `npx vite build` ✓ (6.09s, no errors — only pre-existing chunk-size warnings).
- **Client-side follow-ups:** DITUGASKAN and the new status flow are client-visible. Coordinate with friend during the client-dashboard pass. FAILED → CANCELLED label change also client-visible.
- **New env vars:** none. **New migrations:** `20260701130000_add_ditugaskan_status` (ADD VALUE, non-transactional — apply with `npx prisma migrate deploy` on the other machine; safe to apply to a live DB).
- **Server/branch state left:** servers not running. On `tier1-infra`, **all changes uncommitted**, not pushed (per lock).

### 2026-07-01 (cont.²) — Pushed `tier1-infra` to origin (laptop handoff)
- **Pushed** through `3a7d7b5` — remote `tier1-infra` is now current; local in sync, clean tree. (Branch-push lock lifted by explicit user OK.)
- **▶ Resume on another machine:**
  ```bash
  git checkout tier1-infra && git pull
  npm install                                 # root (workspaces)
  cd apps/api && npx prisma generate          # generated client is gitignored
  npx prisma migrate deploy                   # applies add_vehicle_service_chassis_engine
  # recreate apps/api/.env (GITIGNORED) from apps/api/.env.example — needs DATABASE_URL, JWT_SECRET
  npx prisma db seed                          # if the local dev DB is empty
  ```
  Logins: `admin@mpl.com`/`admin1234` (SUPER), `ops@mpl.com`/`ops1234` (OPS). **Re-login after any reseed** (stale-JWT → writes 500).
- **State + next steps:** see DEV-PLAN **"Where we are (2026-07-01)"**. Next = driver↔vehicle **phase ①** is ⏸ parked pending a schema discussion with the friend; otherwise profile-info form / #4 / #1 / #6.
- **Note:** persistent `~/.claude` memory is machine-local (won't be on the laptop) — but all gotchas are also captured here + in DEV-PLAN.

### 2026-07-01 (cont.) — #2 admin self-service password reset (profile)
- **Frontend was ahead:** `AdminProfileSection` already had a current/new-password form, but `handlePasswordSubmit` was a simulation and no endpoint/API wrapper existed.
- **Backend:** new **`PATCH /api/auth/admin/me/password`** (`auth.ts`) — self-service for **any** admin (`authenticate` + `adminOnly`, no role gate → works for OPERATIONS/SUPPORT **and** SUPERADMIN). Verifies current password (bcrypt), enforces new ≥6 chars + must differ, updates hash, audits (`RESET_PASSWORD`, self).
- **Frontend:** `authAPI.changeAdminPassword(data)` in `api.js`; wired the profile form to it (async + `isSavingPassword` state + button "Menyimpan…"/disabled; validates current-password present).
- **Verified:** api typecheck **54** (no new); web `vite build` ✓; eslint clean on `AdminProfileSection`; end-to-end test as `ops` — wrong-current→400, too-short→400, change→200, new-pw login→200, old-pw→401, revert→200 (dev data left clean, `ops1234` restored).
- **Left simulated (separate follow-ups):** the profile-info form (fullName/email — no admin self-update endpoint yet); the profile avatar still uses a `ui-avatars` placeholder (part of the #3 avatar-UI handoff).
- **Server/branch:** on `tier1-infra`; uncommitted (`auth.ts`, `api.js`, `AdminProfileSection.jsx`).

### 2026-07-01 — Shipment page: assign-button RBAC gate + status-change failure triage
- **Assign-driver button gated by role** (`ShipmentsSection.jsx`): the row "Tugaskan Driver" action + `openAssignModal` guard now disable assignment for **normal admins (OPERATIONS/SUPPORT) unless the shipment is PENDING ("Menunggu")**; **SUPERADMIN can (re)assign at any status**. (Was: disabled only when `delivered`, for everyone.) Verified: `vite build` ✓, eslint = 3 pre-existing only.
- **Status-change "fails" — triaged, backend RULED OUT.** Reproduced the exact call against the live server: ops forward PENDING→TRANSIT = **200**, ops reversal TRANSIT→PENDING = **403 (by design)**, super reversal = **200** (data reverted clean). The frontend modal payload (`{ status }`) matches the repro that returns 200, and the file builds. ⇒ failure is **environmental or scenario-specific** (likely a stale dev process, or a normal admin attempting a backward move on a stale all-options dropdown). **→ RESOLVED:** it was a **stale localStorage session** after the reseed — the old JWT was still valid (so no logout), but its admin id was wiped by `migrate reset`, so writes hit FK violations while reads stayed fine. Re-login fixes it; **not a code bug.** Saved as memory `mpl-stale-session-after-reseed`.
- **Driver–vehicle design finalized → DEV-PLAN.** Captured the signed-off design as the phased "🛠️ Planned" section: driver↔vehicle 1:1 pairing (**provisional**), substitute-driver swap via a Ganti-Driver confirmation modal (radio list excl. On-Duty/UNAVAILABLE + "tandai tidak tersedia" checkbox), new **On Duty** driver status (blue, auto-lifecycle) + **Ditugaskan** shipment status, and a departure guard. No code yet; client-dashboard coordination deferred to the user's client-side pass.
- **Server/branch:** servers were running (hit :3001 for repro). On `tier1-infra`, still uncommitted / not pushed.

### 2026-06-30 (cont.) — Shipment status-change UX: "Ubah Status" button → confirmation modal (dynamic per role)
- **Scope:** `apps/web/src/pages/AdminComponents/ShipmentsSection.jsx` only — frontend. Backend `lib/statusFlow.ts` already 403-enforces; no backend change. `origin/main` had no new commits (friend frozen).
- **What changed:** replaced the inline status `<select>` in the shipment detail panel with an **"Ubah Status" button → `AdminModal` confirmation box**. The modal shows the current-status badge + the **valid target statuses as selectable option buttons**, then "Konfirmasi" commits. (Implements original frontend roadmap item #8.)
- **Dynamic options** — new `availableStatusOptions(role, from)` (replaces last session's `canSelectStatus`): OPERATIONS/SUPPORT forward-only per `FORWARD_STATUS` (PENDING→TRANSIT/CANCELLED, TRANSIT→DELIVERED/FAILED, terminals→none → button disabled "Status sudah final"); **SUPERADMIN → all statuses except the current one**.
- **Handlers:** `handleStatusUpdate` now returns a success boolean; new `handleConfirmStatus` guards "no selection", calls it, and closes the modal **only on success** (stays open on error for retry). Reuses the existing toast / refetch / badge-animation.
- **Decisions (confirmed with user):** SUPERADMIN = all-except-current; modal style = selectable option buttons.
- **Supersedes** last session's disabled-options dropdown. `FORWARD_STATUS` kept/reused; `canSelectStatus` removed (no dangling refs — build confirms).
- **Verified:** web `vite build` ✓; eslint on `ShipmentsSection` = 3 **pre-existing** issues only (exported consts + a hook-dep warning), none new. Backend/smoke not run (frontend-only; would pollute the fresh seed).
- **Server/branch state left:** on `tier1-infra`, uncommitted (adds to the existing pile), **not pushed**.

### 2026-06-30 — Shipment page: RBAC status dropdown + WA-button freeze; vehicle service/chassis/engine fields; full reseed
- **Synced:** pulled `origin/main` again → `c635f3d` (frontend filters/animation, 100% `apps/web`, no backend changes); merged into `tier1-infra` (local only). Friend confirmed **frontend frozen until next week** → ownership clear to edit `apps/web`.
- **Vehicle fields (schema migration `add_vehicle_service_chassis_engine`):** added `serviceDate`, `chassisNumber`, `engineNumber` (all nullable) to `Vehicle`; `fleet.ts` create+update now accept/persist them; overdue `serviceDate` raises a compliance alert via `flagIfExpired` ("Jadwal Service"). **This completes existing frontend** — the friend's `ArmadaSection` already had a "Tanggal Service" picker, a "Perbarui Jadwal Service" modal, chassis/engine inputs, and a service-overdue badge, but the backend was **silently dropping all three**. No frontend change needed; that UI now persists. (`serviceNotes` from the modal still has no backend home — needs a service-log table; deferred.)
- **Full reseed** (`seed.ts` rewritten): 2 admins (`admin@mpl.com`/SUPERADMIN, `ops@mpl.com`/OPERATIONS — both now in seed), **10 clients** (8 tracked + 2 idle; `PT Sinar Gagal Jaya`=1 active+2 failed, `CV Gagal Sekali`=1 failed), **8 drivers** (4 active / 2 unavailable / 2 active-with-expired-SIM), **9 vehicles** (2 clean + all 6 single/double STNK/KIR/Service combos + 1 triple-overdue, all fields filled), **13 shipments** (2 DELIVERED / 4 PENDING / 4 TRANSIT / 3 FAILED). Ran `prisma migrate reset --force` (Prisma blocks AI from this without `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` = user's verbatim consent — obtained) then **`npx prisma db seed`** (⚠️ migrate reset does NOT auto-run the Prisma 7 `prisma.config.ts` seed). Verified all counts via read-only query.
- **Frontend `ShipmentsSection.jsx`:**
  - **(B)** Shipment-detail **status dropdown gated by RBAC** — options disabled per role via `FORWARD_STATUS` + `canSelectStatus` (mirrors `lib/statusFlow.ts`): OPERATIONS/SUPPORT forward-only (`PENDING→TRANSIT/CANCELLED`, `TRANSIT→DELIVERED/FAILED`, terminals locked), SUPERADMIN unrestricted. Role from `useAuth().user.role` (admin login returns it). Backend already 403-enforces — this is the matching UX gate.
  - **(C)** **WhatsApp notify-driver button freeze** — disabled while the OpenWA request is in-flight (label "Mengirim…") and after a successful send (label "Notifikasi Terkirim", check icon), tracked per shipment id (`notifyingId` + `notifiedIds`). Errors re-enable for retry.
- **Verified:** api typecheck **54** (no new — fleet.ts errors are pre-existing `req.params.id` friction); web `vite build` ✓; eslint on `ShipmentsSection` = 3 **pre-existing** issues only (exported consts + a hook-dep warning), none new. **Smoke NOT run** — it would pollute the fresh seed; per the new rule, reseed/clean after any smoke before manual testing.
- **New migration:** `add_vehicle_service_chassis_engine`. **New env:** none. **Client-side:** Armada service/chassis/engine now persist (friend's UI lights up, no FE change).
- **Server/branch state left:** servers stopped. On `tier1-infra`, uncommitted (this session): `schema.prisma`, `fleet.ts`, `seed.ts`, new migration, `shipments.ts` (WA + this), `index.ts` (rate limit), `DEPLOYMENT.md`, `RUNBOOK.md`. **Not committed, not pushed.**

### 2026-06-29 (cont.) — Resync + backend setup on `tier1-infra` (puller side)
- **Synced:** `tier1-infra` fast-forwarded `3299e22 → 54967e0` (the feature work logged below). Working tree clean, **not pushed**.
- **Resync:** `npm install` ✓ (17 pkgs — `multer`, `nodemailer` + deps). `npx prisma generate` ✓. `npx prisma migrate deploy` ✓ — applied the 2 pending migrations (`add_avatar_key`, `add_create_admin_audit`). Seed **not run** — dev DB already seeded (smoke obtained tokens fine).
- **Found:** nothing broken. Postgres 18 service running on :5432. Typecheck at **54** (matches baseline — no new debt; CI typecheck is non-blocking by design). Smoke **26/26**. Health + alert scheduler boot clean.
- **Fixed — WA driver-notify message** (`shipments.ts` `POST /:id/notify-driver`): (1) added a `Detail Muatan:` line = `packageType` + optional `(N unit)` so the driver sees the cargo description; (2) replaced the hardcoded placeholder pickup/dropoff addresses with the shipment's real `originLocation` / `destinationLocation` (drove the text + Google-Maps links to the wrong place before). Both verified by rendering against a real shipment. **Reviewed** by typescript-reviewer (diff clean) + security-reviewer (the 300→1500 raise is fine; deploy-gating rate-limit findings logged to DEPLOYMENT.md §5). **Still hardcoded (separate follow-up):** `ADMIN_PHONE` at `shipments.ts:270` → move to `process.env.ADMIN_WHATSAPP`. Note: origin/destination are currently city-level (e.g. "Jakarta"/"Surabaya") → Maps links are coarse until the planned shipment-form rework captures full addresses (then the message improves with no code change). **Deferred:** `npm audit` 14 vulns — separate hardening task.
- **Merged `origin/main` → `tier1-infra`** (merge commit, local only, not pushed): `0af3058` "Update frontend features and UI components" — **100% frontend (`apps/web`), NO backend changes.** The two shared-contract files it touched are client-only: `api.js` (only the 401→login redirect logic; still missing `credentials:'include'` + no FormData avatar helper → #3 avatar handoff still open) and `TrackingSection.jsx` (anime.js slide-in + cosmetic `#`-id guard). No `package.json` change → no web reinstall needed.
- **Rate limiter tuned** (`index.ts`): general limit **300 → 1500 / 15min** (named consts `API_MAX` / `AUTH_MAX` / `RATE_WINDOW_MS`); auth kept at **50**. Root cause of the "Terlalu banyak permintaan" 429s + frozen-dashboard feel: the SPA polls ~every 8s across many sections (`setInterval(..., 8000)` in Admin*Section + AdminDashboardPage notifications + TrackingSection), so ~15+ req/min idle blew the old 300 fixed-window in ~10–13 min, then locked out for the rest of the window. **DEFERRED (Option A):** auth requests are billed to BOTH limiters (`/api/auth/*` matches both `app.use("/api/auth")` and `app.use("/api")`) — harmless now (auth isn't polled), but revisit if a polled `GET /api/auth/admin/me` session-check is added, and **decide the best rate-limit strategy at deployment testing** (per-IP keying interacts with the deploy topology: LAN admins behind one office IP, public clients behind NAT). Fix options if needed: (B) `apiLimiter` `skip: req => req.originalUrl.startsWith('/api/auth')`; (C) per-router limits. Frontend follow-up (friend): 8s polling is aggressive → 20–30s or websockets.
- **New env vars:** added the documented blocks to local `apps/api/.env` (gitignored) — `STORAGE_DRIVER=local` / `STORAGE_LOCAL_PATH=./uploads`, plus empty `OPENWA_*` / `SMTP_*` / `ADMIN_*` (all no-op when blank). **New migrations:** the 2 above, now applied.
- **Dev DB:** added a normal **OPERATIONS** admin for RBAC testing — `ops@mpl.com` / `ops1234` (the seed only creates the SUPERADMIN `admin@mpl.com` / `admin1234`).
- **Client-side follow-ups:** none new (the frontend handoffs from the feature work below still stand).
- **Server/branch state left:** servers **stopped**, ports free. On `tier1-infra` (ahead of `origin/tier1-infra` by 2 = main-merge + the earlier session-log commit); working tree has the WA-message edit (`shipments.ts`), the rate-limit tune (`index.ts`), + this RUNBOOK edit, **uncommitted, not pushed**.

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
