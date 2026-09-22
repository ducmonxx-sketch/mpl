# Manajemen Pengiriman (admin · nav id `shipments`)
**File:** `apps/web/src/pages/AdminComponents/ShipmentsSection.jsx` (3055 lines) · **Roles:** all six admin roles. SUPERADMIN + OPERATIONS (`STATUS_OVERRIDE_ROLES`, L57) get the tabbed table, free status picker, direct-assign row button, and delete. KEPALA_ARMADA / PIC_PABRIK / PIC_GUDANG (`usesFieldLayout`, L310) get a compact field layout: status dropdown instead of tabs, centered detail modal, Dalam Proses/Selesai toggle, and one scoped status step each. SUPPORT gets the tabbed layout plus a legacy fallback modal flow. KEPALA_ARMADA + OPERATIONS (`SHIPMENT_CREATOR_ROLES`, L62) can create shipments.

## What it does
- Server-paginated shipment table (25/page, L105) with search (350ms debounce), client/service/status/plant filters, and per-role priority sort — all pushed to the API via `listParams` (L403-419).
- Detail panel (portal, L2457-2670): client, route, driver/vehicle (with "Pengganti" badge), linked-trip siblings, plant-check readout, WhatsApp notify, Surat Jalan PDF download, delete.
- Status pipeline modal: each pipeline role advances its own leg of PENDING→STANDBY→DITUGASKAN→AT_PLANT→TRANSIT→DITERIMA→DITURUNKAN→DELIVERED; override roles get a free picker for any status.
- Create modal: both creator roles (KEPALA_ARMADA + OPERATIONS) use the same **Armada form** (`usesArmadaCreateForm`) — Unit/Cargo/Container with a paired driver; shipments carrying a driver+vehicle start at STANDBY. The legacy generic (client-style) form is kept in the modal's else-branch as a **FUTURE FEATURE PLAN** (currently unreachable).
- PIC_PABRIK 3-page plant-check wizard (Pengiriman/LKU/KSU) with localStorage draft autosave; PIC_GUDANG serah-terima with per-unit arrival-defect checklist feeding condition analytics.
- 8s change-fingerprint polling (`/version`) that only refetches when count/maxUpdatedAt moves (L465-491).
- Vector Surat Jalan PDF via lazy-loaded jsPDF + autotable for DELIVERED shipments (L1999-2142).

## Data & endpoints
| api.js fn | HTTP route | Purpose / params |
|---|---|---|
| `shipmentsAPI.list(params)` | `GET /api/shipments` | Page fetch. `limit`, `offset` (pagination opt-in — no limit = full set, client dashboard relies on that), `sort=priority\|completion`, `search`, `status` (comma list, e.g. `CANCELLED,FAILED`), `clientName`, `serviceLevel`, `pickupPlantId`, `lifecycle=active\|done` (Dalam Proses/Selesai split, server-side `TERMINAL_STATUSES`) |
| `shipmentsAPI.getListMeta(params)` | `GET /api/shipments/list-meta` | Whole-set tab counts + client dropdown; counts honour `clientName`/`serviceLevel`, client list ignores them |
| `shipmentsAPI.getVersion()` | `GET /api/shipments/version` | `{ count, maxUpdatedAt }` change fingerprint for the 8s poll |
| `shipmentsAPI.getById(id)` | `GET /api/shipments/:id` | Detail + `siblings` (same `linkGroupId`, server-fetched) — drives deep links and delete scope |
| `shipmentsAPI.getLinkableTrips()` | `GET /api/shipments/linkable-trips` | STANDBY trips deduped by driver+vehicle for "Hubungkan Pengiriman" |
| `shipmentsAPI.getPickupPlants()` | `GET /api/shipments/pickup-plants` | Plant options (Unit create form + PIC_PABRIK filter) |
| `shipmentsAPI.create(data)` | `POST /api/shipments` | Create; `linkToShipmentId` joins an existing STANDBY trip (copies driver/vehicle/linkGroupId); starts at STANDBY when a driver+vehicle is attached at creation, else PENDING |
| `shipmentsAPI.assign(id, data)` | `PATCH /api/shipments/:id/assign` | Set driver/vehicle (+optional pickupPlantId/pickupDate); PENDING→DITUGASKAN only; mirrors driver+vehicle onto linked siblings |
| `shipmentsAPI.updateStatus(id, {status})` | `PATCH /api/shipments/:id/status` | Status move; forward = any admin, off-flow needs `status:override`; mirrors fleet, cascades DITUGASKAN to STANDBY siblings |
| `shipmentsAPI.plantCheck(id, data)` | `PATCH /api/shipments/:id/plant-check` | Persist Pengiriman/LKU/KSU rows (replace-prior), AT_PLANT→TRANSIT, transit-conflict guard |
| `shipmentsAPI.handover(id, data)` | `PATCH /api/shipments/:id/handover` | `catatanGudangPenerima` + `lkuUpdates` (arrival defects) → DELIVERED, sets `completionDate`, frees fleet |
| `shipmentsAPI.notifyDriver(id)` | `POST /api/shipments/:id/notify-driver` | Manual WhatsApp (OpenWA) assignment message to driver |
| `shipmentsAPI.remove(id, scope)` | `DELETE /api/shipments/:id?scope=group` | Delete one or the whole linked group; OPERATIONS only STANDBY, SUPERADMIN any |
| `fleetAPI.getDrivers/getVehicles`, `usersAPI.listAll`, `authAPI.getAdminMe` | fleet/users/auth routes | Modal pickers; PIC_PABRIK plant default from `admin.pickupPlantId` (L537-544) |

## Key state & flows
- **List:** `filter` (tab id), `filterClient`, `filterService`, `filterPlant`, `searchQuery`→`debouncedSearch`, `currentPage`, `viewMode` (`'today'|'history'`), `SHIPMENTS` (current page only), `totalCount`, `statusCounts`+`metaTotal` (from list-meta), `loading`. `listParams` memo (L403) is the single source of truth for the query; `fetchShipments` (L421) and the poll share it. Rows go through `mapShipment` (L367) — `rawStatus` = enum, `status` = `mapStatus()` lowercase display key.
- **Derived role flags (L300-310):** `role`, `isSuperAdmin`, `hasStatusOverride`, `canCreateShipments`, `isRegularAdmin` (= not override), `usesFieldLayout`. `canUpdateStatus` (L356-363) gates the Update Status button per role+rawStatus. `LINK_SHIPMENT_ENABLED = false` (L314) hides all Hubungkan entry points.
- **Status modal:** `showStatusModal`, `pendingStatus`, `modalLoading`, `fleetVehicles`. Per-role flows in `handleConfirmStatus` (L1058-1220) and `renderModalContent` (L1276-1836): KEPALA_ARMADA STANDBY→DITUGASKAN reconfirm with optional substitute driver (`gantiDriverChecked`, `newDriverId`, `tandaiTidakTersedia` → marks old driver UNAVAILABLE); PIC_PABRIK DITUGASKAN→AT_PLANT one-tap, then AT_PLANT wizard (`pabrikPage`, `pcPengiriman`/`pcLku`/`pcKsu`, `showPabrikConfirm`; draft persisted to localStorage `mpl:plantCheckDraft:<id>`, L890-903); PIC_GUDANG TRANSIT→DITERIMA→DITURUNKAN one-taps, then DITURUNKAN serah-terima (`catatanGudangPenerima`, `gudangLkuChecks` keyed by PlantCheckLku row id, `showGudangConfirm`); override roles pick any status from `availableStatusOptions` (L65).
- **Direct assign (override roles):** `showAssignModal`, `assigningShipment`, `assignDriverId`, `assignVehicleId` — row button `person_add` (L2224), submits `handleAssignDriver` (L820).
- **Create / link:** `showCreateModal`, `linkMode`, `linkTargetId`, `linkableTrips` (server-fetched, refreshed on modal open), ~15 `form*` fields; `selectableCreateDrivers` = paired drivers whose vehicle is AVAILABLE (L332). Link mode sends only `linkToShipmentId`; backend copies driver/vehicle and mints `linkGroupId`.
- **Linked siblings & delete:** `linkedSiblings` fetched per selection via `getById` (L512-535) — decides "Hapus" vs "Hapus Semua Terhubung"; `deleteScope` (`'single'|'group'`) opens the confirm box (L3028-3052); `canDeleteShipment` (L864) = SUPERADMIN any, OPERATIONS only STANDBY.
- **Polling:** `lastVersionRef` + `pollForChanges` (L465-491), 8s interval; first tick only records the baseline; on fingerprint-endpoint failure it falls back to a full silent refetch.
- **Deep link:** `highlightShipmentId` prop → `getById` fetch (L549-564) since the target row is usually not on the loaded page.

## Cross-page couplings
- **Fleet status mirror:** create-at-STANDBY reserves driver/vehicle (route L728-741); `/status`, `/plant-check`, `/handover` call `mirrorFleetStatus` (group-aware release); delete calls `releaseFleetIfUnused`. ArmadaSection reads these driver/vehicle statuses.
- **`linkGroupId` contract:** assign mirrors driver+vehicle to siblings (route L787-792); DITUGASKAN cascades to STANDBY siblings (route L1114-1119); single delete un-groups a lone survivor (route L1198-1201).
- **Audit logs:** assign/status/plant-check/handover/delete/notify all write `adminAuditLog` — surfaced in the Beranda activity feed (`GET /api/audit-logs`).
- **Notifications:** create/assign/status write client `notification` rows; assign raises `adminNotification` at >3 active shipments per driver.
- **Condition analytics (Overview):** `gudangLkuChecks` → `lkuUpdates` → `PlantCheckLku.arrivedDefective` feeds `/condition-analytics`.
- **Shared route caution:** `GET /api/shipments` is used by the client dashboard/TrackingSection unpaginated — never make `limit` mandatory server-side (route L90-96). Frontend `FORWARD_STATUS` (L40) and `STATUS_OVERRIDE_ROLES` (L57) must mirror `apps/api/src/lib/statusFlow.ts` and `rbac.ts`.

## Gotchas
- **UI-side vs backend gates:** `SHIPMENT_CREATOR_ROLES` is UI-only — POST allows any admin (L59-62). Delete and status-override are enforced backend-side (rbac + statusFlow); the frontend lists are mirrors that 403 if they drift.
- **Raw vs display status:** `rawStatus` (`AT_PLANT`) drives logic; `status` (`at_plant`, via `mapStatus` L70) drives badges. `mapStatus` folds legacy `FAILED` into `cancelled`, so the Dibatalkan tab queries `CANCELLED,FAILED` (L93-103). Comparing `status` against raw enum values is a live bug at L2623.
- **Field vs tabbed layout:** `usesFieldLayout` swaps tabs→status dropdown (L2318-2354), side panel→centered modal (L2460-2465), and adds the Dalam Proses/Selesai toggle. "Selesai" = lifecycle split on server `TERMINAL_STATUSES` (DELIVERED/CANCELLED/FAILED), sorted by `COALESCE(completionDate, pickupDate, createdAt) DESC` — not a date filter.
- **SUPPORT fallback is half-broken:** its DITUGASKAN flow sends TRANSIT (L1200), but the server forward map only allows DITUGASKAN→AT_PLANT, so it 403s; its Ganti Driver picker (L1705-1774) collects `newDriverVehicleId` but never submits it; its PENDING branch swallows errors (`catch(err) {}`, L1195).
- **KEPALA_ARMADA PENDING branch is dead:** `canUpdateStatus` gives KA the modal only at STANDBY (L359), so L1090-1121 (incl. free-text `assignPickupPlantId` sent into a FK column) is unreachable today.
- **Dead state:** `serahTerimaUrl`, `handoverNotes`, `vehicleCondition`, `lkuNumber`, `pabrikNotes` (L233-251) are reset but never rendered/submitted; frontend `STATUS_SORT_RANK` (L114) is superseded by the server copy; exported `SERVICE_LABELS`/`STATUS_OPTIONS` (L15-24) have no importers.
- Plant-check draft lives in localStorage per shipment id — survives reload, but "Clear All" (L906) is the only cleanup besides successful submit.
- notify-driver hardcodes the admin contact phone (route L864, flagged for env migration).

## How to add a feature cleanly
1. **State:** add `useState` in the matching block — list/filter (L190-206), detail panel (L209-211), status modal (L214-260), create form (L270-297). Reset modal fields in `resetModalState` (L915) or `resetCreateForm` (L656).
2. **Render regions:** table columns L2188-2236; header/toolbar/tabs L2239-2393; table+cards L2395-2454; detail panel L2456-2670; assign modal L2672-2708; create modal L2710-2948; status modal shell L2950-2972 with per-role bodies in `renderModalContent` L1276-1836; confirm boxes L2974-3052. New per-role modal step = one branch in `renderModalContent` + one in `handleConfirmStatus` (L1058) + title/subtitle/label helpers (L1223-1273).
3. **Endpoint:** add the route in `apps/api/src/routes/shipments.ts` (new literal GET paths must be registered ABOVE `/:id`, see L498/559), then one arrow fn in the `shipmentsAPI` block of `apps/web/src/lib/api.js` (L270-341). Never call `fetch` directly.
4. **New list filter:** add it to `listParams` (L403), to BOTH the Prisma `where` and the raw-SQL `conds` in the route (they must stay in sync, route L176-201), and reset `currentPage` on change.
5. **Don't break:** `GET /api/shipments` opt-in pagination (client dashboard), `mapShipment`'s shape, `FORWARD_STATUS`/`STATUS_OVERRIDE_ROLES` ↔ `statusFlow.ts`/`rbac.ts` mirrors, `linkGroupId` semantics, fleet status mirroring, audit-log writes.
6. **Verify:** `cd apps/api && npm run typecheck` then `cd apps/web && npx vite build`. For status-flow changes, exercise one shipment through the full pipeline with a pipeline-role account (UI gates and server gates fail independently).
