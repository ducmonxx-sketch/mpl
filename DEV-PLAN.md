# DEV-PLAN — resume point

> **Resuming?** Read this first, then [RUNBOOK.md](RUNBOOK.md) (sync + audit) and [CLAUDE.md](CLAUDE.md) (scope).
> Last updated: **2026-07-18**. Newest work at the top; RUNBOOK §6 has per-session detail.

## ✅ DONE (2026-07-18) — Pipeline hardening + Link shipments ("Hubungkan Pengiriman")
- **#1 DONE** (`8ed685f`): `AT_PLANT` gated to **PIC_PABRIK** (from DITUGASKAN; SUPERADMIN keeps override); **auto-WhatsApp-on-assign removed** (manual `/notify-driver` only).
- **#2 DONE** (`a4a6ad7`): extracted **`lib/shipmentStatus.ts`** — shared departure guard + fleet mirror; `/status`, `/plant-check`, `/handover` all route through it. `/plant-check` now enforces the guard + engages the mirror on TRANSIT (previously neither); **release is group-aware** (frees driver/vehicle only when no other active shipment uses them — fixes premature free + groundwork for links).

**#3 Link shipments — DONE** (3a `85d6d32` · 3b `a67bef6` · 3c `3259f6c`): one driver+vehicle (one physical trip) carries multiple **independent** shipments. Schema: `Shipment.linkGroupId String?` + index (migration `add_shipment_link_group`).
- **Create-linked** via the **"Hubungkan Pengiriman"** button → reuses the create-form modal in *link mode*: the driver field becomes a picker of **Standby trips** (driver+armada reserved/idle in fleet status STANDBY — not yet dispatched, deduped **per driver+vehicle pairing**, one row per physical trip incl. an existing link group). Submit sends `linkToShipmentId`; backend copies that trip's driver+vehicle+`linkGroupId` (minting a group id from the target if none). The **new** linked shipment is created **Standby**. "Buat Pengiriman Baru" stays strict 1:1.
- **Pre-departure the group is synced:** (a) `/assign` on any member **mirrors driver+vehicle to ALL siblings**; (b) STANDBY→Ditugaskan on any member **cascades all members** to Ditugaskan.
- **After Ditugaskan: fully independent** — each shipment gets its own plant-check (PIC Pabrik) + handover (PIC Gudang); no status cascade.
- **Guard/release** (`lib/shipmentStatus.ts`): departure guard **exempts same-`linkGroupId`** (siblings co-transit); release group-aware.
- **Delete:** a linked shipment shows **"Hapus Pengiriman Ini"** (`scope=single`; unlinks a lone remaining sibling) + **"Hapus Semua Terhubung"** (`scope=group`). Standalone keeps single "Hapus".
- **UI:** "Tertaut" badge + clickable sibling ids in the detail panel.
- **Divergence from the locked spec (small, flag if unwanted):** the link target is a **`<select>` of trips**, not Ganti-Driver-style radio cards — reuses the create-form idiom; each option is a trip labelled by driver+armada. (Link targets are **STANDBY-only** — driver+armada reserved/idle — both UI-filtered and backend-enforced.)
- **Verified:** typecheck 37 (no new); linked-pair backend smoke **6/6** (create-linked, assign-mirror, cascade, co-transit, two-mode delete); `vite build` clean.
- **Not yet exercised in the live UI** (backend + build proven, browser click-through pending): the Hubungkan modal end-to-end, Tertaut badge/siblings render, two-button delete from the panel.

> 🔜 **REVISIT next — new linked-shipment case (flagged 2026-07-18, user):** there's an additional scenario for the Hubungkan feature to handle; keeping the current Standby-only behaviour for now. **TODO: capture the exact case here** (user to specify) before the next pass. Also open for that pass: (a) reconsider the fleet-status semantics — a linkable pairing sits in **STANDBY = idle/reserved** (not AVAILABLE=free, not ON_DUTY=dispatched); confirm STANDBY is the intended "idle" state or whether a distinct idle status is wanted; (b) Ganti-Driver-style radio-card picker vs the current `<select>`.

## ✅ DONE (2026-07-15) — Pipeline roles migration + plant-check/handover bug fixes
Pulled `main` (friend's agent had added the 3 pipeline roles + AT_PLANT status in `schema.prisma` with **no migration**). Reconciled DB to schema and fixed two bugs in the friend's pipeline routes.

**Migration** — `20260715040528_add_pipeline_roles_plant_fields` (created + applied): `Manufacturer` enum, 3 new `AdminRole` values (`KEPALA_ARMADA`/`PIC_PABRIK`/`PIC_GUDANG`), `AT_PLANT` shipment status, `pickup_plants` table + FK, and 9 new `Shipment` pipeline columns (`shippingCategory`/`dimensions`/`containerType`/`pickupPlantId`/`vehicleCondition`/`lkuNumber`/`pabrikNotes`/`serahTerimaUrl`/`handoverNotes`). Client regenerated, seed re-run (adds 3 role accounts + 7 pickup plants), migrate status clean (13/13).

**`lib/rbac.ts`** — added the 3 new roles to `ROLE_PERMISSIONS` with `[]` (no elevated perms; pipeline roles are gated per-status in the UI, not via this matrix). They were already safe via fall-through; now explicit.

**`routes/shipments.ts` bug fixes:**
- **Duplicate routes deleted** — `/:id/plant-check` and `/:id/handover` were each defined twice, the second pair *after* `export default router` (dead code; Express used the first registration).
- **Invalid audit enum → 500** — the live routes wrote `actionType: "UPDATE_SHIPMENT_STATUS" as any`, which isn't in `AuditActionType`. The shipment update committed, then the audit insert threw → client saw a 500 on a change that had actually succeeded. Fixed to `"UPDATE_STATUS"`.
- **Preserved driver-reset in handover** — on `DELIVERED`, the assigned driver now goes `ON_DUTY → ACTIVE` (locked ON_DUTY spec, context.md §6). This logic only lived in the dead duplicate that was removed; without carrying it over, drivers would stay `ON_DUTY` and trip the departure guard on their next shipment.
- **Verified live:** plant-check 200, handover 200 + driver freed to ACTIVE; smoke 26/26; typecheck clean (pre-existing friction only).

### ✅ RESOLVED (2026-07-18, #2 `a4a6ad7`) — plant-check now routes through the shared guard+mirror
_Fixed: `/plant-check` + `/handover` now call `lib/shipmentStatus.ts`, so the departure guard + fleet mirror run on the plant-check TRANSIT. Original problem kept below as the record._

The live `plant-check` route promoted a shipment straight to `TRANSIT` but **bypassed** the two safeguards the main `/status` route enforces on the same transition:
1. **Departure guard** — no check that the assigned driver is already `ON_DUTY` on another in-transit shipment (should 409 if so).
2. **ON_DUTY promotion** — does not flip the driver `ACTIVE → ON_DUTY` on departure, so the driver looks free while actually driving.
Result: a shipment departing via the PIC_PABRIK plant-check flow leaves the driver's status inconsistent and unguarded. Fixing it means routing plant-check's TRANSIT promotion through the same guard+lifecycle as `/status` (or extracting that logic into a shared helper both call) — a design decision on the friend's pipeline feature, so left for the coordination chat. Same class of concern applies to any other route that sets `TRANSIT`/`DELIVERED`/`CANCELLED` directly.

## ✅ DONE (2026-07-16) — Merge friend's parallel armada work + diterima/diturunkan vocab + remove invoices
Two-agent collision: the friend pushed **"Refine Kepala_Armada role"** + landing refresh to `origin/main` (`9f38e98`), overlapping our overhaul. Merged into `tier1-infra` (`141a132`) keeping ours as base, then removed invoices (`e6b43df`). Not pushed. Full detail in RUNBOOK Session Log `2026-07-16`.

**Merge reconciliation:** `AdminModal` (both portaled — kept ours + their SSR guard); `ShipmentsSection` (kept ours + adopted their armada UX: Dalam Proses/Selesai views, date sort, centered detail modal, status-filter dropdown); `shipments.ts` (kept both — our routes + their WhatsApp-on-assign); **dropped the friend's duplicate role migration** (`…090316`, byte-identical to our `…040528`).

**Decisions:** armada visibility → **friend's model** (sees full lifecycle, removed our Menunggu+Standby-only rule); adopted **`diterima`/`diturunkan`** status vocab. New enum values + `migration add_diterima_diturunkan_status`; `statusFlow` `Transit → Diterima → Diturunkan → Delivered`; frontend badges/labels/filters; `DELIVERED` label → "Selesai". **Triggers deferred** to the Pabrik/Gudang flow.

**Invoices removed entirely** (`e6b43df`, −1523): model + `InvoiceStatus` enum + relations, `routes/invoices.ts`, `migration remove_invoices` (DROP TABLE + TYPE), backend refs (`shipments.ts`/`users.ts`/`statusFlow.ts`/smoke), and frontend (`invoicesAPI`, admin+client `InvoicesSection` + `InvoiceTable`, dashboards, both sidebars). Left harmless display mappings + `*_INVOICE` audit enum values.

**Verified:** web build ✓, API typecheck 43 (no new), smoke 22/22, status chain walk, `/api/invoices` → 404.

## ✅ DONE (2026-07-15) — Kepala Armada flow overhaul (STANDBY, status mirror, Tipe Pengiriman, substitute, delete)
Built the KEPALA_ARMADA pipeline on top of the pulled roles. All admin-scope, uncommitted on `tier1-infra`. Full detail in RUNBOOK Session Log `2026-07-15`.

**New shipment status flow:** `Menunggu (PENDING) → Standby (STANDBY, new) → Ditugaskan → [AT_PLANT] → Dalam Perjalanan (TRANSIT) → Berhasil (DELIVERED) / Dibatalkan (CANCELLED)`.
- Armada **creates** a shipment (driver+vehicle from the paired dropdown) → starts at **STANDBY** (server-derived by role). Reconfirm (reuses the driver card + **Ganti Driver** checkbox + **Pengganti** badge; substitute swaps driver only, keeps vehicle, list = all ACTIVE drivers) advances **STANDBY → Ditugaskan**, which is where Pengurus Pabrik picks it up.
- `statusFlow.ts` + frontend `FORWARD_STATUS`/`RAW_STATUS_OPTIONS`/`mapStatus` + filter tabs updated. `rbac.ts` lists the 3 pipeline roles (`[]`).

**Status mirror (1:1 shipment → driver → armada):** Standby→driver+vehicle **STANDBY** (new enum values on both); Ditugaskan/Transit→**ON_DUTY / IN_USE (Digunakan)**; Delivered/Cancelled→**release (Tersedia)**. Centralized in `/status`; create route mirrors on STANDBY; `/handover` frees both. Departure guard rewritten to check for a *different* TRANSIT shipment (ON_DUTY now begins at Ditugaskan, so it no longer signals a conflict by itself).

**Tipe Pengiriman:** table column Layanan→**Tipe Pengiriman** (Unit/Cargo/Container). Per-type create persists all fields, `-` for non-applicable strings. **Unit** → Asal = selected plant label, Tujuan = **"Gudang MPL"**. Detail modal differentiates by type, dropped **Harga** + **Est. Tiba** (and the `price`/`estimatedArrival` DB columns), **Dibuat Oleh** = real creator's fullName. Kepala Armada list shows only PENDING+STANDBY; detail view uniform across all admin roles.

**Fleet/UI:** `AdminModal` portaled to `<body>` (top-layer + backdrop blur, fixes trapped z-index on create/status modals app-wide); create-form drivers = paired **and** armada Tersedia; pair modal excludes already-paired drivers; **substitute ("Pengganti")** shown in Armada "Driver Utama" column + Driver page (via active-shipment includes on `/fleet/vehicles` + `/fleet/drivers`); driver On-Duty badge removed on Armada; **Bertugas** badge → blue (Standby indigo); **delete shipment** (regular admins: STANDBY only; SUPERADMIN: any status — frees the pair, blocks if invoice exists); Edit button in the driver detail panel.

**Bug fixes (friend's pipeline routes):** removed duplicate `plant-check`/`handover` routes defined after `export default router`; fixed the live copies' invalid audit enum (`"UPDATE_SHIPMENT_STATUS" as any` → `"UPDATE_STATUS"`, was 500-ing) and preserved the driver-release the dead copy had.

**Migrations (4):** `add_pipeline_roles_plant_fields`, `add_standby_status`, `drop_shipment_price_eta`, `add_driver_vehicle_standby`. **Seed rewritten:** 5 drivers (3 paired 1:1 to 3 clean vehicles, 2 spare), no shipments. **Verified:** web build ✓, API typecheck no-new-errors, smoke 26/26, full lifecycle + substitute + delete exercised live.

### 🚧 Next (this arc) — not yet built
1. ✅ ~~Full invoice removal~~ — DONE 2026-07-16.
2. **Pengurus Pabrik / Kepala Gudang flow** — wire the *triggers* for the now-existing statuses: who sets `AT_PLANT`, `Diterima`, `Diturunkan` (→ `Delivered`). Open design questions: **keep or drop `AT_PLANT`** (defined + in statusFlow but no route sets it); pabrik/gudang **list visibility** (which statuses each sees); the **"vehicle data & accessories"** fields for the pabrik check.
3. **`context.md` refresh** — the one-time rewrite; do after the pabrik/gudang flow lands (it's materially stale: predates STANDBY, the status mirror, diterima/diturunkan, dropped price/eta, Tipe Pengiriman, invoice removal).
4. **Admin-created → Menunggu → armada pickup** path (future; for now only armada creates).
5. Leftover: old KEPALA_ARMADA PENDING assign-modal branch is dead for armada (OPERATIONS still uses it). Plant-check departure-guard/ON_DUTY gap (see ⚠️ Open above).

### 🔵 Client-side follow-ups (do NOT fix client here — note only)
- **Client Faktur pages removed** (invoice removal deleted the client dashboard InvoicesSection/InvoiceTable/route/sidebar) — friend's domain; flag so their agent doesn't re-add.
- Friend's **auto-WhatsApp-on-assign** (merged) now double-fires with our manual `/notify-driver` — a driver can get two messages.
- Dropping `estimatedArrival` blanks the ETA on the shared `TrackingSection` (client tracking); was already non-persisting. Did not modify TrackingSection.
- New STANDBY/DITUGASKAN/AT_PLANT/DITERIMA/DITURUNKAN statuses + pipeline roles are client-visible when the client dashboard pass happens.

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

## ✅ DONE (2026-07-01) — Phase ②③: ON_DUTY lifecycle + full status rework + ShipmentsSection redesign
**Implemented** phases ② and ③ of the driver-vehicle-shipment design (see locked spec below). All backend and frontend changes are uncommitted on `tier1-infra`.

**Backend changes:**
- `prisma/schema.prisma`: added `DITUGASKAN` to `ShipmentStatus` enum
- `prisma/migrations/20260701130000_add_ditugaskan_status/migration.sql`: ADD VALUE migration (non-transactional)
- `apps/api/src/lib/statusFlow.ts`: updated FORWARD map (PENDING→DITUGASKAN→TRANSIT→DELIVERED/CANCELLED; FAILED legacy/no-op)
- `apps/api/src/routes/shipments.ts`: (1) GET includes `vehicle.primaryDriverId` for Pengganti badge; (2) assign route sets DITUGASKAN only from PENDING (SUPERADMIN re-assign on TRANSIT keeps status); (3) high-workload check includes DITUGASKAN; (4) status route: departure guard (block TRANSIT if driver ON_DUTY elsewhere → 409), Phase ② ON_DUTY auto-lifecycle (ACTIVE→ON_DUTY on TRANSIT; ON_DUTY→ACTIVE on DELIVERED/CANCELLED; UNAVAILABLE not auto-reactivated), client notify on CANCELLED added

**Frontend changes:**
- `apps/web/src/pages/AdminComponents/components/AdminModal.jsx`: z-index `z-[100]` → `z-[200]` (above detail panel)
- `apps/web/src/pages/AdminComponents/components/AdminStatusBadge.jsx`: added `assigned` key (Ditugaskan, blue)
- `apps/web/src/pages/AdminComponents/ShipmentsSection.jsx`: **full rewrite** — new mapStatus/FORWARD_STATUS/RAW_STATUS_OPTIONS, DriverVehicleCard + ExpiryLabel helper components, per-role/per-status modal content (PENDING=assign UI with 2-col cards + Link Shipment checkbox; DITUGASKAN=reconfirm + Ganti Driver checkbox + Tandai Tidak Tersedia; TRANSIT=Terkirim/Dibatalkan buttons; SUPERADMIN=generic status picker), Pengganti badge, filter tabs updated (added Ditugaskan, renamed Gagal→Dibatalkan), SUPERADMIN row assign button kept, regular admin uses status modal for all transitions. Build: `vite build ✓`.

---

## 🛠️ Planned (LOCKED SPEC, now fully implemented) — Driver↔Vehicle pairing (provisional) + substitute-driver swap + On-Duty + "Ditugaskan" status
**Source:** end-user flowchart (2026-07-01) + design Q&A (signed off, updated 2026-07-01). **No code yet.** Build admin-side now; client-dashboard display of the new statuses is deferred to the user's later client-side pass.

> ⚠️ **The driver↔vehicle pairing model is PROVISIONAL** — the user's current thinking, explicitly subject to change. Don't treat cardinality/derivation as locked; re-confirm before building phase ①.

### Model
- **Driver ↔ Vehicle = 1:1** (provisional): each vehicle has one **primary driver** (the "Assign Driver ke Armada" step). e.g. `Vehicle.primaryDriverId String? @unique` (+ relation), nullable.
- **Shipment ↔ Vehicle = 1:1**: one vehicle per shipment, it **stays** for the shipment's life; assigning a vehicle (via the Update Status modal from Menunggu) brings its primary driver by default.
- **Substitute driver:** if the primary is unavailable, an admin swaps via Ganti Driver *for that shipment only* — the vehicle's pairing is untouched. "Substitute" is **derived** (shipment.driverId ≠ vehicle's primaryDriverId) and shown as a **"Pengganti" badge**; no stored flag.
- **Linked shipments (special case):** a single vehicle may carry **two shipments** (generating two separate invoices). When assigning from Menunggu, a **"Link Shipment" checkbox** appears; if checked, a radio list of other Menunggu shipments is shown — selecting one gives shipment B the same driver+vehicle as shipment A. No separate schema field; it's handled as two independent assign calls on confirm.

### Driver status (enum change) — add **On Duty**
`DriverStatus`: **ACTIVE** (free, green) · **ON_DUTY** (driving an in-transit shipment, blue) · **UNAVAILABLE** (sick/leave, red/gray).
- **ON_DUTY is auto-managed by the shipment lifecycle:** ACTIVE → ON_DUTY when the driver's shipment goes **Dalam Perjalanan**; ON_DUTY → ACTIVE when it **completes** (Terkirim or Dibatalkan).
- **UNAVAILABLE ↔ ACTIVE is manual** (admin, via driver form). The primary driver is not auto-reactivated on shipment completion (sick ≠ recovered).

### Shipment status (enum change) — add **Ditugaskan** / remove **Gagal**
Flow: **Menunggu → Ditugaskan → Dalam Perjalanan → Terkirim / Dibatalkan**.
- **Gagal is removed globally** (enum value deleted, migration needed). SUPERADMIN is not exempt.
- Assigning a driver from the Update Status modal (Menunggu) sets status → **Ditugaskan**.
- **Ditugaskan** is the staging/review step — admin reconfirms driver+vehicle and optionally swaps before departure.
- **Ditugaskan → Dalam Perjalanan** is confirmed from the Update Status modal (see below).
- **Dibatalkan only ever comes from Dalam Perjalanan** — delivery failed, vehicle returned with payload. No pre-departure cancellation.
- Client-visible → coordinate when the client dashboard is built (deferred).

### Update Status modal — per-role behaviour (replaces "Ubah Status")
Label is **"Update Status"** everywhere.

**Regular admin (OPERATIONS / SUPPORT):**
| Current status | Modal content |
|---|---|
| Menunggu | Driver assignment UI (see below) → confirm → Ditugaskan |
| Ditugaskan | Reconfirm UI (see below) → confirm → Dalam Perjalanan |
| Dalam Perjalanan | Status buttons: **Terkirim** · **Dibatalkan** |
| Terkirim / Dibatalkan | Button hidden ("Status sudah final") |

**SUPERADMIN:** full status picker — all statuses except current (no Gagal), as before. No driver-assignment UI in the modal; uses existing assign mechanism.

**Driver assignment UI (from Menunggu, regular admin only):**
- Radio list of drivers that are **paired 1:1 with a vehicle** and are **ACTIVE** (excludes ON_DUTY + UNAVAILABLE).
- Each radio option shows a **2-column card**:
  - **Col 1 — Driver:** name · license expiry date · phone number
  - **Col 2 — Vehicle:** jenis kendaraan · STNK expiry · KIR expiry · service due date — with a near-due warning badge on any expiring field
- **"Link Shipment" checkbox** below the driver list: if checked, shows a radio list of other Menunggu shipments; the selected shipment gets the same driver+vehicle on confirm.
- Confirm → both shipments (if linked) assigned → status → **Ditugaskan**.

**Reconfirm UI (from Ditugaskan, regular admin only):**
- Displays the currently assigned driver+vehicle in the same **2-column card** format (read-only by default).
- **"Ganti Driver" checkbox**: if checked, reveals the radio list of ACTIVE drivers (same 2-col card format) to pick a replacement.
  - If a new driver is selected: on confirm → shipment.driverId = new driver (**vehicle unchanged**); old driver status handling via "Tandai driver lama tidak tersedia" checkbox (default checked) → old driver → UNAVAILABLE.
- Confirm (with or without a swap) → status → **Dalam Perjalanan**.
- **Departure guard:** if the confirmed driver is already ON_DUTY on another shipment, block and surface an error identifying the conflicting shipment.

### Ganti Driver
Ganti Driver is **embedded inside the Ditugaskan reconfirm modal** (checkbox-triggered radio list) — there is no separate standalone button.

### Departure guard
A driver can be assigned to **several Ditugaskan** shipments, but only **one** may be in transit at a time. At the **Dalam Perjalanan** transition, block if that driver is already ON_DUTY elsewhere; surface an error in the UI pointing to the conflicting shipment.

### UI / UX fixes (ship with phase ③)
- Rename "Ubah Status" → **"Update Status"** throughout.
- **Confirmation box z-index:** the modal must render above the shipment detail panel layer (currently appears behind it). Fix with explicit `z-index` stacking.
- **Fade pop-in animation:** 0.3s fade + scale-up on modal open (CSS keyframe or Tailwind transition).

### Phasing (smallest → biggest blast radius)
1. **Driver↔Vehicle pairing** (provisional — re-confirm first): schema + fleet pair/unpair endpoint + Armada/Drivers UI.
2. **On-Duty lifecycle + "Pengganti" badge:** ON_DUTY auto-managed on Dalam Perjalanan / completion; "Pengganti" badge when shipment.driverId ≠ vehicle.primaryDriverId.
3. **Status rework** (last; client-coordination deferred): remove Gagal enum + migration; add Ditugaskan enum + migration; `statusFlow.ts` update; assign route (stop auto-TRANSIT → set Ditugaskan); Update Status modal rework (Menunggu → driver assignment UI + Link Shipment checkbox; Ditugaskan → reconfirm UI + Ganti Driver checkbox + departure guard; Dalam Perjalanan → Terkirim/Dibatalkan buttons); z-index + fade animation fix; rename "Ubah Status" → "Update Status"; update badges/filters/`mapStatus`.

### Blast radius / shared-contract notes
Schema (`Vehicle`/`Driver` + `DriverStatus` & `ShipmentStatus` enums — shared contract), `fleet.ts` (+pairing route), shipment `assign` + `status` routes, `ShipmentsSection` (assign UI inside modal, Ganti-Driver modal, "Pengganti" badge, link-shipment), Armada/Drivers sections, seed (pairings + new enum values). Both new/changed enum values are **client-visible** → coordinate during the client-dashboard pass. Gagal removal is client-visible too — flag for friend. All build is admin-scope.

## ✅ DONE (2026-07-02) — Create-time driver pairing in Armada
Adding a vehicle now **requires** selecting a primary driver — a radio list of available (unpaired, non-UNAVAILABLE; ON_DUTY shown disabled) drivers in the "Tambah Kendaraan" form. On submit it creates the vehicle then pairs via `fleetAPI.pairDriver` (frontend-only, `ArmadaSection.jsx`, no backend change). Build ✓ / lint ✓.

## 🚧 Next planned — Driver lifecycle / archive (resign / deceased) — DESIGN ONLY, not built
**Source:** user (2026-07-02). Permanently removing a driver (resign/death) must NOT lose history. **No code yet.**

**Problem:** the only removal path today is `DELETE /api/fleet/drivers/:id`, which `SET NULL`s the vehicle pairing **and nulls `driverId` on the driver's past shipments** → erases the record of who drove them. Bad for a logistics audit trail.

**Recommendation — soft-delete / archive, never hard-delete:**
- Add **`Driver.archivedAt DateTime?`** (nullable) — a lifecycle marker kept *separate* from operational `status` (ACTIVE / ON_DUTY / UNAVAILABLE). Migration needed.
- New **Arsipkan/Resign action** (DriversSection) → `PATCH /api/fleet/drivers/:id/archive` (+ a reactivate for undo / return).

**Archive flow + guards:**
1. **Block if ON_DUTY** (driver mid-transit) — must finish/substitute that shipment first (same spirit as the departure guard).
2. **Auto-unpair** — if they're a vehicle's `primaryDriver`, clear it and **flag "vehicle needs a new primary driver"** (matters more now that every new vehicle *requires* a primary — an archived primary leaves the vehicle unassignable until re-paired).
3. **Preserve history** — do NOT null `shipment.driverId`; the soft-deleted row stays so past shipments still resolve the driver's name.
4. **Exclude everywhere** — archived drivers drop out of every picker (create-pairing list, pair modal, Ganti-Driver/substitute list, assign). Add an `archived` filter to `GET /api/fleet/drivers` (default excludes archived).
5. **Reversible** — reactivate covers accidental-archive / "they came back."

**Interplay:** ties to the create-time pairing above — archiving a primary driver must surface the widowed vehicle for re-pairing.
**Blast radius:** schema (`Driver.archivedAt` + migration — shared contract) · `fleet.ts` (archive/reactivate + exclude-archived) · `DriversSection` (Resign button, hide archived, re-pair prompt). Admin-scope; client shipment reads unaffected.

## ✅ DONE (2026-07-04) — Wired Vehicle brand/model/color + Brands/Colors lists to backend
**Implemented** the design below (lookup tables + free-text columns). Uncommitted on `tier1-infra`. See RUNBOOK Session Log `2026-07-04`. **Decisions used:** brand/model/color **required on create** (DB cols nullable for backward compat); **any admin** may add brands/colors (`adminOnly`; UI still shows the "Tambah" buttons to SUPERADMIN only). **Migration:** `20260703171800_add_vehicle_brand_color` (additive). **Verified:** typecheck 45 (fleet.ts clean, no new), web build ✓, live smoke 7/7, seed backfilled the 9 vehicles. Design spec kept below as a record.

**Context (original):** the pulled `main` UI refresh (`220c4a1`) added — in `ArmadaSection` — brand/model/color form fields + "Add Brand"/"Add Color" nested modals, all **mock & not persisted**: `availableBrands`/`availableColors` were literal arrays, and `brand`/`modelName`/`color` form state was **not sent to `addVehicle`** and had **no DB column**.

**Chosen approach:** lightweight lookup tables for the selectable lists + free-text name columns on Vehicle (matches the friend's "add + select from list" UI).

**Backend:**
- **`Vehicle` schema:** add `brand String?`, `modelName String?`, `color String?`. ⚠️ Use `modelName`, NOT `model` (Prisma keyword risk).
- **New models:** `VehicleBrand { id @id @default(uuid); name String @unique; createdAt }` and `VehicleColor { …same… }`. Additive migration (no enum-migration gotchas).
- **`fleet.ts`:** `POST`/`PATCH /vehicles` accept & persist `brand`/`modelName`/`color` (same `|| null` pattern as chassis/engine); `GET /api/fleet/brands` + `POST /api/fleet/brands {name}` (reject dup/empty); same for `/colors`. Vehicles GET already returns all scalars.

**Frontend (`ArmadaSection.jsx` + `api.js`):**
- `api.js`: `fleetAPI.getBrands/addBrand/getColors/addColor`.
- Replace mock `availableBrands`/`availableColors` with API data (fetch on mount / when create modal opens).
- Add-Brand / Add-Color modals → `POST` then refetch (instead of local array push).
- `handleCreateVehicle` / `handleUpdateVehicle`: send `{ brand, modelName, color }` (currently omitted).
- Display brand/model/color in the vehicle table + detail panel.
- **Optional seed:** a few brands/colors + set them on some seed vehicles so dropdowns aren't empty.

**Open decision (chosen = lookup tables):** dedicated `VehicleBrand`/`VehicleColor` tables (supports pre-adding a brand before any vehicle uses it — matches the Add-modals) vs. distinct-strings-from-vehicles (like `/api/users/companies`). Chose lookup tables; revisit if simpler preferred.
**Blast radius:** schema (shared contract) + migration · `fleet.ts` · `api.js` · `ArmadaSection.jsx`. Admin-scope; client reads unaffected.

## ✅ DONE (2026-07-04) — Beranda "Log Aktivitas" panel wired (SUPERADMIN-only, normal-admin actions)
**Implemented.** The Overview (Beranda) "Log Aktivitas" panel was mock (`MOCK_ACTIVITIES`); now it reads real `AdminAuditLog` entries. **SUPERADMIN-only** (panel hidden for OPERATIONS/SUPPORT; left pane goes full-width for them). Shows **normal-admin (OPERATIONS/SUPPORT) actions** — the oversight view.
- **Backend:** new `routes/auditLogs.ts` → `GET /api/audit-logs` (SUPERADMIN-gated via `requirePermission("admin:manage")`), params `scope=normal|all` (default all), `adminId`, `limit`(≤100)/`offset`. Returns `{ logs, total }` with `admin { id, fullName, role }`. Mounted at `/api/audit-logs` in `index.ts`. **Tracks ALL admins' activity** (the endpoint can return superadmin actions too via `scope=all` / `adminId`), ready for the deferred Profil log below.
- **Frontend:** `auditLogsAPI.list` in `api.js`; `OverviewSection.jsx` fetches `scope=normal`, maps actionType→icon/color + relative-time (id-ID), loading/empty states, working "Muat Lebih Banyak" (offset pagination).
- **Indonesian localization (display layer):** `formatAuditSummary()` in `OverviewSection` translates all 27 `changesSummary` templates + status tokens to Indonesian using the **exact UI labels** (TRANSIT→DALAM PERJALANAN, CANCELLED/FAILED→DIBATALKAN, invoice DRAFT→KONSEP/PAID→LUNAS, etc.; uppercased). Frontend-only (stored summaries stay English/canonical → existing rows localize on render). If the Profil log is built, **extract `formatAuditSummary`/`activityVisual`/`relativeTime` to a shared `lib/auditLog.js`** to avoid duplication.

## 🚧 Next planned — Profil-page "Log Aktivitas" (superadmin's OWN actions) — DEFERRED (2026-07-04)
**Source:** user (2026-07-04). The `AdminProfileSection` also has a "Log Aktivitas" (still mock). Superadmin's own actions should surface **there**, NOT in the Beranda panel (which is normal-admin-only). **Backend is already built** — call `GET /api/audit-logs?adminId=<self>` (or `?scope=all`) — so this is a frontend-only wiring task.
- Wire the Profil-page activity list to `auditLogsAPI.list({ adminId: <current admin id> })` (self-log) — mirror the OverviewSection render (actionType→icon, relative time, load-more).
- **Gate note:** the endpoint is currently `requirePermission("admin:manage")` (SUPERADMIN-only). If a normal admin should see their OWN activity on their profile, loosen the gate to allow `adminId === self` for any admin (add an `audit:read-own` path) — decide when building.
- **Blast radius:** frontend `AdminProfileSection.jsx` + maybe a small gate tweak in `auditLogs.ts`. Admin-scope.

## Where we are right now (2026-07-01)
> Authoritative session history = RUNBOOK Session Log. This is the quick snapshot.
- **Branch:** `tier1-infra`, NOT pushed (per lock). `main` has nothing new (friend's frontend frozen → we have ownership of `apps/web`).
- **⚠️ Big UNCOMMITTED batch on disk** (not yet committed):
  - **Backend:** `prisma/schema.prisma` (vehicle `serviceDate`/`chassisNumber`/`engineNumber` + `DITUGASKAN` enum), `prisma/seed.ts`, 2 new migrations (`add_vehicle_service_chassis_engine`, `add_ditugaskan_status`), `src/routes/fleet.ts`, `src/routes/shipments.ts` (all Phase ②③ changes + WA msg), `src/index.ts` (rate limit), `src/lib/statusFlow.ts`.
  - **Frontend:** `AdminModal.jsx` (z-index), `AdminStatusBadge.jsx` (assigned), `ShipmentsSection.jsx` (full rewrite — driver-vehicle assign UI, per-status modal, Pengganti badge, Ditugaskan filter tab).
  - **Docs:** `DEV-PLAN.md`, `RUNBOOK.md`, `DEPLOYMENT.md`.
- **DB:** dev DB **freshly reseeded** — 2 admins (`admin@mpl.com`/`admin1234` SUPER, `ops@mpl.com`/`ops1234` OPS), 10 clients, 8 drivers, 9 vehicles, 13 shipments. ⚠️ **After any reseed: re-login** (stale localStorage JWT stays "logged in" but writes 500 — FK to wiped admin id), and re-seed after any `npm run smoke` (it pollutes; `migrate reset` does NOT auto-seed → run `npx prisma db seed`).
- **Recently DONE:** quick wins (#9/#7) · file-upload primitive · profile-pics backend (#3) · **RBAC #10** · WA driver-notify (cargo + real addresses) · status-change UX (frontend #8) · assign-button RBAC gate · scrollbar fix · **self-service admin password reset (#2)**.
- **Next candidates:** driver↔vehicle **phase ①** (⏸ pending a schema discussion with the friend — the 🛠️ Planned section above; pairing *provisional*) · profile-info form (name/email — needs an admin self-update endpoint) · **#4** one-time WhatsApp driver notify · **#1** cleaner notifications · **#6** client↔backend.
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
- [~] **#3 profile picture** — backend ✅ (admin + client); **admin frontend ✅ (2026-07-07)** — Profil page upload via click-or-drag modal; **client frontend + admin topbar still pending** (see Parked / handoffs).
- [x] **#2** Reset password in profile ✅ (admin self-service, both roles — `PATCH /api/auth/admin/me/password`). · **#1** cleaner notification integration · **#4** one-time-use WhatsApp driver notify · **#6** integrate client side to backend.

**Recommended very-next action:** RBAC helper (#10), then features #2/#1/#4.

## Parked / handoffs
- **#3 profile picture — admin ✅ (2026-07-07); client + admin-topbar PENDING.**
  - **Admin (DONE):** `AdminProfileSection` — click the hero avatar → `AdminModal` dropzone (click **or** drag-and-drop), circular preview, upload via `authAPI.uploadAdminAvatar` (FormData path added to `api.js`); shows the saved avatar via `GET /api/auth/admin/me`. CSP `img-src` now allows the API origin (dev `vite.config.js` + prod `_headers`/`.htaccess`).
  - **🚧 Admin topbar avatar — NEXT (frontend-only):** the topbar (`AdminDashboardPage`) still renders a `ui-avatars` placeholder from `fullName`; it does NOT reflect the uploaded photo. Wire it so the avatar shows app-wide: add an additive `updateUser(patch)` (or an admin-aware `refreshProfile`) to `AuthContext`, have `AdminProfileSection` call it after upload + populate `avatarUrl` on mount, then render `resolveAvatar(user.avatarUrl)` (fallback to the ui-avatars placeholder) in the topbar. ⚠️ Touches `AuthContext` — keep the change **additive** (the localStorage→cookie auth rehaul is separately deferred; don't entangle).
  - **Client (PENDING, waiting on friend's UI):** `POST /api/users/me/avatar` (field `file`) → `{ avatarUrl }`; `GET /api/users/me` returns `user.avatarUrl`. Reuse the same `api.js` FormData path + the dropzone-modal pattern from `AdminProfileSection`.
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
