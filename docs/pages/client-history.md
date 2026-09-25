# Riwayat Pengiriman (client · nav id `history`)
**File:** `apps/web/src/pages/dashboard/HistorySection.jsx` (~165 lines) · shares `apps/web/src/pages/dashboard/shipmentStatus.js`'s `HISTORY_STATUS_CONFIG` with `HistoryTable.jsx` and `ReceiptModal.jsx` (2026-09-25 — was three separate, inconsistent label maps). · **Roles:** clients only — verification enforced at login (`auth.ts:101-110`); no per-page gating.

## What it does
- Shows all *finished* shipments (DELIVERED, FAILED, CANCELLED) in a glass-card table (`HistoryTable`).
- Tabs (`HistoryTabs`): Semua / Selesai / Gagal / Dibatalkan, with count badges; free-text search over id, package description, and destination.
- Computes a duration per row: hours between `createdAt` and `completionDate`.
- "Ekspor Data" exports the currently filtered rows to `riwayat_pengiriman_mpl.xlsx`.
- "Lihat" per row opens `ReceiptModal` — a styled digital receipt showing the **real** handover proof photo (`serahTerimaUrl`) and notes (`handoverNotes`) when the admin recorded one at handover, or an honest "belum ada bukti" empty state when they didn't — fixed 2026-09-25, previously a hardcoded stock photo captioned "Diunggah oleh Kurir" regardless of the real shipment.
- Remounted with `key={refreshKey}` after a shipment is created (`ClientDashboardPage.jsx:187`).

## Data & endpoints
| api.js fn | HTTP route | Purpose |
|---|---|---|
| `shipmentsAPI.list({ status: 'DELIVERED,FAILED,CANCELLED' })` | `GET /api/shipments?status=DELIVERED,FAILED,CANCELLED` | All finished shipments in **one** call (fixed 2026-09-25 — was three parallel requests merged client-side; the comma-separated filter was already supported server-side, `shipments.ts:102-106`, just unused here). |

## Key state & flows
- State: `tab` (`'all'|'delivered'|'failed'|'cancelled'`), `searchQuery`, `activeReceiptId`, `history`, `loading`.
- `displayHistory` map: lowercases status, formats dates in `id-ID`, derives `duration`, and carries `proofUrl`/`handoverNotes` through from `s.serahTerimaUrl`/`s.handoverNotes` (already present on every list row — `LIST_INCLUDE` doesn't restrict scalar fields, no backend change was needed to read them).
- Filtering is fully client-side: tab filter then search filter.
- Receipt flow: `onViewReceipt(id)` sets `activeReceiptId` + toast; `ReceiptModal` renders from the already-loaded row — no extra fetch.
- Download flow: `onDownload` opens `activeReceiptItem.proofUrl` in a new tab (real behavior, fixed 2026-09-25 — previously just showed a fake success toast with no action). `ReceiptModal` disables its download button entirely when there's no `proofUrl`, so `onDownload` is never called without one.

## Cross-page couplings
⚠️ **SHARED CONTRACT** — `GET /api/shipments?status=` is the same route the admin table uses (now covered by the 2026-09-25 ClientDashboardPage-rework CLAUDE.md exception). Load-bearing fields: `id`, `packageType`, `originLocation`, `destinationLocation`, `status`, `createdAt`, `completionDate`, `serahTerimaUrl`, `handoverNotes`.
- `completionDate` is set by admin-side status transitions; if the admin flow stops stamping it, every row shows `-` for "Selesai" and duration (handled defensively).
- `serahTerimaUrl` is a free-text URL an admin types into a plain input at handover (`AdminComponents/ShipmentsSection.jsx`) — not a validated/uploaded file. `ReceiptModal`'s `<img onError>` hides the element if it fails to load rather than showing a broken-image icon, but doesn't otherwise validate the URL.
- Backend comment (`shipments.ts:102-103`) notes the admin UI's "Dibatalkan" tab collapses `CANCELLED` + legacy `FAILED`; **this page's `HISTORY_STATUS_CONFIG` deliberately keeps them separate** ("Gagal" vs "Dibatalkan") — a backend cleanup that merges/removes `FAILED` (marked legacy in `schema.prisma:74`) would empty the "Gagal" tab here.
- `HISTORY_STATUS_CONFIG` (in `shipmentStatus.js`) is intentionally a *different* map from that file's `SHIPMENT_STATUS_CONFIG` used by the Shipments page — same file, two exports, different semantics (History keeps Gagal/Dibatalkan distinct and says "Selesai" for delivered; Shipments merges them to match admin and says "Terkirim"). Don't try to unify these into one map — the distinction is deliberate, not leftover duplication.
- The API rejects unknown `?status=` values with 400 (`shipments.ts:117-120`).
- No `AuthContext` usage; server scopes rows to the logged-in client.

## Gotchas
- **Hardcoded demo rows — REMOVED 2026-09-25.** The page used to inject 4 fake shipments (`MPL-882194`…`MPL-882197`) when the client had zero finished shipments, presenting them as real history including in the Excel export and receipt modal. Now an empty result just shows the honest "Belum ada riwayat pengiriman" empty state.
- No pagination — all finished shipments load at once (backend intentionally returns the full set when no `limit` is passed, `shipments.ts:93-96`).
- Status label differs from Shipments page by design (see Cross-page couplings) — don't "fix" this without re-reading that note.

## How to add a feature cleanly
1. Read `context.md`/`RUNBOOK.md`; client-dashboard changes are in scope per the 2026-09-25 CLAUDE.md exception — still coordinate with the friend's agent (client-facing side).
2. Data changes go through `shipmentsAPI.list` (`api.js`); prefer extending the comma-separated `status` filter over adding another parallel fetch.
3. New terminal status: add it to `shipmentStatus.js`'s `HISTORY_STATUS_CONFIG` (label, icon — must exist in `components/Icon.jsx`'s curated set — and Tailwind pill classes) and to the `status` filter string here. `HistoryTable.jsx` and `ReceiptModal.jsx` both read from it automatically.
4. Don't reintroduce a demo-data fallback for the empty state — if a "seed some demo data for screenshots" need comes up, do it at the database/seed level, not in page code that real clients also see.
5. Verify: `cd apps/web && npx vite build`; check tabs, search, export, and the receipt modal against a client account with real finished shipments (including one with and one without a recorded `serahTerimaUrl`).
