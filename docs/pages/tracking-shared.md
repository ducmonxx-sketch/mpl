# Tracking / Pelacakan (SHARED: admin nav `tracking` + client nav `tracking`)
**File:** `apps/web/src/pages/dashboard/TrackingSection.jsx` (739 lines) · **Roles:** all admin roles + clients; behavior differences via isAdmin/userRole props

## What it does
- Lists all shipments the caller can see (`shipmentsAPI.list()`), mapped into display shape with Indonesian status labels (`statusDisplayMap`, L12–18) and formatted ETA (L116–125).
- Client-side search over shipment id / package type (L323–331) via `TrackingSearchBar` (L384); optional `initialSearchQuery` auto-selects the first matching shipment (L155–163).
- Slide-over detail panel (portal to `document.body`, L415–646) with info grid, notes, proof-of-delivery photo, and a checkpoint timeline ("Riwayat Perjalanan", L487–539) fetched per-shipment from `trackingAPI.getTimeline`.
- Admin-only: status filter tabs with counts (L363–381), status dropdown, ETA picker + save, "Tambah Checkpoint" modal, and DELIVERED flow with compressed proof-photo upload (L555–640).
- Auto-refreshes the shipment list every 8 seconds via silent polling (L171–175).
- Animates the detail panel open with a dynamic `animejs` import (L177–190).

## Data & endpoints
| api.js fn (line) | HTTP route | Purpose |
|---|---|---|
| `shipmentsAPI.list()` (api.js L272) | `GET /api/shipments` | Shipment list; backend scopes clients to their own rows |
| `shipmentsAPI.updateStatus(id, data)` (api.js L318) | `PATCH /api/shipments/:id/status` | Admin: change status, ETA (`estimatedArrival`), progress %, `proofPhoto` (base64) |
| `trackingAPI.getTimeline(shipmentId)` (api.js L346) | `GET /api/tracking/:shipmentId` | Timeline; returns `{ shipment, events }` (tracking.ts L48); client-ownership check at tracking.ts L39–41 |
| `trackingAPI.addEvent(shipmentId, data)` (api.js L350) | `POST /api/tracking/:shipmentId/events` | Admin adds checkpoint; recalculates `currentProgressPercent` from DONE/total (tracking.ts L74–89), writes audit log + client notification |
| `trackingAPI.updateEvent(eventId, data)` (api.js L354) | `PATCH /api/tracking/events/:eventId` | Admin updates checkpoint status/notes; **no UI calls this yet** |

Proof photos are base64 data-URIs stored on the shipment (`proofPhoto`), compressed client-side by `compressImage(file, 2)` (L242) — no signed URLs involved.

## Key state & flows
- `searchQuery` (L55, seeded from `initialSearchQuery`), `shipments` (L56, mapped list), `selectedShipment` (L57, drives the panel), `statusFilter` (L59, admin tabs), `loading` / `timelineLoading`.
- Admin edit state: `tempStatus` (L64), `tempEta` (L67), `photoPreview` (L65), `compressing` (L66), `updatingStatus` (L62), `addEventForm` + `showAddEventModal` (L60–61).
- Timeline: `useEffect` on `selectedShipment` (L72–107) fetches `getTimeline`, normalizes camel/snake fields (L85–92), renders dots colored by event `status` (`DONE` green / `ACTIVE` amber / else gray, L501–516).
- Status change: dropdown → `handleStatusSelectChange` (L212) saves immediately unless `DELIVERED`; `DELIVERED` reveals the photo block (L607–638) and saves via `handleSaveDeliveredStatus` (L253) with `currentProgressPercent: 100`.
- ETA: `tempEta` is a `datetime-local`-style string (`rawEstimatedArrival`, L138); `handleUpdateEta` (L282) re-sends the *current* status alongside the new ISO `estimatedArrival`.
- Checkpoint add: `handleAddEvent` (L302) posts the form, defaults `eventTimestamp` to now if empty (L308).

## Cross-page couplings
⚠️ **SHARED CONTRACT** — this one component is mounted by both dashboards:
- Admin: `AdminDashboardPage.jsx:251` → `<TrackingSection initialSearchQuery={trackingId} isAdmin={true} userRole={displayRole} />`
- Client: `ClientDashboardPage.jsx:186` → `<TrackingSection initialSearchQuery={trackingId} />` (so `isAdmin=false`, `userRole=undefined`)
- Everything outside `isAdmin && …` guards (L363, L556, L649) is client-visible: header, search bar, list, detail panel, timeline, proof photo. Changing the mapping in `fetchShipments` (L109–169), the timeline rendering, `statusDisplayMap`, or the props signature (L52) changes the client experience too.
- `userRole === 'KEPALA_ARMADA'` hides Admin Controls entirely (L556) — role checks are string-compared against `displayRole` from AdminDashboardPage.
- Backend routes shared by both: `GET /api/shipments` and `GET /api/tracking/:shipmentId` (client ownership enforced server-side, tracking.ts L39). The write routes are `adminOnly`.
- Also shared upstream: `trackingId` state in each dashboard page routes other sections ("Track Full") into this component via `initialSearchQuery`.

## Gotchas
- **Status label collision:** `STATUS_OPTIONS` labels both `FAILED` and `CANCELLED` as "Dibatalkan" (L26–27), while `statusDisplayMap` shows `FAILED` as "Gagal" (L16). The admin `FILTER_TABS` `FAILED` tab is also labeled "Dibatalkan" (L35) and there is no CANCELLED tab.
- **Polling re-selects:** the 8s poll re-runs `fetchShipments`, and when `initialSearchQuery` is set the auto-select at L155–163 fires on *every* poll — it re-opens a closed panel, resets `tempStatus`/`tempEta`, refetches the timeline, and replays the panel animation every 8 seconds.
- Timeline is NOT refreshed after adding a checkpoint — `handleAddEvent` (L313) refetches shipments only; the new event appears after deselect/reselect.
- Non-DELIVERED status saves send `proofPhoto: null` (L220), wiping any existing proof photo on the shipment.
- `getTimeline` response is defensively unwrapped (`tRes?.data || tRes?.events`, L83); the real backend shape is `{ shipment, events }` — the extra `shipment` payload is ignored.
- Timeline fetch errors are silently swallowed (`catch { setTimelineData([]) }`, L94–95) — shows as "Belum ada riwayat perjalanan".
- `handleUpdateStatus` (L194–210) is dead code — nothing in the JSX calls it (the select uses `handleStatusSelectChange`).
- Backend event PATCH writes no audit log (unlike POST) and 500s (not 404s) on unknown `eventId` (tracking.ts L128–157).

## How to add a feature cleanly
1. Decide audience first. **Admin-only features must be gated behind `isAdmin` (and `userRole` if role-specific) without changing client-visible behavior** — follow the existing guards at L363 (tabs), L556 (controls), L649 (modal).
2. New state: add `useState` near L55–70; reset it in the `selectedShipment` effect's else-branch (L101–106) and in `handleCloseDetail` (L344–348) if it's per-shipment.
3. New endpoint call: add to `trackingAPI`/`shipmentsAPI` in `apps/web/src/lib/api.js` (L343–356 / L270–341); keep `encodeURIComponent` on path params. Backend changes go in `apps/api/src/routes/tracking.ts` — keep `authenticate` on reads, `authenticate, adminOnly` on writes, and the client-ownership check (tracking.ts L39–41) intact.
4. Don't change the props signature (L52) or the shipment mapping keys (L127–150) without checking BOTH mount sites (`AdminDashboardPage.jsx:251`, `ClientDashboardPage.jsx:186`) and anything feeding `initialSearchQuery`.
5. If you touch timeline data, preserve the camel/snake normalization (L85–92) — events historically arrive in both shapes.
6. Verify: `cd apps/api && npm run typecheck`; `cd apps/web && npx vite build`. Then smoke both dashboards: admin (any role incl. KEPALA_ARMADA) and a client login on the same shipment.
