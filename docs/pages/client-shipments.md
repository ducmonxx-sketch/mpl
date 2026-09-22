# Daftar Pengiriman (client · nav id `shipments`)
**File:** `apps/web/src/pages/dashboard/ShipmentsSection.jsx` (123 lines) · **Roles:** clients only — verification enforced at login (`auth.ts:101-110`); no per-page gating.

## What it does
- Lists the client's shipments as expandable `ShipmentCard`s, newest first.
- Filter tabs (`ShipmentFilters`) by status: Semua / Dalam Perjalanan / Terkirim / Gagal / Menunggu, with per-status count badges.
- Each card shows route (origin → destination) with a progress bar (`currentProgressPercent`), date, service level, weight; expanding reveals a status blurb and a "Lacak Penuh" button that jumps to the `tracking` nav with the shipment id.
- An in-page "Buat Pengiriman" button exists but is disabled via `{false && ...}` (lines 74-79) — creation is reached through the sidebar button instead (`ClientSidebar.jsx:150-159`), which opens `CreateShipmentModal` (documented below).
- Remounted with `key={refreshKey}` after a create so the new shipment appears.

## Data & endpoints
| api.js fn | HTTP route | Purpose |
|---|---|---|
| `shipmentsAPI.list({ status })` | `GET /api/shipments?status=` | Filtered list for the active tab (lines 21-35) |
| `shipmentsAPI.list()` | `GET /api/shipments` | Unfiltered list, used only for tab count badges (lines 51-60) |
| `shipmentsAPI.create(data)` | `POST /api/shipments` | Create shipment (from `CreateShipmentModal`) |

## Key state & flows
- State: `filter` (`'all'` or UPPERCASE enum), `expandedId`, `shipments`, `allShipments` (badge counts), `loading` (lines 16-19, 51).
- Filter flow: `ShipmentFilters` works in lowercase keys; this section converts to UPPERCASE for the API (`onFilterChange` at line 85) and back to lowercase for display (line 43).
- Create-shipment flow: sidebar "Buat Pengiriman" → `ClientDashboardPage` `setCreateModalOpen(true)` (`ClientDashboardPage.jsx:222`) → `CreateShipmentModal` POST → `onCreated` → `handleShipmentCreated` closes the modal and bumps `refreshKey` (`ClientDashboardPage.jsx:177-180`) → this section remounts and refetches.
- Track flow: `onTrackFull(s.id)` (card line 84) → `navigateToTracking` sets `trackingId` + `activeNav='tracking'`.

### CreateShipmentModal (subsection — entry point of this flow)
**File:** `apps/web/src/components/ClientComponents/CreateShipmentModal.jsx` (167 lines), mounted at `ClientDashboardPage.jsx:258`.
- Single `formData` state (lines 10-21): origin/destination as three fields each (complete address, zip, province), `type` (package spec), `metricType` (`weight`|`qty`), `metricValue`, `notes`.
- On submit (lines 27-57) it joins the address triplets into `originLocation`/`destinationLocation` strings and calls `shipmentsAPI.create` with `packageType`, `weightKg`, `serviceLevel`, `specialNotes`.
- All fields required except notes; zip/metric inputs block `e - + .` keys (lines 62-66).
- ⚠️ `serviceLevel: formData.metricType === 'weight' ? 'Darat' : 'Darat'` (line 39) — both branches are `'Darat'`; the ternary is dead.
- ⚠️ When `metricType === 'qty'` the pcs value is still sent as `weightKg` (line 38). The backend create route accepts a `units` field (`shipments.ts:660,706`) but the modal never sends it — quantities get stored as kilograms.
- Client-created shipments start as `PENDING` (`shipments.ts:680` — only `KEPALA_ARMADA` admins start at `STANDBY`).

## Cross-page couplings
⚠️ **SHARED CONTRACT** — `GET/POST /api/shipments` serve both admin and client apps (`isAdmin` branch in `shipments.ts:100,675`). Client changes need explicit approval per CLAUDE.md; admin changes must keep these fields: `id`, `packageType`, `originLocation`, `destinationLocation`, `status`, `createdAt`, `serviceLevel`, `weightKg`, `currentProgressPercent`.
- **Status enum drift (live issue):** filter tabs and `STATUS_MAP` (lines 7-13, `ShipmentCard.jsx:3-16`) only know `PENDING/TRANSIT/DELIVERED/FAILED/CANCELLED`. Shipments the admin pipeline moves into `STANDBY`, `DITUGASKAN`, `AT_PLANT`, `DITERIMA`, `DITURUNKAN` (`schema.prisma:65-76`) appear under "Semua" with an **empty status pill** — `STATUS_MAP[s.status]` is `undefined` in `ShipmentCard.jsx:34` — and are invisible to every filter tab.
- Server rejects unknown `?status=` values with 400 (`shipments.ts:117-120`) — adding a client tab for a status the enum doesn't have breaks the list fetch.
- No `AuthContext` usage here; scoping to the logged-in client happens server-side off the session cookie.

## Gotchas
- Status label differs from Dashboard/History: `DELIVERED` is "Terkirim" here, "Selesai" there.
- Expanded card detail (`ShipmentCard.jsx:80-83`) is **hardcoded fake log text** ("Penerima: Bpk. Rudi (Security)", "checkpoint 2") keyed only off status — not real tracking data.
- Double fetch on mount: filtered list + full list for badges (lines 21-35 vs 51-60); badge counts don't refresh when the filter changes.
- `service` falls back to `'Darat'` when `serviceLevel` is missing (line 45).
- The badge-count fetch swallows errors silently (line 57).

## How to add a feature cleanly
1. Read `context.md`/`RUNBOOK.md`; **client changes require explicit approval** (CLAUDE.md admin-only scope) — coordinate before touching `POST /api/shipments` payloads.
2. API calls go through `shipmentsAPI` in `apps/web/src/lib/api.js:270-341`; add params to `list(params)` rather than new fetch code.
3. New filterable status: add to `STATUS_MAP` (lines 7-13), the `statusMap` prop (line 86), `ShipmentCard.jsx:3-16` — and confirm the enum value exists in `schema.prisma:65-76` or the API returns 400.
4. New create-form field: add to `formData` (modal lines 10-21) and the payload (lines 36-43); verify the backend create route destructures it (`shipments.ts:657-672`) — the frontend has previously carried fields the backend dropped silently (see memory: check frontend before backend).
5. Verify: `cd apps/web && npx vite build`; create a shipment at `/client` and confirm it appears after the modal closes (refreshKey remount).
