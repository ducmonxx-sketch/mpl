# Riwayat Pengiriman (client · nav id `history`)
**File:** `apps/web/src/pages/dashboard/HistorySection.jsx` (207 lines) · **Roles:** clients only — verification enforced at login (`auth.ts:101-110`); no per-page gating.

## What it does
- Shows all *finished* shipments (DELIVERED, FAILED, CANCELLED) in a glass-card table (`HistoryTable`).
- Tabs (`HistoryTabs`): Semua / Selesai / Gagal / Dibatalkan, with count badges; free-text search over id, package description, and destination (lines 112-117).
- Computes a duration per row: hours between `createdAt` and `completionDate` (lines 92-96).
- "Ekspor Data" exports the currently filtered rows to `riwayat_pengiriman_mpl.xlsx` (lines 119-138).
- "Lihat" per row opens `ReceiptModal` — a styled digital receipt with a proof-of-delivery image and a "download PDF" button.
- Remounted with `key={refreshKey}` after a shipment is created (`ClientDashboardPage.jsx:187`).

## Data & endpoints
| api.js fn | HTTP route | Purpose |
|---|---|---|
| `shipmentsAPI.list({ status: 'DELIVERED' })` | `GET /api/shipments?status=DELIVERED` | Delivered shipments (line 28) |
| `shipmentsAPI.list({ status: 'FAILED' })` | `GET /api/shipments?status=FAILED` | Failed shipments (line 29) |
| `shipmentsAPI.list({ status: 'CANCELLED' })` | `GET /api/shipments?status=CANCELLED` | Cancelled shipments (line 30) |

(Three parallel calls merged and re-sorted by `createdAt` desc, lines 27-37. The API also supports comma-separated `?status=A,B,C` — `shipments.ts:102-106` — so this could be one call.)

## Key state & flows
- State: `tab` (`'all'|'delivered'|'failed'|'cancelled'`), `searchQuery`, `activeReceiptId`, `history`, `loading` (lines 15-19).
- `displayHistory` map (lines 91-110): lowercases status, formats dates in `id-ID`, derives `duration`.
- Filtering is fully client-side: tab filter (line 112) then search filter (lines 113-117).
- Receipt flow: `onViewReceipt(id)` sets `activeReceiptId` + toast (line 192); `ReceiptModal` renders from the already-loaded row (line 140) — no extra fetch.

## Cross-page couplings
⚠️ **SHARED CONTRACT** — `GET /api/shipments?status=` is the same route the admin table uses. Client changes need explicit approval per CLAUDE.md. Load-bearing fields: `id`, `packageType`, `originLocation`, `destinationLocation`, `status`, `createdAt`, `completionDate`.
- `completionDate` is set by admin-side status transitions; if the admin flow stops stamping it, every row shows `-` for "Selesai" and duration (lines 93-96 handle null defensively).
- Backend comment (`shipments.ts:102-103`) notes the admin UI's "Dibatalkan" tab collapses `CANCELLED` + legacy `FAILED`; **this page keeps them separate** ("Gagal" vs "Dibatalkan") — a backend cleanup that merges/removes `FAILED` (marked legacy in `schema.prisma:74`) would empty the "Gagal" tab here.
- The API rejects unknown `?status=` values with 400 (`shipments.ts:117-120`).
- No `AuthContext` usage; server scopes rows to the logged-in client.

## Gotchas
- **Hardcoded demo rows:** if the client has zero finished shipments, the page injects 4 fake shipments (`MPL-882194`…`MPL-882197`, lines 39-78) and presents them as real history — including in the Excel export and receipt modal.
- **Fake proof of delivery:** `ReceiptModal.jsx:14` hardcodes an Unsplash photo as "Bukti Pengiriman", and its download button doesn't download anything — `onDownload` at `HistorySection.jsx:202` only shows a success toast ("Manifes PDF berhasil diunduh.").
- Inconsistent labels for `DELIVERED` across three duplicate maps: table rows say "Selesai" (`HistoryTable.jsx:6`), the Excel export says "Terkirim" (`HistorySection.jsx:11`, used line 126), and the receipt modal says "Terkirim" (`ReceiptModal.jsx:5`) — while the shipments page also uses "Terkirim".
- No pagination — all finished shipments load at once (backend intentionally returns the full set when no `limit` is passed, `shipments.ts:93-96`).

## How to add a feature cleanly
1. Read `context.md`/`RUNBOOK.md`; **client changes require explicit approval** (CLAUDE.md admin-only scope).
2. Data changes go through `shipmentsAPI.list` (`api.js:272-273`); prefer one comma-separated `status` call over adding a fourth parallel fetch (lines 27-31).
3. New terminal status: add it to `TABS`/`STATUS_LABEL` (lines 10-11) **and** the duplicate maps in `HistoryTable.jsx:5-7` and `ReceiptModal.jsx:5-6`, plus the fetch list (lines 27-31).
4. Before shipping a real receipt/PDF feature, delete the demo-row fallback (lines 39-78) and the mock image (`ReceiptModal.jsx:14`) — they mask missing data.
5. Verify: `cd apps/web && npx vite build`; check tabs, search, export, and the receipt modal against a client account with real finished shipments.
