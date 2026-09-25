# Beranda / Command Center (admin · nav id `overview`)
**File:** `apps/web/src/pages/AdminComponents/OverviewSection.jsx` (439 lines) · **Roles:** all admin roles. SUPERADMIN gets a 70/30 layout with the "Log Aktivitas" right pane (L302–303, L334); everyone else gets full-width left pane only. KPI gating: "Total Klien" hidden from KEPALA_ARMADA/PIC_PABRIK/PIC_GUDANG (L309), "Driver Tersedia" hidden from PIC_PABRIK/PIC_GUDANG (L312).

## What it does
- Landing section of the admin dashboard: KPI cards + "Pengiriman Terbaru" table (last 5 shipments) + SUPERADMIN-only audit-log activity feed.
- KPIs: Pengiriman Aktif (= `stats.active` — fixed 2026-09-22, was `stats.transit`), Total Pengiriman, Total Klien, Driver Tersedia — each card navigates to its section on click.
- Recent-shipments table: 5 newest shipments, clickable ID jumps into the record in Pengiriman (L253–262).
- Activity feed (SUPERADMIN): reads `AdminAuditLog` via `GET /api/audit-logs`, split into role-group tabs — Operasional (OPERATIONS,SUPPORT), Pipeline (KEPALA_ARMADA,PIC_PABRIK,PIC_GUDANG), Super Admin (L23–27).
- Localizes English audit summaries to Indonesian via full-line regex rules (`SUMMARY_RULES`, L86–112) + a status-change parser handling `(reversal|override by ROLE)` suffixes (L118–127). Unrecognized summaries fall through raw — nothing is hidden (L114–131).
- Maps `actionType` to timeline icon/colors (`ACTIVITY_VISUALS`, L36–43; order matters: specific before generic UPDATE_/ASSIGN_).

## Data & endpoints
| api.js fn | HTTP route | Purpose |
|---|---|---|
| `shipmentsAPI.list()` | `GET /api/shipments` | recent-5 table + unassigned-driver calc (L190, L221–229) |
| `shipmentsAPI.getStats('monthly')` | `GET /api/shipments/stats?period=monthly` | KPI counts (pending/total/**active**) — `active` added 2026-09-22, unwindowed count of every in-flight status |
| `usersAPI.listAll()` | `GET /api/users` | Total Klien count (L216) |
| `fleetAPI.getDrivers()` | `GET /api/fleet/drivers` | Driver Tersedia + unassigned count (L217) |
| `auditLogsAPI.list({ role, limit, offset, adminId? })` | `GET /api/audit-logs` | activity feed (SUPERADMIN, L155–160) |
| `adminsAPI.list()` | `GET /api/admins` | admin-filter dropdown options (L181) |

## Key state & flows
- `recentShipments`, `kpiData` `{activeShipments,totalClients,availableDrivers,unassignedDrivers,pending,total}`, `loading` (L138–140).
- Feed state: `activities`, `activityLoading`, `activityTotal`, `adminOptions`, `filterAdminId`, `roleTab` (L143–148); `ACTIVITY_LIMIT = 12` (L9).
- KPI onClick targets: Pengiriman Aktif → `onChangeNav('shipments')` (L307), Total Pengiriman → `shipments` (L308), Total Klien → `clients` (L310), Driver Tersedia → `drivers` (L313). "Lihat Semua" button → `shipments` (L323).
- Feed load: `loadActivities({append})` — offset is `activities.length` when appending (L153); reload-from-top effect on `isSuperAdmin | filterAdminId | roleTab` (L172–175, exhaustive-deps disabled). Tab switch resets `filterAdminId` (L358). "Muat Lebih Banyak" shows while `activities.length < activityTotal` (L284, L423–431).
- Dropdown is populated with ALL admins once, then narrowed client-side to the active tab's roles at render (L376–380).
- Unassigned drivers = all `ACTIVE` drivers (fixed 2026-09-22 — was `status === 'ACTIVE'` drivers not on a PENDING/TRANSIT shipment, a stale shipment-scan that predated the 10-status pipeline). Now identical to Driver Tersedia's computation — both are fleet-derived, no shipment scan.

## Cross-page couplings
- Props from `AdminDashboardPage.jsx` L240: `onChangeNav` (= `handleNavChange`, L216–221), `onNavigateToShipment` (= `navigateToShipment`, sets `shipmentHighlightId` + nav `shipments`, L228–231), `userRole` (= `user?.role || 'Super Admin'`, L257).
- Also rendered for nav id `laporan` when the role is pipeline (KEPALA_ARMADA/PIC_PABRIK/PIC_GUDANG) — see `AdminDashboardPage.jsx` L241–244 — and as the `default` fall-through (L252, without `userRole`).
- Audit-log producers: every admin write route logs to `AdminAuditLog` (drivers/vehicles/clients/users/invoices/shipments/admins — see `SUMMARY_RULES` L86–112 for the full template list). Changing a `changesSummary` template server-side silently breaks its Indonesian translation here (falls back to English).
- `GET /api/shipments/stats` is shared with the client dashboard (`apps/api/src/routes/shipments.ts` L275–311, `authenticate` only; clients get rows scoped to `clientId`).

## Gotchas
- Feed panel is gated by `user?.role === 'SUPERADMIN'` from AuthContext, NOT by the `userRole` prop; backend enforces via `requirePermission("admin:manage")`.
- **"Pengiriman Aktif" and "menunggu" KPI drift — FIXED 2026-09-22.** Both used to under-count against the 10-status pipeline (see history above). `stats.active` is an ADDITIVE field on `/stats` — every OTHER field on that route (`total`/`delivered`/`transit`/`failed`/`pending`/`cancelled`) still windows on `createdAt` per `period`, unchanged, because the client dashboard also reads this route and its existing fields must not shift shape.
- Dead `useEffect` (empty body on `[loading]`) — still open, package-8 territory.
- api.js JSDoc for `auditLogsAPI.list` documents `scope` (L434) but this page sends `role`; backend accepts both, `role` takes precedence (`auditLogs.ts` L31–48).
- Users/drivers fetch failure is swallowed as "non-critical" (L237): those KPIs silently show 0.

## How to add a feature cleanly
- [ ] New KPI card: add to the grid L306–315, follow existing `KPICard` props (icon/label/value/onClick), gate by `userRole` array-includes like L309/L312. **`KPICard` moved to `src/components/KPICard.jsx` (2026-09-25)** — it's shared with the client dashboard's `DashboardSection.jsx` now, so a prop-shape change here affects both.
- [ ] New feed action type: add the icon rule to `ACTIVITY_VISUALS` (L36–43, specific before generic) AND the translation to `SUMMARY_RULES` (L86–112) matching the backend template verbatim.
- [ ] New endpoint: add the fn to the right block of `apps/web/src/lib/api.js` (auditLogsAPI L433–437, adminsAPI L440–452 pattern: JSDoc + thin `api.get/post` wrapper).
- [ ] New role tab: extend `ROLE_TABS`/`ROLE_TAB_SUBTITLE` (L23–32); roles string is passed straight to `?role=` (comma-separated, validated against `admin.role` in Prisma).
- [ ] Do NOT break: `onChangeNav`/`onNavigateToShipment` prop contracts (AdminDashboardPage owns nav state), the `scope=normal` behavior of `/api/audit-logs` (deferred Profil-page log depends on it), or `/api/shipments/stats` (shared with client dashboard).
- [ ] Verify: `cd apps/api && npm run typecheck` then `cd apps/web && npx vite build`.
