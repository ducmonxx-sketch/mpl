# Driver (admin · nav id `drivers`)
**File:** `apps/web/src/pages/AdminComponents/DriversSection.jsx` (694 lines) · **Roles:** SUPERADMIN, OPERATIONS, SUPPORT, KEPALA_ARMADA (nav filter: `AdminSidebar.jsx:54-69`; PIC_PABRIK/PIC_GUDANG never see it). KEPALA_ARMADA is read-mostly — "Tambah Driver" (334) and row Edit/Delete (296-319) are hidden via `userRole !== 'KEPALA_ARMADA'`. Rendered by `AdminDashboardPage.jsx:247` with `userRole={displayRole}`.

## What it does
- Lists all drivers with phone, SIM number/type/expiry, status (ACTIVE/STANDBY/ON_DUTY/UNAVAILABLE mapped to badge keys, 36-44), and total assignments; silent re-fetch every 8 s (104-108).
- KPI cards: Total / Tersedia / On Duty / Tidak Aktif (342-395); status tab filters + name/phone/SIM search (397-439).
- CRUD: create driver (165-182), edit incl. status toggle Tersedia/Tidak Aktif (184-208, 659-688), delete with `window.confirm` (210-224).
- SIM expiry badge on the name column — "SIM Expired" / "SIM N hari lagi" when ≤30 days (26-34, 253-267).
- "Pengganti" badge when the driver's most-recent active shipment uses a vehicle whose `primaryDriverId` isn't them (76-78, 257-261), with tooltip naming the substitute vehicle (92, 258).
- Slide-over detail panel (portal, 464-586) shows driver info, SIM info, and the paired `primaryVehicle` card (550-570); footer Edit button (574-582).
- No pairing controls here — pasang/lepas driver lives on the Armada page; this page only *displays* `primaryVehicle`.

## Data & endpoints
| api.js fn (`apps/web/src/lib/api.js`) | HTTP route (`apps/api/src/routes/fleet.ts`) | Purpose |
|---|---|---|
| `fleetAPI.getDrivers` (361) | `GET /api/fleet/drivers` (32) | List; includes `primaryVehicle`, `_count.shipments`, latest active shipment (STANDBY/DITUGASKAN/TRANSIT) for substitute detection (49-54). Supports `?status=` (34) — unused here |
| `fleetAPI.addDriver` (365) | `POST /api/fleet/drivers` (66) | Create; runs `flagIfExpired` for SIM (91) |
| `fleetAPI.updateDriver` (369) | `PATCH /api/fleet/drivers/:id` (100) | Partial update; accepts any `status` (110) |
| `fleetAPI.deleteDriver` (373) | `DELETE /api/fleet/drivers/:id` (137) | Transaction: nulls `driverId` on shipments, clears `Vehicle.primaryDriverId`, deletes (151-155) |

## Key state & flows
- **List:** `drivers`, `loading`, `filter`, `searchQuery`, `currentPage`, `selectedDriver` (50-55). `fetchDrivers` (71-102) maps rows → `{name, phone, licenseNumber, licenseType, licenseExpiry, rawLicenseExpiry, status (lowercase badge key), rawStatus, assignments, primaryVehicle, isSubstitute, substituteVehicle}`. Derived: `filtered` (234-242), `availableCount`/`onDutyCount`/`inactiveCount` (244-246).
- **Status mapping:** `mapDriverStatus` (36-44) — API `ACTIVE→available`, `STANDBY→standby`, `ON_DUTY→on_duty`, `UNAVAILABLE→inactive`; UI filters use the lowercase keys (226-232) while the edit form works with `rawStatus` uppercase values (161).
- **Create/edit modal:** `fullName/phoneNumber/licenseNumber/licenseType/licenseExpiry` + `isEditMode`/`editingDriverId`/`status` (60-69). All five fields required on both submit paths (166, 185). SIM type is a 3-button toggle A/B1/B2 (625-649); status toggle appears only in edit mode with just ACTIVE/UNAVAILABLE options (659-688).
- **Expiry badge:** `getExpiryStatus` (26-34) — same ≤30-day rule as Armada, labels prefixed "SIM". Applied only in the name column (253) and mirrored server-side by `flagIfExpired` (fleet.ts 91, 128).
- **Detail panel:** opens on row click or eye icon (`setSelectedDriver`), anime slide-in (112-125); Edit footer re-opens the shared modal with the row (578).

## Cross-page couplings
- **Status mirror (backend):** `apps/api/src/lib/shipmentStatus.ts` — shipment STANDBY sets driver STANDBY, DITUGASKAN/AT_PLANT/TRANSIT set ON_DUTY, DITURUNKAN/DELIVERED/CANCELLED release to ACTIVE (RULES 47-49, `ruleFor` 52-61). Mirror updates are status-filtered (line 89) so UNAVAILABLE drivers are never overridden; RELEASE is group-aware for linked shipments (78-87). ON_DUTY/STANDBY are therefore *read-only outcomes* on this page.
- **Readers of driver status/data:** `ShipmentsSection.jsx:602` (create-form driver picker — selects by `primaryVehicle.status === 'AVAILABLE'`, see shipmentStatus.ts:57 comment), `ArmadaSection.jsx:230/390` (pair pickers exclude UNAVAILABLE, disable ON_DUTY), `OverviewSection.jsx:217`, `AdminDashboardPage.jsx:102` (topbar SIM ≤30d expiry alerts, 111-120).
- **Pairing:** `primaryVehicle` shown here is written by Armada's pair/unpair endpoints; deleting a driver here silently unpairs them from their vehicle (fleet.ts 153) — the Armada page will show "Belum dipasangkan" on next poll.
- **Audit logs:** CREATE_DRIVER/UPDATE_DRIVER/DELETE_DRIVER written on every mutation (fleet.ts 81, 118, 157) → Beranda activity feed (`GET /api/audit-logs`, SUPERADMIN).

## Gotchas
- **Pagination is cosmetic:** full `filtered` array is passed to `AdminDataTable` (450); `AdminPagination` (451-457) never slices the data.
- **Role gating is UI-only and leaky:** the detail-panel footer Edit button (574-582) is not gated by `userRole`, so KEPALA_ARMADA can edit from there; backend `adminOnly` accepts any admin role (`apps/api/src/middleware/auth.ts:49-55`).
- **Edit-status toggle can stomp the mirror:** only ACTIVE/UNAVAILABLE are offered (662-665), but editing an ON_DUTY driver and clicking "Tersedia" PATCHes `status: ACTIVE` (fleet.ts 110 — no transition validation) while their shipment still occupies them; the mirror will re-engage on the next shipment transition, not immediately. Editing an ON_DUTY/STANDBY driver shows *neither* button selected.
- **Deletion has no active-shipment guard:** nulls `driverId` on all shipments including TRANSIT ones and clears the vehicle pairing (fleet.ts 151-155). The confirm text warns; nothing blocks.
- **No uniqueness checks** on `licenseNumber` or `phoneNumber` (fleet.ts 66-79) — duplicate drivers are silently possible.
- **KPI cards omit STANDBY:** counts at 244-246 cover available/on_duty/inactive only; standby drivers appear in Total and the filter tab (229) but no card.
- Dead code: `detailPanelRef` (57) is created but never attached; duplicated `formatDate`/`getExpiryStatus` helpers vs `ArmadaSection.jsx:15-36` (copy-paste drift risk — labels already diverged).

## How to add a feature cleanly
1. **Pick the render region:** header 327-340 · KPI cards 342-395 · search/filters 397-439 · table columns 248-323 · detail panel 464-586 · create/edit modal 588-691.
2. **New field:** add state near 60-69, wire into `resetForm` (127-136), `handleOpenEdit` (148-163), both submit handlers (165-208), and the row mapping in `fetchDrivers` (75-94) with a `raw*` twin if it's a date; add it to the backend destructure + spread in fleet.ts PATCH (103-115) using the `!== undefined` pattern.
3. **New endpoint:** one-liner in `fleetAPI` (`apps/web/src/lib/api.js:359-415`) + route in `apps/api/src/routes/fleet.ts` with `authenticate, adminOnly`, an `adminAuditLog` write, and try/catch → 500.
4. **Don't break:** the lowercase-badge vs uppercase-`rawStatus` split (36-44 vs 161) — filters and KPI counts key off the lowercase form; the 8 s silent poll (`{ silent: true }`); substitute detection assumes the backend keeps sending the one latest active shipment (fleet.ts 49-54); pairing stays Armada-side — don't add pair controls here without reusing the pair-driver endpoint and its 409 guard.
5. **Role-gate** new mutating buttons with `userRole !== 'KEPALA_ARMADA'` (match 296-319), knowing the backend won't enforce it.
6. **Verify:** `cd apps/api && npm run typecheck` then `cd apps/web && npx vite build`; manually check create → edit → delete on a seeded driver and confirm the audit log rows land in the Beranda feed.
