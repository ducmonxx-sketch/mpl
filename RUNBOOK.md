# MPL Runbook — Sync & Integration Audit Cookbook

> **NEW SESSION, READ THIS FIRST.** Do not touch code until you have:
> 1. Read the cookbook (**§1–§5**) — it's short.
> 2. Run **§2 Get Local Up To Date** (sync), then **§3 Integration Audit**.
> 3. **Reported findings** (broken / mismatched / client-side-note) to the user *before* editing anything.
> 4. Skim the **newest §6 Session Log** entries for recent context (older logs are in **RUNBOOK-ARCHIVE.md** — read only if you need history).
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

### 2026-07-18 — Plant-check wizard (relational, dynamic) + Kepala Gudang leg (Diterima→Diturunkan→Selesai) + pushed to main
- **Branch:** worked on `tier1-infra`; committed `e6860b2` (plant-check dynamic rows), `d3d5010` (wizard UX polish), `09a7265` (gudang leg). **Pushed to `main`** (fast-forward `9f38e98→09a7265`, verified `origin/main` was an ancestor — no force) **and** synced `origin/tier1-infra`. ⚠️ `main` now carries the full tier1-infra pipeline work (12 commits ahead of the old main) — flag to the friend who also pushes `main`.
- **Resync:** prisma generate ✓ / migrate dev ✓ (2 new migrations) / no reseed needed (seed doesn't create plant-checks/handovers). ⚠️ `migrate dev --skip-generate` errored (arg parse) → ran plain `migrate dev`; had to `prisma generate` again before the new `catatan*` fields typechecked.
- **Plant-check made relational + dynamic (PIC_PABRIK, AT_PLANT→TRANSIT):**
  - Schema: dropped the scalar plant-check columns; new child table **`plant_check_pengiriman`** (multi-row Data Pengiriman) alongside existing `lku`/`ksu` (`migration plant_check_pengiriman_rows`). `/plant-check` accepts `dataPengiriman` as an **array**; both GET includes hydrate `pengiriman`.
  - Wizard (`ShipmentsSection.jsx`): Data Pengiriman now dynamic add/remove (no prefill); KSU **Tipe Motor auto-assigned** (one row per distinct motor type, no dropdown/add/remove) with Data-Pengiriman `keterangan` shown in `[brackets]`; LKU starts with a default row + Tipe Motor **dropdown** synced from Data Pengiriman; Tambah Baris moved to bottom (thin outline); red-circle remove top-right; auto-scroll to new row.
  - **Draft autosave** per shipment in `localStorage` (`mpl:plantCheckDraft:<id>`), restored on reopen, cleared on submit; **Clear All** button (filled red). Confirmation box is now a **segmented summary** (Data Pengiriman + LKU tables, KSU cards). Detail panel **soft-refreshes via `getById`** after submit (shared `mapShipment` extracted) so Pengecekan Pabrik shows immediately.
- **Kepala Gudang leg (PIC_GUDANG):**
  - Dashboard: hid Total Klien + Driver Tersedia for PIC_GUDANG. Detail modal: **removed Lacak Penuh** for all roles. Pengiriman page now uses the compact field layout for PIC_GUDANG; **fixed a dead `KEPALA_GUDANG` sort key** (real role is `PIC_GUDANG`, was silently falling back to DEFAULT) → order Dalam Perjalanan→Diterima→Diturunkan→Selesai→Standby→Ditugaskan→Di Pabrik.
  - Update-Status flow: TRANSIT→Diterima and Diterima→Diturunkan are **one-tap confirmations** (via `/status`); Diturunkan→Selesai shows a **"Catatan Serah Terima Perlengkapan Motor"** form (Plant Pengirim / Gudang Penerima columns) → confirmation box echoing both notes → `/handover`→DELIVERED, then soft-refresh.
  - Backend: new `Shipment.catatanPlantPengirim` / `catatanGudangPenerima` (`migration gudang_serah_terima_notes`); `/handover` persists them.
- **Verified:** web `vite build` ✓ (every step); API `tsc` clean for new code (only pre-existing query-param `string|string[]` + unrelated `driver`-include errors remain); API server restarted on **:3001**, `/health` 200.
- **New env vars:** none. **New migrations:** `plant_check_pengiriman_rows`, `gudang_serah_terima_notes` (run `prisma migrate deploy` on other envs).
- **Client-side follow-ups:** 🔵 none new (all admin-scope). Prior notes still stand (auto-WA double-fire, client Faktur removed, TrackingSection ETA).
- **Deferred:** Surat Jalan print-to-PDF (pulls plant-check + serah-terima); prune now-unused `serahTerimaUrl`/`handoverNotes` state + `onTrackFull` wiring; show serah-terima catatan in the read-only detail panel; **context.md refresh** (now that pabrik+gudang flows are done).
- **Server/branch state left:** API server **running** on :3001 (tsx watch, hidden window). On `tier1-infra`, all committed + pushed; `main` and `tier1-infra` both at `09a7265`.

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

> **Older entries (2026-07-07 and earlier) are in [RUNBOOK-ARCHIVE.md](RUNBOOK-ARCHIVE.md)** — kept out of the live file to save context.

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

