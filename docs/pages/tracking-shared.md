# Tracking / Pelacakan (admin nav `tracking` only — client nav removed 2026-09-25)
**File:** `apps/web/src/pages/dashboard/TrackingSection.jsx` (739 lines) · **Roles:** all admin roles.

> ⚠️ **Client `tracking` nav removed 2026-09-25.** This component is no longer mounted
> by `ClientDashboardPage.jsx` — the client sidebar's "Pelacakan" item and the
> `tracking` case in its nav switch are gone. The client experience was "compressed"
> into `ShipmentCard.jsx` (`pages/dashboard/components/ShipmentCard.jsx`): expanding a
> card now lazy-fetches the **full** `trackingAPI.getTimeline` checkpoint list inline
> (previously it showed only the latest checkpoint; before that, fake hardcoded text —
> see `client-shipments.md`). The file below still describes the **admin** experience
> (`isAdmin={true}` at `AdminDashboardPage.jsx`) — still a live, shared-contract
> component, just single-mount now. `props.isAdmin`/`userRole` guards below are
> therefore always true/admin in practice, but were left in the component rather than
> stripped, since removing them would be a structural change to a shared file beyond
> what was asked. Do not remove the `isAdmin` branching without confirming the client
> side truly never needs this component mounted again.

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
⚠️ **SHARED CONTRACT** (component-level — only one mount site left as of 2026-09-25):
- Admin: `AdminDashboardPage.jsx:251` → `<TrackingSection initialSearchQuery={trackingId} isAdmin={true} userRole={displayRole} />` — the only mount site now.
- ~~Client: `ClientDashboardPage.jsx:186`~~ — **removed 2026-09-25**. The client no longer mounts this component at all; see the notice at the top of this doc. `ClientDashboardPage.jsx` no longer imports `TrackingSection` or carries a `trackingId`/nav-`tracking`-case for it.
- Everything outside `isAdmin && …` guards (L363, L556, L649) still exists in the code (header, search bar, list, detail panel, timeline, proof photo) but is now only ever seen by admins, since there's no second mount site rendering it with `isAdmin={false}` anymore. Treat changes here as **admin-only impact** going forward — no client regression risk from touching this file.
- `userRole === 'KEPALA_ARMADA'` hides Admin Controls entirely (L556) — role checks are string-compared against `displayRole` from AdminDashboardPage.
- Backend routes still shared: `GET /api/shipments` and `GET /api/tracking/:shipmentId` — the client dashboard reads `GET /api/tracking/:shipmentId` too, but now from `ShipmentCard.jsx`, not from this component. Client ownership enforced server-side (tracking.ts L39). The write routes are `adminOnly`.
- The `trackingId`/"Track Full" pattern this doc used to describe no longer exists on the client side — it was replaced by `highlightShipmentId` + `navigateToShipment` in `ClientDashboardPage.jsx`, which jump to the `shipments` nav and auto-expand a `ShipmentCard` instead of opening this component. Admin's own `trackingId`/"Track Full" wiring to this component is unaffected.

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
1. This component is admin-only in practice now (single mount site) — new features here don't need an `isAdmin` guard purely for client-safety anymore, though the existing guards (L363, L556, L649) still work correctly and don't need to be removed either.
2. New state: add `useState` near L55–70; reset it in the `selectedShipment` effect's else-branch (L101–106) and in `handleCloseDetail` (L344–348) if it's per-shipment.
3. New endpoint call: add to `trackingAPI`/`shipmentsAPI` in `apps/web/src/lib/api.js`; keep `encodeURIComponent` on path params. Backend changes go in `apps/api/src/routes/tracking.ts` — keep `authenticate` on reads, `authenticate, adminOnly` on writes, and the client-ownership check (tracking.ts L39–41) intact, since `GET /:shipmentId` is still hit by the client dashboard from `ShipmentCard.jsx`.
4. If you're tempted to re-add a client mount of this whole component, don't — the client's tracking UI now lives in `ShipmentCard.jsx` (see `client-shipments.md`) and was deliberately compressed there instead of restoring a separate page. Extend that component instead.
5. If you touch timeline data at the API level (`GET /api/tracking/:shipmentId` response shape), check both consumers: this component's normalization (L85–92, handles camel/snake) and `ShipmentCard.jsx`'s plain `data.events` read (expects camelCase only).
6. Verify: `cd apps/api && npm run typecheck`; `cd apps/web && npx vite build`. Then smoke the admin dashboard's Tracking tab (any role incl. KEPALA_ARMADA) and, separately, a client login expanding a shipment card on the Shipments tab.
