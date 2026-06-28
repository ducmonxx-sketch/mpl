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

## Piece 2 — Driver expiry: allow-late + log-missed  (TODO)
Admins can update `licenseExpiry` / `stnkExpiry` / `kirExpiry` **even after they lapse** (no
past-date block). When the saved date was already expired at edit time, log a **"missed deadline"**
(audit entry / admin notification) for manual cross-check later.

## Piece 3 — Admin management (TODO; mostly reuse existing infra)
SUPERADMIN-only (`admin:manage`):
- **Reset an admin's password** → reuse the existing reset-password-**link** flow (no new password
  UI; super-admin never sees the password).
- **Create an admin** → reuse the **magic-link invite** (the `MagicLink` model may need an "is-admin" flag).
- **List admins / view internal users** → `GET /api/admins` (backend trivial); needs a small new
  frontend list page (friend's side).

## Future / extensions (hold for now — keep easy to add)
- **Page/feature-level access** (e.g. "regular admins can't see the Clients page") → add `page:clients`
  etc. to the matrix and gate the route/UI. The capability-matrix design already supports this — no rearchitecture.
- Differentiate OPERATIONS vs SUPPORT if a real distinction emerges.
- Audit-log viewer UI (the data is already captured in `adminAuditLog`).
