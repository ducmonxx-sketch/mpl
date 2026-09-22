# Dashboard / Analitik (client · nav id `dashboard`)
**File:** `apps/web/src/pages/dashboard/DashboardSection.jsx` (222 lines) · **Roles:** clients only — verification is enforced at login (`apps/api/src/routes/auth.ts:101-110` rejects `PENDING`/`REJECTED` accounts), so every user reaching this page is `VERIFIED`. No per-page gating.

## What it does
- Landing section of the client dashboard (`/client` app, default nav).
- Shows a shipment-volume line chart (`ShipmentChart`) aggregated client-side from the full shipment list, switchable by period tabs Harian / Bulanan / Tahunan (lines 185-189).
- Shows three status cards (`StatusCards`): in-transit count + % of total, delivered count (animated), failed count.
- Shows "Riwayat Terkini" (`RecentHistory`): the 5 most recent shipments, collapsed to 3 until expanded (line 123).
- "Unduh Laporan" exports the recent shipments to an `.xlsx` via the `xlsx` package (lines 135-160).
- Remounted with `key={refreshKey}` from `ClientDashboardPage` after a shipment is created, forcing a refetch.

## Data & endpoints
| api.js fn | HTTP route | Purpose |
|---|---|---|
| `shipmentsAPI.getStats(period)` | `GET /api/shipments/stats?period=` | Counts: `{ period, total, delivered, transit, failed, pending, cancelled }` scoped to the client (`shipments.ts:278-311`) |
| `shipmentsAPI.list()` | `GET /api/shipments` | Full unpaginated shipment list for the client (chart aggregation + recent history) |

## Key state & flows
- State: `activeTab` (`'daily'|'monthly'|'yearly'`), `stats`, `allShipments`, `recentShipments`, `isHistoryExpanded`, `loading` (lines 12-17).
- Fetch: `useEffect` on `[activeTab]` runs `getStats` + `list()` in parallel (lines 20-40). `recentShipments` = first 5 of the list (API default order is newest-first).
- `chart` memo (lines 43-94) buckets `allShipments` by `createdAt` into period labels; metric text = `stats.total`, change text = "`X` terkirim, `Y` transit".
- `recentHistory` memo (lines 97-121) maps status → Indonesian label/pill class via `statusMap` (lines 105-111).
- Refresh: parent `ClientDashboardPage.jsx:184` renders `<DashboardSection key={refreshKey} />`; `refreshKey` increments after `CreateShipmentModal` succeeds (`ClientDashboardPage.jsx:177-180`).

## Cross-page couplings
⚠️ **SHARED CONTRACT** — coordinate any change with the admin dashboard (per CLAUDE.md, client side needs explicit approval; conversely admin work must not break these):
- `GET /api/shipments` and `GET /api/shipments/stats` are shared with the admin app (same routes, `isAdmin` branch in `shipments.ts:100,281`). Removing/renaming `createdAt`, `packageType`, `destinationLocation`, or `status` breaks chart, table, and export here.
- **Status enum drift (live issue):** the backend enum now has 10 statuses (`schema.prisma:65-76`: adds `STANDBY`, `DITUGASKAN`, `AT_PLANT`, `DITERIMA`, `DITURUNKAN`), but this page's `statusMap`/`iconMap` (lines 98-111) only know the original 5. Unknown statuses fall back to raw enum text (line 117) with a `transit` pill.
- `/stats` returns per-status counts for only the original 5 statuses, but `total` counts everything — so `StatusCards` percentages (e.g. transit/total at `StatusCards.jsx:37`) silently undercount when shipments sit in the newer mid-pipeline statuses.
- No direct `AuthContext` usage in this file (parent supplies auth); relies on the session cookie via `api.js`.

## Gotchas
- Status labels differ from admin: here `DELIVERED` → "Selesai" (line 108); `ShipmentsSection` calls the same status "Terkirim".
- A `weekly` chart branch exists (lines 48, 72-78) but there is no "Mingguan" tab (lines 185-189) — dead code.
- "Unduh Laporan" exports only the 5 `recentShipments` (line 139), not the full period shown in the chart — the filename claims a full period report.
- Fetch errors are only `console.error`'d (line 34) — no user-facing error state, page just shows empty data.

## How to add a feature cleanly
1. Read `context.md` + `RUNBOOK.md` first; **client-side changes need explicit approval** (CLAUDE.md scope is admin-only — flag client work for follow-up/coordination).
2. New data: add the fn to `shipmentsAPI` in `apps/web/src/lib/api.js` (block at lines 270-341) following the existing `api.get('/api/shipments/...')` pattern; never fetch directly.
3. Fetch inside the `useEffect` at lines 20-40 (keep the `Promise.all`), derive display data in a `useMemo` like lines 43-94.
4. New statuses: extend `iconMap`/`statusMap` (lines 98-111) — and mirror the same mapping in `ShipmentsSection.jsx`, `ShipmentCard.jsx`, and `HistorySection.jsx` (they each keep their own copy).
5. Verify: `cd apps/web && npx vite build`, then log in at `/client` and check chart, cards, and export.
