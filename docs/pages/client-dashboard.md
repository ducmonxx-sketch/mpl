# Dashboard / Analitik (client · nav id `dashboard`)
**File:** `apps/web/src/pages/dashboard/DashboardSection.jsx` (~165 lines) · **Roles:** clients only — verification is enforced at login (`apps/api/src/routes/auth.ts:101-110` rejects `PENDING`/`REJECTED` accounts), so every user reaching this page is `VERIFIED`. No per-page gating.

## What it does
- Landing section of the client dashboard (`/client` app, default nav).
- Shows 4 `KPICard` tiles (Total Pengiriman, Dalam Perjalanan, Terkirim, Perlu Perhatian) driven by `shipmentsAPI.getStats(period)`, switchable by period tabs Harian / Bulanan / Tahunan (lines 124-128). `KPICard` (`apps/web/src/components/KPICard.jsx`) is shared with the admin dashboard's Command Center — same visual component, no admin-only logic inside it.
- Shows `ShipmentConditionChart` (`apps/web/src/components/charts/ShipmentConditionChart.jsx`) — a Recharts line/area chart plotting perfect-vs-defective unit counts for the client's own DELIVERED shipments. Also shared with admin (`ReportSection.jsx`); manages its own range (Bulan Ini/3 Bulan/YTD) and category (Unit/Kargo/Container) filters internally. No drill-down (`onPointClick` omitted) — that full-page shipment-list swap stays admin-only.
- Shows "Riwayat Terkini" (`RecentHistory`): the 5 most recent shipments, collapsed to 3 until expanded (line 69).
- "Unduh Laporan" exports the recent shipments to an `.xlsx` via the `xlsx` package (lines 74-99).
- Remounted with `key={refreshKey}` from `ClientDashboardPage` after a shipment is created, forcing a refetch.

## Data & endpoints
| api.js fn | HTTP route | Purpose |
|---|---|---|
| `shipmentsAPI.getStats(period)` | `GET /api/shipments/stats?period=` | Counts: `{ period, total, delivered, transit, failed, pending, cancelled }` scoped to the client (`shipments.ts:278-311`) |
| `shipmentsAPI.list()` | `GET /api/shipments` | Full unpaginated shipment list for the client (recent history only — no longer used for chart aggregation) |
| `shipmentsAPI.getConditionAnalytics(range, category)` | `GET /api/shipments/condition-analytics` | Perfect/defective unit buckets. **Was admin-only**; now `authenticate`-only and scoped by `clientId` for non-admins (`shipments.ts:330-374`), same pattern as `/stats`. |
| `notificationsAPI.list/markRead/markAllRead` | `GET/PATCH /api/notifications*` | Wired in the parent `ClientDashboardPage.jsx`, not this section — see its own notes below. |

## Key state & flows
- State: `activeTab` (`'daily'|'monthly'|'yearly'`, drives KPI cards only), `stats`, `recentShipments`, `isHistoryExpanded`, `loading`, `conditionRange` (`'month'|'quarter'|'ytd'`, drives the condition chart independently of `activeTab`).
- Fetch: `useEffect` on `[activeTab]` runs `getStats` + `list()` in parallel (lines 21-40). `recentShipments` = first 5 of the list (API default order is newest-first).
- `recentHistory` memo (lines 43-67) maps status → Indonesian label/pill class via `statusMap`.
- Refresh: parent `ClientDashboardPage.jsx` renders `<DashboardSection key={refreshKey} />`; `refreshKey` increments after `CreateShipmentModal` succeeds.

## Cross-page couplings
⚠️ **SHARED CONTRACT** — coordinate any change with the admin dashboard (per CLAUDE.md, this page now falls under the 2026-09-25 approved exception for the ClientDashboardPage rework — still coordinate, since these are now literally shared components/routes, not just parallel implementations):
- `KPICard` (`src/components/KPICard.jsx`) and `ShipmentConditionChart` (`src/components/charts/ShipmentConditionChart.jsx`) are the **same components** admin's `OverviewSection.jsx` / `ReportSection.jsx` render — a prop-shape change here is a breaking change there too.
- `GET /api/shipments/condition-analytics` is now reachable by clients (previously `adminOnly`). Any future change to that route must preserve the `clientId` scoping for non-admins or a client could see another client's condition data.
- `GET /api/shipments` and `GET /api/shipments/stats` are shared with the admin app (same routes, `isAdmin` branch in `shipments.ts:100,281`). Removing/renaming `createdAt`, `packageType`, `destinationLocation`, or `status` breaks the recent-history list and export here.
- **Status enum drift (live issue):** the backend enum now has 10 statuses (`schema.prisma:65-76`: adds `STANDBY`, `DITUGASKAN`, `AT_PLANT`, `DITERIMA`, `DITURUNKAN`), but this page's `statusMap`/`iconMap` only know the original 5. Unknown statuses fall back to raw enum text with a `transit` pill.
- `/stats` returns per-status counts for only the original 5 statuses, but `total` counts everything — so the "Dalam Perjalanan" KPI card's percentage-of-total silently undercounts when shipments sit in the newer mid-pipeline statuses.
- No direct `AuthContext` usage in this file (parent supplies auth); relies on the session cookie via `api.js`.

## Gotchas
- Status labels differ from admin: here `DELIVERED` → "Selesai"; `ShipmentsSection` calls the same status "Terkirim".
- "Unduh Laporan" exports only the 5 `recentShipments`, not the full period shown anywhere — the filename claims a full period report.
- Fetch errors are only `console.error`'d — no user-facing error state, page just shows empty data.
- The condition chart's active-dot always renders with a pointer cursor when `unitsPerfect` data exists, even though no `onPointClick` is wired here — a harmless leftover from the shared component's admin drill-down behavior.

## How to add a feature cleanly
1. Read `context.md` + `RUNBOOK.md` first; client-dashboard work is in scope per the 2026-09-25 CLAUDE.md exception, but still coordinate with the friend's agent (client-facing side, high collision risk).
2. New stats data: add the fn to `shipmentsAPI` in `apps/web/src/lib/api.js` following the existing `api.get('/api/shipments/...')` pattern; never fetch directly.
3. Fetch inside the `useEffect` at lines 21-40 (keep the `Promise.all`).
4. New statuses: extend `iconMap`/`statusMap` (lines 44-57) — and mirror the same mapping in `ShipmentsSection.jsx`, `ShipmentCard.jsx`, and `HistorySection.jsx` (they each keep their own copy).
5. Changing `KPICard` or `ShipmentConditionChart`: these are shared with admin — check `AdminComponents/OverviewSection.jsx` / `ReportSection.jsx` for the other call site before changing props.
6. Verify: `cd apps/web && npx vite build`, then log in at `/client` and check KPI cards, chart (both range and category filters), and export. Also spot-check `/admin` Overview + Laporan still render correctly since components are shared.

## Notifications (parent: `ClientDashboardPage.jsx`)
- Real backend wiring as of 2026-09-25: `notificationsAPI.list()` polled every 8s, `markRead`/`markAllRead` call the real endpoints. Previously a hardcoded 3-item mock array.
- The `Notification` model has no `category`/`linkTo`/`linkId` fields — `ClientNotificationPanel.jsx` hides the category badge when absent, and `handleNotifNavigate` no-ops on a missing `linkTo` instead of crashing into `setActiveNav(undefined)`.
- There is no DELETE endpoint for notifications. "Delete" only dismisses locally; `ClientDashboardPage.jsx` tracks dismissed ids in a `dismissedIdsRef` `Set` so they don't reappear on the next 8s poll. If a real delete endpoint is ever added, this workaround should be removed in the same change.
