# Laporan (admin · nav id `laporan`)
**File:** `apps/web/src/pages/AdminComponents/ReportSection.jsx` (43 lines) — thin shell over `components/ShipmentConditionChart.jsx` (169), `components/ServiceLineSummary.jsx` (232), `components/ConditionDetailPage.jsx` (159). · **Roles:** SUPERADMIN/OPERATIONS/SUPPORT. Pipeline roles (KEPALA_ARMADA/PIC_PABRIK/PIC_GUDANG) never see it: the sidebar hides `laporan` for them (`AdminSidebar.jsx` L57–62) AND `AdminDashboardPage.jsx` L241–244 re-routes `laporan` to `OverviewSection` for those roles (defense in depth). No per-role differences inside the section itself.

## What it does
- Condition/success analytics for the shipment pipeline, split out of Beranda (header comment, ReportSection L6–14).
- "Kondisi Unit Terkirim" line chart: perfect vs. defective unit counts for DELIVERED shipments bucketed by `completionDate` — daily buckets for month/quarter, monthly for YTD (shipments.ts L313–334).
- Range toggle (Bulan Ini / 3 Bulan / YTD) shared by both cards; category toggle (Semua/Unit/Kargo/Container) local to the chart (ShipmentConditionChart L52–65).
- Click any chart dot → full-page drill-down (`ConditionDetailPage`) that REPLACES the two cards (not a modal), listing the shipments behind that point with expandable unit-by-unit condition rows.
- "Distribusi Layanan" summary: overall perfect-rate % + each service line's share of shipped units, with a branded single-page PDF export (jsPDF + autotable + rasterized chart snapshot).

## Data & endpoints
| api.js fn | HTTP route | Purpose |
|---|---|---|
| `shipmentsAPI.getConditionAnalytics(range, category)` | `GET /api/shipments/condition-analytics` | chart buckets (ShipmentConditionChart L81); called 3× in parallel, once per category, by ServiceLineSummary L71 |
| `shipmentsAPI.getConditionDetail(period, category)` | `GET /api/shipments/condition-analytics/detail` | drill-down shipment list (ConditionDetailPage L27) |

Both endpoints are `authenticate, adminOnly` (shipments.ts L319, L397). Detail validates `period` against `/^\d{4}-\d{2}(-\d{2})?$/` → 400 otherwise (L400–402) and caps at 200 rows (`take: 200`, L427) while returning the true `total`.

## Key state & flows
- ReportSection: `range` (`'month'|'quarter'|'ytd'`, L16), `drillDown` (`{ period, label, category } | null`, L17), `chartRef` (L18) — owned here because the summary card's PDF export snapshots the sibling chart's SVG.
- `drillDown` set by chart dot click (`onPointClick={setDrillDown}`, L37) → renders `ConditionDetailPage` (L27–34); "Kembali ke Laporan" clears it (`onBack`, L32).
- Chart: `category`, `buckets`, `loading` (ShipmentConditionChart L72–74). Dense mode (`buckets.length > 15`, L95) thins x-ticks and hides static dots; `makeActiveDot` (L38–50) keeps points clickable via a 14px transparent hit circle; future (null-value) points are non-clickable. Backend sends `null` (not 0) for future days so the line doesn't crash to the floor (shipments.ts L364–376).
- Custom tooltip dedupes the Area+Line shared `unitsPerfect` dataKey (L14–30).
- Summary: `totals` per category, `perfectRate`, `shares` (ServiceLineSummary L64, L89–98). PDF flow (L103–173): lazy-import jspdf/jspdf-autotable, rasterize `/mpl_logo_proto.svg` + the live chart SVG (`svgToPngDataUrl`, 2x scale, L22–43), letterhead + hero % + chart image + category table, saved as `Laporan-Kondisi-<range>-<date>.pdf`.
- Detail page: `data/loading/error` (ConditionDetailPage L19–21); row ID click toggles AdminDataTable's built-in `expandableContent` showing `row.units` (tipeMotor/noRangka/arrivedDefective/arrivalNote, L115–148); footer note when `data.total > shipments.length` (L150–154).

## Cross-page couplings
- `onNavigateToShipment` threads AdminDashboardPage → ReportSection → ConditionDetailPage (L142): jumps to the real record in Pengiriman via `shipmentHighlightId` — same mechanism Overview uses.
- Data source: `plantCheck.lku[].arrivedDefective` — the arrival-condition flag ticked at handover (shipments.ts L344, L977 comment). Changing the plant-check/LKU schema breaks both endpoints.
- `shippingCategory` vocabulary (`'Unit'|'Cargo'|'Container'`) is shared with ShipmentsSection.jsx (ShipmentConditionChart L58–65); labels are Indonesian, values stay English.
- SVG→PNG rasterization technique is duplicated from ShipmentsSection's Surat Jalan generator (ServiceLineSummary L21).

## Gotchas
- The chart's category filter does NOT affect ServiceLineSummary — its totals/% always cover all 3 categories. The PDF snapshots the live chart, so exporting while the chart is filtered to one category produces a PDF whose chart image and table describe different populations.
- `null` future buckets: any new consumer summing `unitsPerfect` must `|| 0` them (chart already does, L88–89).
- Only DELIVERED shipments with a `completionDate` count; shipments without plant-check units contribute 0 to both series but still appear in the drill-down list.
- Drill-down `category` is frozen from the chart at click time (ShipmentConditionChart L76) — changing the chart filter afterwards doesn't retro-affect an open detail page.
- ServiceLineSummary hardcodes `#2a78d6/#eb6834/#1baf7a` as category identity colors, deliberately distinct from the chart's status colors CHART_GOLD/CHART_RED (L7–14 comment) — don't reuse gold/red for categories.

## How to add a feature cleanly
- [ ] New report card: add it under the fragment in ReportSection L36–39; take `range` as a prop so all cards describe the same period; keep per-card filters local (chart's `category` pattern).
- [ ] New analytics endpoint: follow shipments.ts L313–390 (authenticate + adminOnly, bucket loop with null-for-future); add the api.js fn next to `getConditionAnalytics`/`getConditionDetail` (api.js L279–285).
- [ ] New drill-down column: extend `columns` in ConditionDetailPage L38–75 and select the field in the detail endpoint (shipments.ts L429–436).
- [ ] Extending the PDF: it must stay single-page A4; the table starts at dynamic `y` after the chart image (ServiceLineSummary L153).
- [ ] Do NOT break: the `laporan` pipeline-role fall-through in AdminDashboardPage L241–244, the `period` regex contract of `/detail`, or `chartRef` ownership in ReportSection (siblings depend on it).
- [ ] Verify: `cd apps/api && npm run typecheck` then `cd apps/web && npx vite build`.
