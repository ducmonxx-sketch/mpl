# Daftar Kendaraan (admin · nav id `armada`)
**File:** `apps/web/src/pages/AdminComponents/ArmadaSection.jsx` (1409 lines) · **Roles:** SUPERADMIN, OPERATIONS, SUPPORT, KEPALA_ARMADA (nav filter: `AdminSidebar.jsx:54-69`; PIC_PABRIK/PIC_GUDANG never see it). KEPALA_ARMADA is read-mostly — "Tambah Kendaraan" (686), Service/Edit/Delete row buttons (631-667) are hidden via `userRole !== 'KEPALA_ARMADA'`. "Tambah Merk/Warna" buttons are SUPERADMIN-only (988, 1023). Rendered by `AdminDashboardPage.jsx:248` with `userRole={displayRole}`.

## What it does
- Lists all vehicles with status (AVAILABLE/STANDBY/IN_USE/MAINTENANCE), STNK/KIR/service dates, and the paired primary driver; silent re-fetch every 8 s (168-173).
- KPI cards (Total/Tersedia/Digunakan/Perawatan, 697-714), status tab filters + type/plate search (716-758).
- Full CRUD: create (driver pairing mandatory at creation, 294), edit (status editable only in edit mode, 1115-1127), delete with `window.confirm` (440-454).
- Driver↔vehicle 1:1 pairing: pasang (pair modal 1188-1257), lepas (confirm modal 1259-1272), plus pairing at creation (1132-1184).
- "Pengganti" (substitute) detection: if the vehicle's most-recent active shipment is driven by someone other than the primary driver, the table and detail panel show an amber badge (123-125, 588-599, 867-871).
- Service scheduling modal (1274-1307) writes `serviceDate` via a merged PATCH (349-382).
- Brand/color lookup dropdowns loaded from backend, with SUPERADMIN nested add-modals that auto-select the new value (1309-1406).
- Slide-over detail panel (portal, 782-953) with pair/service/edit footer actions.

## Data & endpoints
| api.js fn (`apps/web/src/lib/api.js`) | HTTP route (`apps/api/src/routes/fleet.ts`) | Purpose |
|---|---|---|
| `fleetAPI.getVehicles` (377) | `GET /api/fleet/vehicles` (178) | List; includes `primaryDriver`, `_count.shipments`, latest active shipment (STANDBY/DITUGASKAN/TRANSIT) for substitute detection |
| `fleetAPI.addVehicle` (381) | `POST /api/fleet/vehicles` (213) | Create; rejects duplicate `licensePlate` (217-219) |
| `fleetAPI.updateVehicle` (385) | `PATCH /api/fleet/vehicles/:id` (259) | Partial update (only defined fields applied, 264-280) |
| `fleetAPI.deleteVehicle` (389) | `DELETE /api/fleet/vehicles/:id` (303) | Nulls `vehicleId` on all its shipments, then deletes (317-320) |
| `fleetAPI.pairDriver` (393) | `PATCH /api/fleet/vehicles/:id/pair-driver` (344) | Sets `primaryDriverId`; 409 if driver already paired elsewhere (362-367) |
| `fleetAPI.unpairDriver` (397) | `PATCH /api/fleet/vehicles/:id/unpair-driver` (397) | Clears `primaryDriverId`; 400 if none set |
| `fleetAPI.getDrivers` (361) | `GET /api/fleet/drivers` (32) | Feeds pair pickers (create modal 230, pair modal 390) |
| `fleetAPI.getBrands` / `addBrand` (401/405) | `GET`/`POST /api/fleet/brands` (439/449) | Brand lookup list; POST rejects dupes (409) |
| `fleetAPI.getColors` / `addColor` (409/413) | `GET`/`POST /api/fleet/colors` (466/476) | Color lookup list |

## Key state & flows
- **List:** `vehicles`, `loading`, `filter`, `searchQuery`, `currentPage`, `selectedVehicle` (62-67). `fetchVehicles` (118-156) maps API rows → `{status, rawStatus, rawStnkExpiry, rawKirExpiry, rawServiceDate, primaryDriver, activeDriverName, isSubstitute, assignments}`. Derived: `filtered` (464-471), counts (473-475).
- **Create/edit modal:** shared form fields `type/brand/modelName/color/licensePlate/chassisNumber/engineNumber/stnkExpiry/kirExpiry/serviceDate/status` + `isEditMode`/`editingVehicleId` (70-84). Create validates required fields **and** `selectedDriverId` (289-297), then `addVehicle` → `pairDriver` as two calls — pairing failure surfaces a "pair manually" toast, vehicle still created (300-307).
- **Pairing:** `showPairModal`, `pairingVehicle`, `availableDrivers`, `selectedDriverId`, `loadingDrivers`, `pairing` (104-109). Derived `unpairedDrivers` (116) = fetched drivers (already filtered `status !== 'UNAVAILABLE'` at 231/392) minus anyone who is `primaryDriver` of any vehicle in the current list. ON_DUTY drivers render disabled ("Bertugas", 1151, 1209). Unpair: `unpairVehicle`/`unpairing` (112-113), `confirmUnpair` (423-438) also patches the open detail panel's `primaryDriver` to null (430).
- **Expiry badges:** `getExpiryStatus` (28-36) — `expired` if past, `warning` with "N hari lagi" if ≤30 days. Applied to STNK (533), KIR (551), serviceDate (569), and the pair-modal driver SIM (1210). Backend mirrors this with `flagIfExpired` on create/update (fleet.ts 248-250, 292-294).
- **Brand/color lookups:** `availableBrands`/`availableColors` via `fetchLookups` (158-166, non-fatal on error); refreshed on modal open (226). `brandOptions`/`colorOptions` (673-676) prepend the current value if it's no longer in the lookup list.
- **Service modal:** `showServiceModal`/`serviceVehicleId`/`serviceNotes` (99-101); `handleSaveService` (349-382) re-sends the vehicle's existing fields merged with the new `serviceDate`.

## Cross-page couplings
- **Status mirror (backend):** `apps/api/src/lib/shipmentStatus.ts` — shipment STANDBY sets vehicle STANDBY, DITUGASKAN/AT_PLANT/TRANSIT set IN_USE, DITURUNKAN/DELIVERED/CANCELLED release to AVAILABLE (RULES 47-49, `ruleFor` 52-61). Updates are status-filtered (`updateMany where status in vehFrom`, line 90) so MAINTENANCE is never overridden; RELEASE is group-aware (78-87). This page never sets STANDBY/IN_USE itself — those arrive via the mirror (except manual edit, see Gotchas).
- **Readers of vehicle status/data:** `ShipmentsSection.jsx:602-616` (create + Hubungkan pickers), `AdminDashboardPage.jsx:100-120` (topbar STNK/SIM ≤30d expiry alerts), `OverviewSection.jsx` (fleet KPIs).
- **Audit logs:** every mutation writes `adminAuditLog` (fleet.ts 238, 282, 322, 379, 414) → surfaced in Beranda activity feed via `GET /api/audit-logs` (SUPERADMIN). Pair/unpair log as `UPDATE_VEHICLE`.
- **DriversSection** shows the reverse side of the pairing (`primaryVehicle`) and the same Pengganti logic.

## Gotchas
- **Pagination is cosmetic:** `AdminDataTable` gets the full `filtered` array (769) and renders every row — `AdminPagination` (770-776) changes `currentPage` but nothing slices by it.
- **KEPALA_ARMADA gating is UI-only and leaky:** the detail-panel footer (917-949) exposes Pair/Service/Edit to all roles including KEPALA_ARMADA, and the backend `adminOnly` accepts any admin type (`apps/api/src/middleware/auth.ts:49-55`) — no per-role enforcement server-side.
- **"Ganti Driver Utama" is unreachable:** both pair entry points are disabled when a primary driver exists (row button 620, footer 921), so the "Ganti" title/label (929, 1191) never shows a usable flow — you must Lepas first.
- **STANDBY blind spots:** the edit-mode status select omits STANDBY (1122-1124) — editing a STANDBY vehicle shows a blank select; the detail-panel badge colors STANDBY red like MAINTENANCE (795-799).
- **Manual status edit can fight the mirror:** PATCH accepts any `status` unconditionally (fleet.ts 269); setting IN_USE by hand desyncs from shipment state until the next mirror transition matches it.
- **`serviceNotes` is dead UI:** collected in the modal (1296-1305) but never sent (comment at 369) — no backend field.
- **Deletion has no active-shipment guard:** deleting a vehicle nulls `vehicleId` even on in-TRANSIT shipments (fleet.ts 317-320). Confirm dialog warns, nothing blocks.
- **Duplicate plate on edit → 500:** create checks uniqueness (fleet.ts 217-219) but PATCH doesn't; Prisma P2002 becomes a generic 500.
- Dead code: static `anime` import (3) and `AdminStatusBadge` import (8) unused; `VEHICLE_STATUS_BADGE_MAP` (50-55) unused; dynamic `import('../../lib/api')` at 390 despite the static import at 13.

## How to add a feature cleanly
1. **Pick the render region:** header/actions 680-694 · KPI cards 696-714 · search/filters 716-758 · table columns 477-671 · detail panel 782-953 · create/edit modal 955-1186 · pair modal 1188-1257 · unpair 1259-1272 · service 1274-1307 · lookup modals 1309-1406.
2. **New field:** add state near 70-84, wire into `resetForm` (206-221), `handleOpenEdit` (244-275), both submit handlers (289-347), and the row mapping in `fetchVehicles` (122-148) with a `raw*` twin if it's a date.
3. **New endpoint:** add the fn to `fleetAPI` in `apps/web/src/lib/api.js` (359-415, follow the existing one-liner `api.get/post/patch/delete` pattern) and the route in `apps/api/src/routes/fleet.ts` with `authenticate, adminOnly`, an `adminAuditLog` write, and try/catch → 500.
4. **Don't break:** the `raw*`-vs-formatted field convention; `handleSaveService`'s merge (349-370) — it re-sends fields, so any new required backend validation will break it; the two-step create→pair flow (300-307); the 8 s silent poll (`{ silent: true }` must not flash loading); shared contracts (`api.js`, schema) per CLAUDE.md.
5. **Role-gate** new mutating buttons with `userRole !== 'KEPALA_ARMADA'` (match 631-667) and remember the backend does not enforce it.
6. **Verify:** `cd apps/api && npm run typecheck` then `cd apps/web && npx vite build`; manually check one create, one pair/unpair cycle, and that the Beranda activity feed picked up the audit log.
