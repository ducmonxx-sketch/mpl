# RBAC Plan (#10) — roles, status state machine, audit

Design for super-admin vs admin. Referenced from [DEV-PLAN.md](DEV-PLAN.md).
Last updated: 2026-06-28.

## Roles
Schema `AdminRole`: `SUPERADMIN | OPERATIONS | SUPPORT`. For now **SUPERADMIN = "super-admin"**;
**OPERATIONS + SUPPORT = "regular admin"** (same rights). Can differentiate later.

## Permission model
`requirePermission(perm)` middleware over a single `ROLE_PERMISSIONS` matrix in
[`lib/rbac.ts`](apps/api/src/lib/rbac.ts). Permissions are **capabilities, not roles**, so the
whole policy lives in one place and new gates (including page-level) slot in without rework.

Current permissions:
- `status:override` — change shipment/invoice status backward / off the normal flow (SUPERADMIN)
- `admin:manage` — list/create admins, reset admin passwords, view internal users (SUPERADMIN)

## Piece 1 — Status state machine + audit  ✅ (this is what we're building)
Regular admins move status **forward only**; super-admin may **reverse/fix** (to audit admin mistakes).

**Forward (any admin):**
- Shipment: `PENDING→TRANSIT→DELIVERED`, `PENDING→CANCELLED`, `TRANSIT→FAILED`
- Invoice: `DRAFT→SENT`, `SENT/OVERDUE→PAID`, `DRAFT/SENT→CANCELLED` (existing action routes)

**Reversal / off-flow (SUPERADMIN only, `status:override`):**
- Shipment: any non-forward move (e.g. `DELIVERED→TRANSIT`, `CANCELLED→PENDING`)
- Invoice: new `PATCH /api/invoices/:id/status` (un-cancel, undo paid, …)

Logic in [`lib/statusFlow.ts`](apps/api/src/lib/statusFlow.ts) (`canChangeStatus` / `isReversal` /
`isValidStatus`). Audit: every status change → `adminAuditLog` (`UPDATE_STATUS`) with `from → to`
+ a reversal flag. **No migration** — reuses the existing `UPDATE_STATUS` action.

## Piece 2 — Driver expiry: allow-late + log-missed  ✅ DONE
Admins can update `licenseExpiry` / `stnkExpiry` / `kirExpiry` even after they lapse (already
allowed — no past-date block). When a recorded date is already in the past, a **"missed deadline"**
admin notification (`category: "compliance"`) is raised for manual cross-check.
- [`lib/expiry.ts`](apps/api/src/lib/expiry.ts) `flagIfExpired()` (deduped per doc within 24h).
- Wired into driver + vehicle **create & update** (`routes/fleet.ts`).
- `alertScheduler` also sweeps **already-expired** docs daily (previously it only flagged
  expiring-within-30-days), so a lapse stays visible until fixed. No migration (reuses `adminNotification`).

## Piece 3 — Admin management  ✅ DONE
SUPERADMIN-only (`admin:manage`), in [`routes/admins.ts`](apps/api/src/routes/admins.ts):
- `GET  /api/admins` — list admin accounts.
- `POST /api/admins` — create an admin; returns a **one-time temp password** to relay.
- `POST /api/admins/:id/reset-password` — reset; returns a new one-time temp password.

**Approach note:** went **direct (temp-password returned once)** instead of reusing the magic-link /
reset-link flow — that infra is client-coupled (`MagicLink.companyName` required, reset routes update
`User`, the link targets the client frontend page), so reusing it would mean touching shared client
flows + a frontend page. Direct keeps it backend-only. A self-service link flow can be added later
(needs frontend work). Migration: added the `CREATE_ADMIN` audit action.

**Frontend handoff (friend):** an "Admins" list page + a Create-Admin form that shows the returned
`tempPassword` once, and a per-admin "Reset password" button that shows the returned temp password.

## Future / extensions (hold for now — keep easy to add)
- **Page/feature-level access** (e.g. "regular admins can't see the Clients page") → add `page:clients`
  etc. to the matrix and gate the route/UI. The capability-matrix design already supports this — no rearchitecture.
- Differentiate OPERATIONS vs SUPPORT if a real distinction emerges.
- Audit-log viewer UI (the data is already captured in `adminAuditLog`).
