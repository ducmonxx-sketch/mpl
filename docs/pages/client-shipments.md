# Daftar Pengiriman (client · nav id `shipments`)
**File:** `apps/web/src/pages/dashboard/ShipmentsSection.jsx` (~113 lines) · shares `apps/web/src/pages/dashboard/shipmentStatus.js` (status labels/colors, all 10 `ShipmentStatus` values) with `ShipmentCard.jsx`. · **Roles:** clients only — verification enforced at login (`auth.ts:101-110`); no per-page gating.

## What it does
- Lists the client's shipments as expandable `ShipmentCard`s, newest first.
- Filter tabs (`ShipmentFilters`) now cover **all 10** `ShipmentStatus` values (fixed 2026-09-25 — was hardcoded to 4), built from `shipmentStatus.js`'s `SHIPMENT_STATUS_CONFIG`, with per-status count badges.
- Each card shows route (origin → destination) with a progress bar (`currentProgressPercent`), date, service level, weight; expanding lazy-fetches the shipment's **full real tracking timeline** (`trackingAPI.getTimeline`) and renders every checkpoint (`stepName` + `location` + timestamp + `driverNotes`) as a vertical timeline, dot-colored by `EventStatus` (DONE green / ACTIVE gold / UPCOMING gray).
- An in-page "Buat Pengiriman" button exists but is disabled via `{false && ...}` — creation is reached through the sidebar button instead (`ClientSidebar.jsx:150-159`), which opens `CreateShipmentModal` (documented below).
- Remounted with `key={refreshKey}` after a create so the new shipment appears.
- **The separate Tracking nav is gone (2026-09-25).** `ClientSidebar.jsx`'s "Pelacakan" item and `ClientDashboardPage.jsx`'s `tracking` case were removed; the timeline content that page used to show is now inline in the expanded `ShipmentCard` (see below). `TrackingSection.jsx` itself was NOT deleted — it's still mounted by the admin dashboard (protected shared contract per CLAUDE.md); see `tracking-shared.md`.
- Topbar search, "Lacak Penuh"-style jumps, and notification clicks that used to open Tracking now call `navigateToShipment(id)` in `ClientDashboardPage.jsx`: it switches to this nav (`shipments`), forces the "Semua" filter tab, sets `expandedId` to that shipment, and scrolls its card into view (`document.getElementById('ship-card-<id>')`). The old standalone "Lacak Penuh" button was removed from `ShipmentCard` since its own expanded view already shows the full timeline.

## Data & endpoints
| api.js fn | HTTP route | Purpose |
|---|---|---|
| `shipmentsAPI.list()` | `GET /api/shipments` | Full unfiltered list — **single fetch as of 2026-09-25** (was two: server-filtered + unfiltered-for-counts). Filtering by status now happens client-side in a `useMemo`. |
| `trackingAPI.getTimeline(id)` | `GET /api/tracking/:shipmentId` | Lazy-loaded per card on first expand (not on list render) — full checkpoint list, replacing both the old hardcoded fake text and the removed standalone Tracking page. |
| `shipmentsAPI.create(data)` | `POST /api/shipments` | Create shipment (from `CreateShipmentModal`) |

## Key state & flows
- State: `filter` (lowercase status key or `'all'`), `expandedId`, `shipments`, `loading`. `allDisplayShipments` (memoized) and `displayShipments` (client-side filtered) derive from the one fetch — no separate "all" fetch anymore.
- Filter flow: `ShipmentFilters` and this section both work in lowercase keys directly now — no more UPPERCASE↔lowercase conversion round-trip.
- Create-shipment flow: sidebar "Buat Pengiriman" → `ClientDashboardPage` `setCreateModalOpen(true)` (`ClientDashboardPage.jsx:222`) → `CreateShipmentModal` POST → `onCreated` → `handleShipmentCreated` closes the modal and bumps `refreshKey` (`ClientDashboardPage.jsx:177-180`) → this section remounts and refetches.
- `highlightId` prop (from `ClientDashboardPage`'s `highlightShipmentId`): a `useEffect` here forces `filter` to `'all'` and sets `expandedId` to it; a second `useEffect` (gated on `!loading`) scrolls `#ship-card-<id>` into view once the list has rendered.
- `ShipmentCard` per-card tracking fetch: `useEffect` gated on `isExpanded && !events && !eventsLoading` — fetches once per card, caches the full event array in local state, no refetch on re-collapse/re-expand.

### CreateShipmentModal (subsection — entry point of this flow)
**File:** `apps/web/src/components/ClientComponents/CreateShipmentModal.jsx` (167 lines), mounted at `ClientDashboardPage.jsx:258`.
- Single `formData` state (lines 10-21): origin/destination as three fields each (complete address, zip, province), `type` (package spec), `metricType` (`weight`|`qty`), `metricValue`, `notes`.
- On submit (lines 27-57) it joins the address triplets into `originLocation`/`destinationLocation` strings and calls `shipmentsAPI.create` with `packageType`, `weightKg`, `serviceLevel`, `specialNotes`.
- All fields required except notes; zip/metric inputs block `e - + .` keys (lines 62-66).
- ⚠️ `serviceLevel: formData.metricType === 'weight' ? 'Darat' : 'Darat'` (line 39) — both branches are `'Darat'`; the ternary is dead.
- ⚠️ When `metricType === 'qty'` the pcs value is still sent as `weightKg` (line 38). The backend create route accepts a `units` field (`shipments.ts:660,706`) but the modal never sends it — quantities get stored as kilograms.
- Client-created shipments start as `PENDING` (`shipments.ts:680` — only `KEPALA_ARMADA` admins start at `STANDBY`).

## Cross-page couplings
⚠️ **SHARED CONTRACT** — `GET/POST /api/shipments` serve both admin and client apps (`isAdmin` branch in `shipments.ts:100,675`). Client changes need explicit approval per CLAUDE.md (now covered by the 2026-09-25 ClientDashboardPage-rework exception); admin changes must keep these fields: `id`, `packageType`, `originLocation`, `destinationLocation`, `status`, `createdAt`, `serviceLevel`, `weightKg`, `currentProgressPercent`.
- **Status enum drift — FIXED 2026-09-25.** Filter tabs and card status pills now use `shipmentStatus.js`'s `SHIPMENT_STATUS_CONFIG`, covering all 10 `ShipmentStatus` enum values (`schema.prisma:65-76`). Any new enum value added in the future must be added there too, or it falls back to a generic gray pill with the raw enum text (`getStatusConfig`'s fallback) instead of breaking.
- No `AuthContext` usage here; scoping to the logged-in client happens server-side off the session cookie.
- `trackingAPI.getTimeline` is shared with `TrackingSection.jsx` (⚠️ protected shared contract per CLAUDE.md, still mounted by the admin dashboard — see `tracking-shared.md`) — this section only reads it, doesn't touch its route or response shape.

## Gotchas
- Status label differs from Dashboard/History **by design**: `DELIVERED` is "Terkirim" here (`SHIPMENT_STATUS_CONFIG`, matches admin's operational framing), "Selesai" in `HistorySection.jsx`/`ReceiptModal.jsx`/`HistoryTable.jsx` (`HISTORY_STATUS_CONFIG`, same file — fixed 2026-09-25 to be internally consistent within History, but deliberately still different from this page's convention; see `client-history.md`). `DashboardSection.jsx`'s `RecentHistory` mapping wasn't touched in either pass and still has its own separate, narrower status map (same enum-drift bug as this page had, just not fixed there yet).
- Expanded card detail was previously **hardcoded fake log text**, then briefly just the latest checkpoint — as of 2026-09-25 it shows the **full** timeline via `trackingAPI.getTimeline`, lazy-fetched per card on first expand.
- `service` falls back to `'Darat'` when `serviceLevel` is missing.
- The `?status=` server-side filter param on `GET /api/shipments` still exists and works — this page just no longer uses it, filtering client-side instead since it already has the full list in memory for the count badges.
- No client-facing route/page exists for tracking anymore — don't add a `/track` deep-link expecting a standalone view; point it at `shipments` + `highlightId` instead.

## How to add a feature cleanly
1. Read `context.md`/`RUNBOOK.md`; client-dashboard changes are in scope per the 2026-09-25 CLAUDE.md exception — still coordinate with the friend's agent (client-facing side).
2. API calls go through `shipmentsAPI`/`trackingAPI` in `apps/web/src/lib/api.js`; add params to existing fns rather than new fetch code.
3. New filterable status: the enum drift is fixed by editing exactly one place — `shipmentStatus.js`'s `SHIPMENT_STATUS_CONFIG` (label, icon — must exist in `components/Icon.jsx`'s curated set, not the full Material Symbols catalog — and Tailwind pill classes). Both the filter tabs and `ShipmentCard`'s status pill read from it.
4. New create-form field: add to `formData` (modal) and the payload; verify the backend create route destructures it (`shipments.ts:657-672`) — the frontend has previously carried fields the backend dropped silently (see memory: check frontend before backend).
5. Need to jump here and open a specific shipment from elsewhere in the client dashboard? Call `navigateToShipment(id)` (defined in `ClientDashboardPage.jsx`) rather than reintroducing a separate tracking route.
6. Verify: `cd apps/web && npx vite build`; log in at `/client`, check all filter tabs render/count correctly, expand a card to confirm the full real timeline loads (not fake text, not just one checkpoint), and confirm topbar search selecting a shipment lands on Shipments with that card expanded and scrolled into view.
