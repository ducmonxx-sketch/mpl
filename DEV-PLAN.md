# DEV-PLAN — resume point

> **Resuming?** Read this first, then [RUNBOOK.md](RUNBOOK.md) (sync + audit) and [CLAUDE.md](CLAUDE.md) (scope).
> Last updated: 2026-07-01. **Latest accurate state is the RUNBOOK Session Log (2026-06-30 + 2026-07-01)** (the "Where we are" section below predates recent work).

## ✅ DONE (2026-06-30) — Shipment status-change UX rework
**Implemented** (original frontend roadmap item #8 "Apply-status button + confirm box on shipment status"). Decisions used: **SUPERADMIN = all-except-current**; **selectable option buttons**. See RUNBOOK Session Log `2026-06-30 (cont.)`. Spec below kept as a record.

**Scope:** `apps/web/src/pages/AdminComponents/ShipmentsSection.jsx` — **frontend only**. Backend `lib/statusFlow.ts` already enforces transitions (403) → **no backend change**. Admin-dashboard scope; friend's frontend is frozen until ~next week (ownership clear).

**Goal:** Replace the inline status `<select>` in the shipment **detail panel** with a **"Ubah Status" button → confirmation modal**, and make the offered options **dynamic per role + current state** (only show *valid* targets — not the current disabled-greyed approach from today).

**Target options (dynamic):**
- Regular admin (OPERATIONS/SUPPORT) — forward-only, by current state:
  - `PENDING` → **Dalam Perjalanan** (TRANSIT), **Dibatalkan** (CANCELLED)
  - `TRANSIT` → **Terkirim** (DELIVERED), **Gagal** (FAILED)
  - `DELIVERED` / `FAILED` / `CANCELLED` (terminal) → no options → hide/disable the button ("Status final")
- **SUPERADMIN** → all statuses except the current one (can reverse/override).

**Implementation sketch:**
1. Reuse `FORWARD_STATUS` + `canSelectStatus` (added 2026-06-30). Add `availableStatusOptions(role, currentRawStatus)` → returns the `{value,label}` list to offer (SUPERADMIN: all except current; else `FORWARD_STATUS[current]`).
2. Remove the inline `<select>` (detail panel header) **and** today's `disabled`-options approach — superseded (dynamic list only renders valid options). Keep the `FORWARD_STATUS`/`canSelectStatus` helpers; repurpose for the modal.
3. Add a **"Ubah Status"** button in the detail header. New state: `showStatusModal`, `pendingStatus`.
4. Confirmation modal (reuse existing `AdminModal`): show current-status badge + available targets as a choice (radio list or buttons) + **"Konfirmasi Ubah Status"**. Confirm → existing `handleStatusUpdate(pendingStatus)` (toast + refetch + badge animation) → close. Disable confirm until a target is picked.
5. Edge case: empty option list (terminal + regular admin) → hide/disable button with a hint; SUPERADMIN is never empty.

**Confirm tomorrow before building:** (a) SUPERADMIN = all-statuses-except-current (plan's assumption) vs literally all 5? (b) modal choice as radio list vs buttons (cosmetic).

## 🛠️ Planned — Driver↔Vehicle pairing (provisional) + substitute-driver swap + On-Duty + "Ditugaskan" status
**Source:** end-user flowchart (2026-07-01) + design Q&A (signed off). **No code yet.** Build admin-side now; client-dashboard display of the new statuses is deferred to the user's later client-side pass.

> ⚠️ **The driver↔vehicle pairing model is PROVISIONAL** — the user's current thinking, explicitly subject to change. Don't treat cardinality/derivation as locked; re-confirm before building phase ①.

### Model
- **Driver ↔ Vehicle = 1:1** (provisional): each vehicle has one **primary driver** (the "Assign Driver ke Armada" step). e.g. `Vehicle.primaryDriverId String? @unique` (+ relation), nullable.
- **Shipment ↔ Vehicle = 1:1**: one vehicle per shipment, it **stays** for the shipment's life; assigning a vehicle brings its primary driver by default.
- **Substitute driver:** if the primary is unavailable, an admin assigns a substitute *for that shipment only* — the vehicle's pairing is untouched. "Substitute" is **derived** (shipment.driverId ≠ the vehicle's primary driver) and shown as a **"Pengganti" badge**; no stored flag.

### Driver status (enum change) — add **On Duty**
`DriverStatus`: **ACTIVE** (free, green) · **ON_DUTY** (driving an in-transit shipment, blue) · **UNAVAILABLE** (sick/leave, red/gray).
- **ON_DUTY is auto-managed by the shipment lifecycle:** ACTIVE → ON_DUTY when the driver's shipment goes **Dalam Perjalanan**; ON_DUTY → ACTIVE when it **completes** (Terkirim/Gagal).
- **UNAVAILABLE ↔ ACTIVE is manual** (admin, via driver form). On a successful shipment the vehicle's rightful primary driver is the default again automatically (pairing was never changed); the primary is **not** auto-reactivated (sick ≠ recovered).

### Shipment status (enum change) — add **Ditugaskan**
Flow: **Menunggu → Ditugaskan → Dalam Perjalanan → Terkirim/Gagal**.
- Assigning a driver/vehicle sets status → **Ditugaskan** (today it auto-jumps to TRANSIT — remove that).
- **Ditugaskan → Dalam Perjalanan is a manual admin action** (the status modal's forward move).
- Client-visible → coordinate when the client dashboard is built (deferred).
- *(Open: exact Menunggu→Ditugaskan mechanic — manual "finalize" vs auto-on-assign — settle at build.)*

### Ganti Driver (the swap)
- **Button on the shipment detail panel**, available for shipments in **Menunggu** status (driver changeable while waiting; locks once it moves on).
- Opens a **confirmation modal** with a **radio list of selectable drivers** — **excludes ON_DUTY + UNAVAILABLE** (so a driver merely assigned to other *waiting* shipments stays ACTIVE and selectable — matches "set as substitute but not yet Dalam Perjalanan = still available") — plus a checkbox **"Tandai driver lama tidak tersedia"** (default checked).
- Confirm → shipment.driverId = substitute (**vehicle unchanged**); if checked, old driver → UNAVAILABLE. A mis-click is fixed by re-editing.

### Departure guard
A driver can be pre-assigned to **several waiting** shipments, but only **one** may be in transit. At the **Dalam Perjalanan** transition, block if that driver is already ON_DUTY elsewhere; the other waiting shipments holding them must swap drivers before they can depart. Surface this in the UI.

### Phasing (smallest → biggest blast radius)
1. **Driver↔Vehicle pairing** (provisional — re-confirm first): schema + fleet pair/unpair endpoint + Armada/Drivers UI.
2. **Substitute swap + On-Duty + badge:** Ganti-Driver confirmation modal (radio list + checkbox) on the detail panel; auto-UNAVAILABLE on swap-out; ON_DUTY auto-lifecycle; "Pengganti" badge.
3. **"Ditugaskan" status** (last; client-coordination deferred): enum + migration, `statusFlow.ts`, assign route (stop auto-TRANSIT), status modal/badges/filters/`mapStatus`. **Supersedes parts of the 2026-06-30 status work** (assign → Ditugaskan instead of TRANSIT; modal gains the new status).

### Blast radius / shared-contract notes
Schema (`Vehicle`/`Driver` + `DriverStatus` & `ShipmentStatus` enums — shared contract), `fleet.ts` (+pairing route), shipment `assign` + `status` routes, `ShipmentsSection` (assign + new Ganti-Driver modal + "Pengganti" badge), Armada/Drivers sections, and the **seed** (driver+vehicle combos become consistent pairings; statuses gain Ditugaskan; driver statuses gain On Duty). Both new enum values are **client-visible** → coordinate during the client-dashboard pass. All build is admin-scope.

## Where we are right now (2026-07-01)
> Authoritative session history = RUNBOOK Session Log. This is the quick snapshot.
- **Branch:** `tier1-infra`, **ahead of `origin/tier1-infra` by 4 commits, NOT pushed** (per lock). `main` has nothing new (friend's frontend frozen ~until next week → we have ownership of `apps/web`).
- **⚠️ Big UNCOMMITTED batch on disk — 9 modified files + 1 new migration** (not yet committed):
  - **Backend:** `prisma/schema.prisma` (vehicle `serviceDate`/`chassisNumber`/`engineNumber`), `prisma/seed.ts` (full reseed dataset), new migration `20260629175841_add_vehicle_service_chassis_engine`, `src/routes/fleet.ts` (persist new vehicle fields + service expiry flag), `src/routes/shipments.ts` (WA driver msg: cargo line + real origin/destination), `src/index.ts` (rate limit 300→1500).
  - **Frontend:** `apps/web/src/pages/AdminComponents/ShipmentsSection.jsx` — status-change "Ubah Status" modal (RBAC dynamic options), WA-notify button freeze, assign-button gated (normal admins: Menunggu only; super: anytime).
  - **Docs:** `DEV-PLAN.md`, `RUNBOOK.md`, `DEPLOYMENT.md`.
- **DB:** dev DB **freshly reseeded** — 2 admins (`admin@mpl.com`/`admin1234` SUPER, `ops@mpl.com`/`ops1234` OPS), 10 clients, 8 drivers, 9 vehicles, 13 shipments. ⚠️ **After any reseed: re-login** (stale localStorage JWT stays "logged in" but writes 500 — FK to wiped admin id), and re-seed after any `npm run smoke` (it pollutes; `migrate reset` does NOT auto-seed → run `npx prisma db seed`).
- **Recently DONE:** quick wins (#9/#7) · file-upload primitive · profile-pics backend (#3) · **RBAC #10** · WA driver-notify (cargo + real addresses) · status-change UX (frontend #8) · assign-button RBAC gate.
- **Next:** either **commit this batch** to `tier1-infra`, or start **phase ① of the driver↔vehicle plan** (the 🛠️ Planned section above — pairing is *provisional*, re-confirm before building).
- Local reminder hook in `.claude/settings.local.json` (gitignored).

## Decisions locked (don't redo these)
- **typecheck + web lint are NON-BLOCKING in CI on purpose.** There are ~55 `tsc` + ~26 lint pre-existing issues — all **type-friction / dead-code, NOT runtime bugs** (verified: smoke is green). Details in RUNBOOK 2026-06-27.
- **Do NOT clean up the 81 yet.** It edits many shared backend files and would merge-conflict with the friend's in-flight work. Do it in a coordinated quiet window, then flip CI `continue-on-error: false`.
- **TypeScript pin left as-is** (`apps/api` → `~5.8.3`, tooling-only; runtime uses `tsx`). Don't revert unless asked.
- **Don't push `tier1-infra` / open a PR** until the user says so.
- **Two-agent repo:** the friend uses a Gemini-as-Opus agent on the same GitHub repo. **Always pull before working** (RUNBOOK §2) and **agree on file ownership** to avoid collisions. CI/smoke are the model-agnostic safety net.
- **Auth storage rehaul is DEFERRED to a dedicated, coordinated session** (pre-launch hardening) — do NOT do it piecemeal. Moving JWT from localStorage → httpOnly cookies + CSRF touches **shared client+admin contracts** (`api.js`, `AuthContext`, `middleware/auth.ts`, auth routes), and cookie config depends on final deploy domains. Full phased plan + rationale in **[DEPLOYMENT.md](DEPLOYMENT.md) §3**. Backend Phase 1 (cookie alongside body token + dual-read) is non-breaking and can go first; the frontend cutover needs friend coordination. Known gaps to close then: `api.js` missing `credentials:'include'`, and no admin `/me` endpoint.

## Next steps — backend roadmap (prioritized)
Build reusable primitives first; most items depend on the same few.

**1. Quick wins** — ✅ DONE
- [x] **#9** Failed shipments excluded from faktur (invoices.ts POST guard).
- [x] **#7 (partial)** Security basics: `helmet` + `express-rate-limit`.

**2. Reusable primitives (build once → unlocks many)**
- [x] **File upload helper** ✅ — StorageAdapter + LocalAdapter + multer + `saveUpload` (pluggable to cloud later).
- [ ] **PDF generator** → ⏸ **PARKED — needs design first** (see Parked / handoffs below).
- [x] **RBAC / roles helper** ✅ → super-admin vs admin (#10) — pieces 1–3 done (status state machine + audit, expiry allow-late/log-missed, admin management). Design + frontend handoffs in [RBAC-PLAN.md](RBAC-PLAN.md).

**3. Features built on the primitives**
- [~] **#3 profile picture** — backend ✅ (admin + client); **FRONTEND PENDING** (see Parked / handoffs).
- [ ] **#2** Reset password in profile · **#1** cleaner notification integration · **#4** one-time-use WhatsApp driver notify · **#6** integrate client side to backend.

**Recommended very-next action:** RBAC helper (#10), then features #2/#1/#4.

## Parked / handoffs
- **#3 profile picture — FRONTEND PENDING (waiting on friend's UI).** Backend done & verified; wire when UI lands:
  - Client: `POST /api/users/me/avatar` (multipart, field `file`) → `{ avatarUrl }`; `GET /api/users/me` now returns `user.avatarUrl`.
  - Admin: `POST /api/auth/admin/me/avatar` (multipart, field `file`) → `{ avatarUrl }`; new `GET /api/auth/admin/me` → `admin.avatarUrl`.
  - Display: `<img src={API_BASE + avatarUrl}>` (public `/api/files/...`). Upload via **FormData**, do NOT set `Content-Type` (the JSON `api.post` wrapper won't work — needs a small FormData helper in `api.js`). Limits: JPG/PNG/WEBP ≤5 MB.
- **PDF generator — PARKED, needs design first.** Don't build until the invoice/PDF layout is decided (ties to frontend faktur item #6: "view details = total + notes only, no tax"). Then pdfkit/pdf-lib → invoice PDF + send-to-WhatsApp (#5).

## Dev-infrastructure tiers (accelerators — how we go faster)
Velocity/safety investments, separate from feature work. Tier-2 primitives overlap with the backend roadmap above — build the primitive once and many features speed up.

**Tier 1 — Safety nets — ✅ DONE (this branch)**
- ✅ `apps/api/tsconfig.json` + `npm run typecheck`
- ✅ GitHub Actions CI (Postgres → prisma generate/migrate/seed → typecheck → web build → web lint → smoke)
- ✅ Committed smoke test (`apps/api/test/smoke.mjs`, `npm run smoke`, 26/26)
- ⏳ Follow-up: burn down the ~81 type/lint issues, then flip CI typecheck + lint to **blocking**.

**Tier 2 — Reusable primitives (build once, reused everywhere)**
- [x] **File upload + storage helper** ✅ (multer→local; pluggable to Supabase/S3) → profile pic (#3 ✅ backend), payment proof, tracking images, proof-of-delivery
- [ ] **PDF generator** (pdfkit / pdf-lib) → invoice PDF + send-to-WhatsApp (#5) — ⏸ parked, needs design
- [ ] **Zod validation layer** (one schema per route) → every endpoint: input validation + inferred types + consistent 400s
- [ ] **`asyncHandler` wrapper + central error middleware** → removes ~49 repetitive try/catch blocks; uniform errors
- [x] **RBAC / permission helper** ✅ (matrix over `requireRole`) → super-admin vs admin (#10) — pieces 1–3 done

**Tier 3 — Hardening & quality-of-life**
- [x] **helmet + express-rate-limit** ✅ → security basics (#7), shipped with the quick wins
- [ ] **Structured logger (pino)** → faster debugging; replaces `console.error` (also fixes the buffered background-log pain)
- [ ] **`predev` script** that frees :3001 / kills orphaned node before start (we hit orphan-process traps repeatedly)
- [ ] **Shared types between `apps/web` and `apps/api`** → permanently kills frontend/backend drift (strategic fix)

**Further (once the basics are in)**
- [ ] Flip CI typecheck + web lint to **blocking** (after the ~81 cleanup).
- [ ] **Pagination** on list endpoints (`/users`, `/shipments`, `/fleet/*`, `/invoices`) — currently unbounded.
- [ ] Tests beyond smoke: unit/integration for business logic (points/totals, status transitions, auth).
- [ ] `npm audit` in CI + a pre-commit hook running typecheck/lint locally.
- [ ] Optional: error tracking (Sentry) + basic request logging/metrics.

## Full roadmap (the friend + user's original list — reference)
**Backend (focus):**
1. Cleaner notification integration · 2. Reset password in profile · 3. Profile picture change · 4. Notify driver via WhatsApp, one-time-use · 5. Send PDF invoice to WhatsApp · 6. Integrate client side to backend · 7. Security, rate limiter, etc. · 8. Bug: pengiriman section opens shipment detail without clicking (mostly frontend) · 9. Failed shipments excluded from faktur · 10. Super-admin vs admin roles.

**Frontend (handled later / by friend):**
1. Faktur: payment-term dropdown, dynamic payment rows (nominal + proof image, auto cross-check vs total, auto-complete when fully paid, "sisa pembayaran" display) · 2. Sync icons on Pengguna page · 3. Lock canvas · 4. Wrong creds stay on admin login page · 5. Mandatory image input on Pelacakan · 6. Invoice edit form + PDF gen; view-details payment = total + notes only, no tax · 7. Progress image preview on Pelacakan · 8. Apply-status button + confirm box on shipment status · 9. Redesign 404 page · 10. Client dashboard rehaul · 11. Rework shipment form (origin/destination address + Gmaps links; drop ETA) · 12. Client password reset (via magic link, admin dashboard) · 13. Unify "view details" design across driver/client/faktur/pengguna · 14. Notification delete (x) button once read.

## How to resume (checklist)
1. Open a session in `g:\Programming\mpl` (CLAUDE.md auto-loads).
2. Confirm branch: `git branch --show-current` → expect `tier1-infra`.
3. Sync per RUNBOOK §2 (`git fetch`, check vs `origin/main`, pull/merge as needed). Re-run `npm install` + `npx prisma generate` if backend deps/schema changed.
4. Pick the next unchecked item above. Coordinate file ownership with the friend's agent.
5. Before finishing: append a RUNBOOK Session Log entry and tick items here.
