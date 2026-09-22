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

### 2026-09-22 (cont.) — Whole-project audit → per-page docs, fix plan, OPERATIONS create-form parity, smoke rewrite (50/50)
- **Env resync after 2 months away:** pulled `main` `f97bf0c→ba48b2c` (~126 commits: Phase-2 cookie/CSRF/2FA auth, server-side pagination+indexes, image pipeline, magic-link onboarding, condition analytics). `npm install` → `prisma generate` → 12 pending migrations applied → reset+reseed. ⚠️ `.claude/settings.json` is now GIT-TRACKED (came in with main) — local permission churn in it should be discarded, not committed.
- **Audit (6 parallel doc agents + health checks):** wrote **[docs/pages/](docs/pages/)** — 13 per-page docs + README index for both dashboards (endpoints, load-bearing state, couplings, gotchas, add-a-feature checklists). Added the CLAUDE.md rule: **read the page doc before building on a page; update it in the same commit.**
- **Findings:** ranked fix plan in **[client-deployment.md](client-deployment.md)** — packages 1–3 (client) → friend's rehaul with handoff notes (🔴 package 3 = live data corruption: client create stores pcs as `weightKg`); packages 4·6·5·8·9 (admin/backend) → **[docs/plans/admin-backend-fixes.md](docs/plans/admin-backend-fixes.md)** step-by-step execution guide written for a cheaper model to run.
- **OPERATIONS create-form parity (user request):** both creator roles now share the Armada create form (`usesArmadaCreateForm` replaced the `role === 'KEPALA_ARMADA'` checks across validation/payload/JSX); legacy generic form kept in the else-branch marked **FUTURE FEATURE PLAN**; backend `initialStatus` now keys off "driver+vehicle attached" (STANDBY + mirror) instead of the role literal. **Verified live as admin2 (cookie+CSRF): create 201 → STANDBY, fleet mirrored, delete frees.**
- **Package 7 DONE — smoke suite resurrected:** was dead (Bearer removed by Phase 2; `ops@mpl.com` no longer seeded; seed has no clients). Rewrote to cookie-jar identities + `x-csrf-token`; suite bootstraps its own client from create-klien's `temporaryPassword`; guard test subject OPERATIONS→PIC Gudang (OPS gained `status:override`); added no-legacy-token + CSRF-enforcement asserts; trip 1 now DELIVERED before trip 2 departs (departure guard). **50/50, self-cleaning (7 records removed).**
- **Verified:** API typecheck 0 · web build green · smoke 50/50. `npm audit`: 30 vulns (1 critical jsPDF) — package 9, ask first.
- **Server state:** API :3001 + web :5173 running (background). **Not pushed** — commits local, awaiting user OK.

### 2026-09-17 — Laporan chart: click-a-dot drill-down to the underlying shipments
- **Synced:** `tier1-infra`, continuation of 2026-09-16's condition-analytics work, same session context (no fresh pull needed).
- **Built:** user attached a screenshot of the chart's hover tooltip and asked to go one level deeper — clicking a point should list the actual shipments behind that day's/month's numbers, not just the aggregate. Planned via `EnterPlanMode`/`ExitPlanMode` (multi-file, both API + UI) before touching code.
  - **New `GET /api/shipments/condition-analytics/detail?period=<period>&category=...`** in `apps/api/src/routes/shipments.ts` (placed before the `/:id` catch-all route, same reasoning as `/condition-analytics`). Accepts the exact same `period` string the chart already carries per point (`YYYY-MM-DD` for a day bucket, `YYYY-MM` for a YTD month bucket — detected by string length, validated with a regex, 400 on anything else) and returns up to 200 shipments (+ a `total` count for "showing X of Y") with per-shipment perfect/defective counts and their raw `PlantCheckLku` rows.
  - **`ShipmentConditionChart.jsx`**: both `Line`s now use a **custom `activeDot` render function** (`makeActiveDot`) instead of the `{r:5}` shorthand, so points stay clickable even in dense (`isDense`) views where the static `dot` is hidden — Recharts still renders `activeDot` on hover regardless. Clicking a future (`null`-valued) point is a no-op (non-pointer cursor). New `onPointClick` prop bubbles `{period, label, category}` up — `category` (local state in this component) rides along so nothing needed lifting.
  - **New `ConditionDetailModal.jsx`**: a read-only portal-to-`<body>` dialog (deliberately NOT `AdminModal`, which is a save/cancel form shell) listing shipments for the clicked point — ID, client, destination, category badge, per-shipment perfect/defective counts, gold/faded-red dots matching the chart's palette.
  - **`ReportSection.jsx`**: owns `drillDown` state (`{period,label,category}` | `null`), passes `onPointClick={setDrillDown}` to the chart and conditionally renders the modal.
- **Verified:** `vite build` clean. Curl-tested the new endpoint directly: day-detail (`2026-09-08`, all categories) summed to 7 perfect/1 defective, exactly matching that same day's bucket from `/condition-analytics`; month-detail (`2026-03`, category=Unit) summed to 103/23, exactly matching the YTD bucket for March/Unit; invalid `period` correctly 400s. **Not verified in an actual browser** — same caveat as the PDF export: clicking a dot and confirming the dialog opens correctly needs a real browser session, which this environment can't drive.
- **Follow-up same session — modal replaced with a subpage + real-record link:** user reconsidered after seeing the modal plan — wanted it as a subpage (not a popup) and "integrated with the Shipments section data." Discussed two readings: (a) add real date/category filtering to `ShipmentsSection.jsx` itself (~2,900 lines, no such filtering exists there today beyond a text search — a much bigger, riskier change), vs (b) keep the day-detail on its own page using the endpoint already built, with each row linking into the real shipment record. User picked (b). Replaced `ConditionDetailModal.jsx` (deleted) with **`ConditionDetailPage.jsx`** — renders inline in `ReportSection.jsx` (swaps out the chart/summary while a point is selected, restored via a "Kembali ke Laporan" back button) using **`AdminDataTable`** (the same table component `ShipmentsSection`/`OverviewSection` already render their lists with) instead of custom cards. Each row's ID is clickable and calls `onNavigateToShipment(id)` — the **exact same cross-section jump already used from Overview's recent-shipments table** (`AdminDashboardPage.jsx`'s `navigateToShipment`, which sets `shipmentHighlightId` + switches `activeNav` to `'shipments'`; `ShipmentsSection` already auto-opens that shipment's detail panel on `highlightShipmentId`) — newly threaded through to `ReportSection` (`case 'laporan':` now passes `onNavigateToShipment={navigateToShipment}`). No backend change needed for this part — same `/condition-analytics/detail` endpoint from the step above. `vite build` clean.
- **Same-session follow-up — ID click now expands in place instead of navigating away:** user saw the "Lihat di Pengiriman" table and preferred an accordion over an immediate jump. `ConditionDetailPage.jsx`'s ID column now calls `AdminDataTable`'s built-in `toggleRow` (via the render callback's 3rd arg) instead of `onNavigateToShipment` directly, and a new `expandableContent` prop renders that shipment's per-unit breakdown (tipeMotor/noRangka/arrivedDefective/arrivalNote — already present in the endpoint's response, no new request) inline. The "jump to the real record" behavior wasn't dropped, just relocated: a "Lihat detail lengkap di Pengiriman" link sits inside the expanded row. No backend or endpoint changes. `vite build` clean.
- **Same-session follow-up — dots near the top/bottom edge were hard to click:** user's screenshot showed a peak point sitting right at the plot's top edge. Fixed in `ShipmentConditionChart.jsx` with 4 changes rather than just "make it bigger": (1) the custom `activeDot` now renders a 14px-radius **transparent hit target** under the visible 5px dot (`pointerEvents="none"` on the visible circle so it doesn't shadow the click) — same idea as widening a tap target beyond what's visually drawn; (2) `YAxis` got `domain={[0, dataMax => Math.ceil(dataMax * 1.2)]}` so the line's peak sits ~20% below the plot's top edge instead of flush against it; (3) chart `margin` top raised 4->24 and bottom 4->14 so the enlarged hit circles have room even at true min/max without being clipped by the SVG bounds; (4) container height `h-72`->`h-96` plus `mt-2` so the plot has more room overall and a clearer gap under the Semua/Unit/Kargo/Container tabs. No data/endpoint changes. `vite build` clean.
- **Same-session follow-up — day-bucket labels now DD-MM-YYYY, then DD-FullMonth-YYYY:** `/condition-analytics`'s day-granularity `label` (Bulan Ini/3 Bulan) changed from `"8 Sep"` to `"08-09-2026"`, then per a follow-up ask to `"08-September-2026"` (full month name, then dashes dropped for `"08 September 2026"` — `monthLabels` swapped from Indonesian 3-letter abbreviations to full Indonesian names; defaulted to Indonesian over English since the rest of the app's UI is Indonesian, flagged to the user in case they meant English). Also picked up by the YTD month-granularity label for consistency (`"Sep 2026"` -> `"September 2026"`), same array. Single source of truth (the backend `label` field), so the chart x-axis, its tooltip, and `ConditionDetailPage`'s header all picked it up with no frontend change. Verified live via curl both times.

### 2026-09-16 — Shipment condition analytics (Kepala Armada→Gudang): arrival-defect flag + Overview chart
- **Synced:** `tier1-infra`, even with `origin/tier1-infra` (0/0), no pull needed. Large pre-existing uncommitted tree (SEO/asset work, `.agents`→`.claude` migration, magic-link-era schema/seed/route edits) left untouched — not part of this session's scope.
- **Built (admin-dashboard scope, per client request for a Monthly/3-Month/YTD condition graphic):**
  - **Schema:** `PlantCheckLku` +`arrivedDefective Boolean @default(false)` +`arrivalNote String?` (arrival condition, set by Kepala Gudang — distinct from Pengurus Pabrik's pre-departure `itemDefect`). `Shipment` +`@@index([status, completionDate])` for the new analytics query. Migration `20260916092103_add_arrival_defect_flag`.
  - **`PATCH /api/shipments/:id/handover`:** now accepts `lkuUpdates: [{ id, arrivedDefective, arrivalNote }]` — Kepala Gudang ticks arrival condition against the shipment's existing `PlantCheckLku` rows (no equipment/KSU tracking — user's explicit call: one combined bike+equipment flag per unit, not per-equipment-field). Added an ownership check (rejects ids not belonging to this shipment's plant check, 400) and the previously-missing status-flow guard (`canChangeStatus`, 403) — this route used to set `status: DELIVERED` unconditionally regardless of current status. Wrapped the shipment + LKU updates in `prisma.$transaction`.
  - **New `GET /api/shipments/condition-analytics?range=month|quarter|ytd`:** monthly-bucketed `{ unitsPerfect, unitsDefective }` for `DELIVERED` shipments by `completionDate`. Plain Prisma fetch + in-app grouping (no `$queryRaw` — none exists elsewhere in this codebase).
  - **Frontend:** `ShipmentsSection.jsx` DITURUNKAN branch now renders the LKU checklist (checkbox + optional note per unit) above the existing Gudang Penerima textarea, seeded from `selectedShipment.plantCheck.lku` when the modal opens. New `apps/web/src/pages/AdminComponents/components/ShipmentConditionChart.jsx` (Recharts stacked bar, Month/3-Month/YTD toggle, dashboard color tokens). Added **`recharts`** as a new frontend dependency (first charting lib in this repo) — `npm audit` confirms it introduces no new vulnerabilities (pre-existing ones are all in `jspdf`/`xlsx`/`react-router`, untouched).
  - **New "Laporan" nav section** (own sidebar item under UTAMA, next to Beranda — user asked for the chart to live in its own section rather than inside Overview): new `ReportSection.jsx` hosts `ShipmentConditionChart`; wired into `AdminDashboardPage.jsx` (`activeNav === 'laporan'`) and `AdminSidebar.jsx` (`NAV_GROUPS`, plus added to the `KEPALA_ARMADA`/`PIC_PABRIK`/`PIC_GUDANG` allow-lists alongside `overview`). Chart removed from `OverviewSection.jsx` (moved, not duplicated).
  - **Service-line filter (Semua/Unit/Kargo/Container):** `GET /condition-analytics` takes `?category=all|Unit|Cargo|Container` (matches `Shipment.shippingCategory` values used elsewhere in `ShipmentsSection.jsx`), filtering the same `where` clause. `ShipmentConditionChart.jsx` got a second tab row for this plus a "% Sempurna" badge computed client-side from the fetched totals. **Caveat (flagged, not fixed):** arrival-condition tracking only exists on `PlantCheckLku` (motor-unit rows from the plant-check wizard) — Cargo/Container shipments generally have no LKU rows, so those two tabs will show 0/0 buckets until/unless a Cargo/Container-specific condition capture point is built. Confirmed via manual curl (category param round-trips correctly, no errors); did not have live Cargo/Container DELIVERED data in the dev DB to visually confirm non-zero bars.
- **Chart refinement (line chart + brand colors, icon fix):** the stacked bar chart looked bad per user feedback. `ShipmentConditionChart.jsx` now renders a Recharts `LineChart` instead: "Kondisi Sempurna" line in the dashboard gold (`var(--dash-secondary, #fec330)`), "Rusak" in a deliberately **faded/muted red** (`#f4978e`, not the harsh `--dash-error` used for real alerts) per the user's request that it "not intimidate the viewer." The "% Sempurna" badge recolored to match (gold tint instead of green). Also fixed a real bug: the Laporan sidebar icon was silently missing because `AdminSidebar.jsx` referenced `icon: 'insights'`, which doesn't exist in `Icon.jsx`'s icon map (it fails silently — `console.warn` + `null`, no crash) — swapped to `'trending_up'` (an icon that does exist, and fits a line-chart report page).
- **Bucket granularity change (per user request):** `condition-analytics` now buckets **daily** for `range=month` (1st-last day of current month, ~30 points) and `range=quarter` (1st day of the month 2 back through the last day of the current month, ~90 points); `range=ytd` stays **monthly** (Jan-current month) as before. Response field renamed `month` -> `period` (not used by name in the frontend, so no chart-side change needed for the rename itself). `ShipmentConditionChart.jsx` thins x-axis tick labels and hides per-point dots once a range has >15 buckets (`isDense`), so the ~90-point quarter view doesn't turn into unreadable overlapping text. Verified against the live server: month = 30 buckets, quarter = 92 buckets, ytd = 9 buckets, with real non-zero days showing through correctly from the demo data below.
- **Chart quality pass (dataviz skill + computed checks, not eyeballed):** ran `validate_palette.js` from the `dataviz` skill on the gold/red pair — the raw brand gold `#fec330` **failed** the lightness band (0.848, too light) and had only 1.57:1 contrast as a line color. Swapped the chart's line/dot color to `#b8860b` ("chart gold" — passes lightness, contrast, CVD-safety, and normal-vision-floor checks against `#f4978e`); `--dash-secondary` (#fec330) stays on buttons/tabs/badge, unchanged. Also fixed 3 more issues found via the same pass: (1) `condition-analytics` was plotting future dates (days that haven't happened yet, within the current month/quarter) as real `0`s, making the line falsely crash to the floor at today's date — now returns `null` for those buckets (`unitsPerfect`/`unitsDefective` typed `number | null`), with `connectNulls={false}` on the frontend so the line just stops instead of dropping to zero; (2) dashed gridlines (`strokeDasharray="3 3"`) replaced with solid hairline (chart-convention: gridlines are never dashed); (3) added a subtle ~15%-opacity gold gradient wash under the "Kondisi Sempurna" line via a `ComposedChart` (`Area` + two `Line`s) — required a custom `Tooltip` content (`ConditionTooltip` in the same file) to dedupe the Area/Line sharing one dataKey, otherwise "Kondisi Sempurna" appeared twice per tooltip. Verified live: Sep 16 (today) shows real data, Sep 17+ is `null` as expected.
- **"Unduh Laporan" upgraded from raw CSV to a branded PDF report** (user wanted something "more professional" with a chart, not a raw data dump; brainstormed options and the user picked this one). Reuses the exact jsPDF + `jspdf-autotable` + logo-rasterize pattern already proven in `ShipmentsSection.jsx`'s Surat Jalan generator (same MPL letterhead/address, same `svgToPng`-style helper, lazy-imported on click). New: `svgToPngDataUrl()` in `ServiceLineSummary.jsx` serializes the **live Recharts `<svg>`** (via a `chartRef` now threaded down from `ReportSection` through both `ShipmentConditionChart` and `ServiceLineSummary`, since they're siblings) into a canvas and embeds it as a PNG in the PDF, followed by an `autoTable` summary (category / total / perfect / defective / % of total). **Flagged during brainstorming, not attempted:** no free JS library (including this repo's `xlsx` dep) can write a real editable Excel chart object — that needs SheetJS's paid Pro tier — so a native-Excel-chart request would have meant either a picture-in-a-spreadsheet compromise (`exceljs` + image embed) or this PDF route; user chose the PDF. **Not verified in an actual browser this session** — the rasterization path depends on `Image`/`canvas`/`XMLSerializer`, which only `vite build`'s clean compile does not exercise; recommend clicking "Unduh Laporan" once to confirm the chart image and table render correctly before considering this done.
- **New "Distribusi Layanan" summary card** (user shared a reference screenshot of a hero-%/legend/segmented-bar widget and asked for the same under the chart): new `apps/web/src/pages/AdminComponents/components/ServiceLineSummary.jsx`, mounted below `ShipmentConditionChart` in `ReportSection.jsx`. Shows: a hero % (overall perfect-condition rate across all 3 service lines, for the shared range), a 3-item legend (Unit/Kargo/Container share of total shipped units), and a segmented bar sized by those shares. `range` (Bulan Ini/3 Bulan/YTD) was **lifted from `ShipmentConditionChart` up to `ReportSection`** so both cards describe the same period with one control (chart's `category` tab stays local — the summary always shows all 3 lines by definition). Data comes from 3 parallel calls to the existing `getConditionAnalytics(range, category)` — no new backend endpoint. **Colors are deliberately NOT the chart's gold/red** (those are reserved status colors for perfect/defective) — used the dataviz skill's validated categorical slots 1-3 (blue `#2a78d6`/orange `#eb6834`/aqua `#1baf7a`) instead, since hand-tuning brand-navy variants kept failing the chroma-floor/lightness-band checks. "Unduh Laporan" is a **working CSV export** (client-side Blob download, no backend call) of the per-category totals; "Pause Task" from the reference image was dropped per user's call — it doesn't map to anything in this domain.
- **Demo data for the Laporan chart:** added `apps/api/prisma/seed-condition-demo.ts` (NOT part of `prisma/seed.ts`'s lifecycle — a throwaway one-off, run via `npx tsx prisma/seed-condition-demo.ts`). **Rewritten mid-session** from "3 shipments/month/category on random days" (81 total, sparse — left most daily buckets at 0 once the chart went to daily granularity) to **1 shipment per day x 3 categories x every day from Jan 1 to today** (777 shipments this run, re-seeded Sep 16), each with 2-6 `PlantCheckLku` rows at a ~20% defect rate. Script now self-cleans (`deleteMany` on id prefix `#MPL-DEMO-` before inserting) so re-running after tweaking constants is safe. Verified: Month view has a nonzero bucket for every day that's actually occurred (16/16 through today, days 17-30 correctly 0 as future dates); YTD shows ~250-380 units/month with a consistent ~20% defect ratio. To remove later: `DELETE FROM shipments WHERE id LIKE '#MPL-DEMO-%'` (cascades). Inserted directly via Prisma (bypasses the normal create-assign-plant-check-handover flow) so these records won't behave like real shipments if opened in Pengiriman - fine for chart viewing only.
- **Verified:** `npx prisma migrate dev` applied cleanly; `vite build` clean. Manually walked the full pipeline via curl (admin-created shipment → `AT_PLANT` → `/plant-check` → `DITERIMA` → `DITURUNKAN` → `/handover` with `lkuUpdates`) and confirmed `/condition-analytics` returned the correct perfect/defective split; confirmed the new status guard 403s a non-override admin handing over a `PENDING` shipment, and the ownership check 400s a foreign/invalid `lkuUpdates` id. Test shipments cleaned up after. Extended `apps/api/test/smoke.mjs` with the same pipeline walk + guard/ownership cases, but **could not run it end-to-end this session** (see gotcha below) — verified only via `node --check` (syntax) and the manual curl walk above.
- **⚠️ Gotcha found (pre-existing, unrelated to this session's change):** `apps/api/prisma/seed.ts` (currently uncommitted/modified) no longer seeds a `client@mpl.com` client account, so `smoke.mjs`'s client-login step fails fast (`FATAL: could not obtain tokens`) on this dev DB. Also `ops@mpl.com` from context.md doesn't exist — the actual seeded OPERATIONS account is `admin2@mpl.com`/`admin1234` (used instead for the new status-guard smoke case). **Next session:** either restore client seeding in `seed.ts` or update `smoke.mjs`'s assumed credentials — until then `npm run smoke` cannot complete.
- **Not done / follow-up:** Surat Jalan / AT_PLANT keep-or-drop decision untouched (pre-existing deferred item). Client-facing side not touched (out of scope) — note for later: the client dashboard doesn't yet surface arrival-condition data, no action needed unless requested.
- **Server/branch state left:** all changes above are uncommitted on `tier1-infra` (not committed/pushed this session, per user not having asked for a commit).

### 2026-08-07 (cont.) — Client onboarding: functional magic link + client-mgmt RBAC + verification flow
- **Synced:** `tier1-infra`, on top of the tsc-fix + Claude-tooling commits earlier today.
- **Resync:** 2 new migrations applied (`magiclink_email`, `magiclink_account_type`); DB reseeded once (added an OPERATIONS admin); the smoke test now self-cleans, so it no longer pollutes the DB (removed the old `SmokeCo` residue).
- **Built (client onboarding, full-stack):**
  - **Magic link now works end-to-end.** Fixed the dead URL (`/register/magic?token=` → `/auth/register/:token`). Register creates a **PENDING** client bound to the link's company and **inherits the company profile** (phone/city/address/npwp) instead of leaving it blank. Links carry an `accountType` tag (`client` now; `operations`/`support` reserved for a future admin page). Email is entered by the client at registration.
  - **+Daftar Perusahaan** no longer auto-generates a link; links are issued from **Tambah PIC** (company selector = the verification binder). Manual PIC = **VERIFIED/active** immediately with shareable creds.
  - **Client-management RBAC:** create-client + magic-link generation restricted to **SUPERADMIN + OPERATIONS** (`clientManagerOnly` middleware); pipeline roles blocked at the API and hidden from the Klien nav. Seeded `admin2@mpl.com` (OPERATIONS).
  - **Klien page:** approval button (Tidak Aktif → Aktif via `/verify`), **cumulative-per-company** Total Pengiriman (+ live panel sync), unique-company dropdown (was duplicating per PIC).
  - **Client side:** **sessionless** verification page polls `POST /api/auth/registration-status` and routes to login once approved (pending accounts get no token, by design — admins confirm to clients out-of-band).
- **Verified:** API typecheck **0**; `vite build` clean; **smoke 33/33** — now covers the whole onboarding lifecycle (generate → validate → register → PENDING → verify → login) + the RBAC guard, and deletes its own test records.
- **New env vars:** none. **New migrations:** `magiclink_email`, `magiclink_account_type`.
- **Client-side follow-ups:** verification → login is one extra sign-in (sessionless design, intentional).
- **Security:** wrote **[SECURITY-MAGICLINK.md](SECURITY-MAGICLINK.md)** — pre-launch hardening plan for the now-public registration/auth surface (rate limits, enumeration, open-signup decision, token-in-URL, CAPTCHA). **Not yet implemented** — do before public launch. Ties into DEPLOYMENT.md §3/§5.
- **Server/branch state left:** committed on `tier1-infra`, **not pushed**. `.claude/skills/task-observer/` left untracked.

### 2026-08-07 — Claude Code tooling (hooks + deploy-preflight) + cleared the long-standing tsc baseline to 0
- **Synced:** `tier1-infra`, already even with `origin/tier1-infra` (0/0), no pull needed; at `01c7e6f`. `main` unchanged (tier1-infra = main + 13 commits, main fully contained).
- **Resync:** npm install n/a (no dep change); **prisma generate ✓** (ran to test a stale-client theory — did **not** clear the `.driver` errors, confirming they were a type cascade, not a stale client); migrate/seed not run.
- **Found:** 🟡 API `tsc --noEmit` had **38 errors** (the long-standing "≈37 baseline" + 1). Root cause: **Express 5 / `@types/express-serve-static-core` 5.1.1** now types `req.params.*` & `req.query.*` as `string | string[]`; passing one into a Prisma `where` both errors **and** collapses the inferred payload type — that produced the 11 phantom "Property 'driver' does not exist" cascade errors far from the real cause. See memory `express5-req-params-typing`.
- **Fixed:** coerced with `as string` at ~20 call sites across `shipments.ts`, `users.ts`, `tracking.ts`, `notifications.ts`, `adminNotifications.ts` (matches the existing `fleet.ts`/`auditLogs.ts` convention) + `seed.ts` `status as ShipmentStatus` (new `import type { ShipmentStatus }`). **tsc now 0 errors**; **smoke 22/22**; diff is type-only (no runtime behaviour change). Also added `.claude/settings.json` + hooks (`guard.mjs` = block `.env` edits & force-push `main`; `typecheck-api.mjs` = PostToolUse `tsc` on `apps/api/**/*.ts` edits) and a `deploy-preflight` skill (GO/NO-GO gate from DEPLOYMENT.md §3/§5). **Deferred:** none.
- **New env vars:** none. **New migrations:** none.
- **Client-side follow-ups:** none (admin/backend + tooling only).
- **Server/branch state left:** no servers started. Committed on `tier1-infra`, **not pushed**: `fix(api)` + `chore(claude)` + this log. `.claude/skills/task-observer/` left **untracked** (pre-existing, not created this session).

### 2026-07-18 (cont. 2) — Link refinements, liveish seed, admin roster + activity-feed wiring, KPI routing (all pushed)
- **Branch/push:** `tier1-infra` **pushed to origin** — now at `e83ee4e` (was `f97bf0c`). `main` untouched at `f97bf0c` (clean fast-forward available; left alone — shared with friend's agent). New commits this stretch: `4ffaf4c`, `015bacb`, `6b62233`, `e83ee4e` (on top of the 5 from the (cont.) entry). 9 commits total this session, all on `origin/tier1-infra`.
- **Hubungkan picker refined** (`4ffaf4c`): link targets are **STANDBY-only** (driver+armada reserved/idle; not AVAILABLE=free, not ON_DUTY=dispatched) — enforced in the picker filter *and* the backend create-linked guard. Picker **deduped per driver+vehicle pairing** (was per-shipment) so a pairing on several shipments — or an existing link group — shows once. Verified N-member groups work (4-member smoke 4/4: any member resolves to the same group).
- **Liveish seed** (`015bacb`): replaced the 5-driver/3-vehicle/50-shipment mock with **12 drivers / 9 armada / 16 shipments, fleet statuses SYNCED** to the shipment (old seed left them unsynced). 12 drivers = 2 Standby + 4 On Duty + 3 available-paired + 3 substitute-unpaired; 9 vehicles = 2 Standby + 4 In Use + 3 Available; near-expiry flags: driver-7 SIM ~20d, vehicle-7 STNK ~15d, vehicle-8 KIR ~25d. Shipments = 6 ongoing (today/future dates) + 10 Selesai/DELIVERED (past dates).
- **"Standby shipment in Selesai filter" bug:** the field-layout **Selesai tab is a past-pickup-date view** (`pickupDate < today`), NOT a DELIVERED-status filter — so ongoing rows dated in the past leaked into Selesai. Fixed the seed to date ongoing rows today/future. ⚠️ Latent mismatch remains: Selesai keys off pickup date, not status (shared/client logic — left alone).
- **Admin roster + activity feed** (`6b62233` + `e83ee4e`): seed drops the generic **OPERATIONS** admin — roster is now SUPERADMIN + Kepala Armada + all PIC (pabrik/gudang + 3 plant-bound). `auditLogs.ts` **`NORMAL_ROLES`** now includes the pipeline roles (was OPERATIONS/SUPPORT only) so the superadmin's Beranda "normal" feed surfaces their actions (already logged with the actor id); Beranda panel got readable role labels + subtitle. Verified: a KEPALA_ARMADA action appeared under `scope=normal`.
- **KPI routing** (`e83ee4e`): Beranda **"Pengiriman Aktif"** card now navigates to the Pengiriman page (was Pelacakan/tracking); "Total Pengiriman" already did.
- **Verified:** API typecheck 37 (no new) throughout; `vite build` clean; linked-pair + multilink smokes pass. **DB reset+reseeded twice** this stretch (liveish set, then again for the admin-roster change) → **re-login needed** in the browser (stale JWT after reset).
- **Open / deferred:** (a) new linked-shipment case the user flagged — **TODO placeholder in DEV-PLAN**, user to specify the exact scenario next; (b) Selesai-tab pickup-date-vs-status semantics; (c) Ganti-Driver radio-card picker vs the current `<select>`.
- **Server state left:** API `:3001` + web `:5173` **left running** (background) at session end.

### 2026-07-18 (cont.) — Pipeline hardening (#1/#2) + Link shipments "Hubungkan Pengiriman" (#3a/b/c) full-stack
- **Branch:** `tier1-infra`; 6 new commits, **not pushed** (push question still open with the user). Commits: `8ed685f` (#1), `a4a6ad7` (#2), `73f1d1b` (docs/context refresh), `85d6d32` (#3a schema), `a67bef6` (#3b backend), `3259f6c` (#3c frontend).
- **#1 — AT_PLANT gate + drop auto-WA:** `/status` rejects `AT_PLANT` unless caller is PIC_PABRIK (or SUPERADMIN override); from-DITUGASKAN already enforced by the forward map. Removed the auto-WhatsApp block on `/assign` (manual `/notify-driver` stays).
- **#2 — shared guard/mirror helper:** extracted `lib/shipmentStatus.ts` (`findTransitConflict`, `mirrorFleetStatus`, `releaseFleetIfUnused`); `/status`, `/plant-check`, `/handover` route through it. `/plant-check` now enforces the departure guard + engages the TRANSIT mirror (previously did neither). **Release is group-aware** (frees driver/vehicle only when no other OCCUPYING shipment uses them) — fixes premature free *and* is the link prerequisite.
- **#3 — Link shipments ("Hubungkan Pengiriman"), full-stack:**
  - Schema `Shipment.linkGroupId String?` + `@@index` (migration `add_shipment_link_group`). **Regenerating the Prisma client is required after this** — `migrate dev` did NOT regenerate; typecheck showed 62 phantom "linkGroupId does not exist" errors until `npx prisma generate`.
  - Backend: `POST /shipments` accepts `linkToShipmentId` → new shipment joins that trip's group (copies driver+vehicle, mints group id from target if none); `/assign` mirrors driver+vehicle to siblings; `/status` STANDBY→DITUGASKAN cascades to siblings; departure guard exempts same `linkGroupId`; `DELETE ?scope=group|single` (single unlinks a lone remaining sibling).
  - Frontend (`ShipmentsSection.jsx` + `api.js`): "Hubungkan Pengiriman" button reuses the create modal in *link mode* (driver field → trip `<select>`); "Tertaut" badge + clickable sibling ids in the detail panel; two-button delete; `remove(id, scope)` + `mapShipment` carries `linkGroupId`.
  - **Spec divergences (small):** trip picker is a `<select>`, not Ganti-Driver radio cards; bindable trips include STANDBY **and** DITUGASKAN.
- **Verified:** API typecheck **37 (baseline, no new)**; **linked-pair backend smoke 6/6** (create-linked, assign-mirror, cascade, co-transit guard exemption, single-unlink, group-delete); web `vite build` clean. **Not yet clicked through in a live browser** (Hubungkan modal / badge / two-button delete render).
- **New env vars:** none. **New migration:** `add_shipment_link_group` (run `prisma migrate deploy` elsewhere; then `prisma generate`).
- **Client-side follow-ups:** 🔵 none new — `linkGroupId` is admin-created only and nullable; client `mapShipment`/detail ignore it harmlessly. Prior notes stand (TrackingSection ETA on hold).
- **DB state:** dev DB was `migrate reset --force` + reseeded this session, then **polluted by the smoke** (a few `#MPL-000xx` linked test rows walked to TRANSIT). Reseed before manual testing if a clean set is wanted.
- **Server/branch state left:** API server **stopped** (was restarted for the smoke, then killed). 6 commits unpushed on `tier1-infra`. **Open question:** push these to `origin/tier1-infra` (and/or `main`)? Awaiting user OK.

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

