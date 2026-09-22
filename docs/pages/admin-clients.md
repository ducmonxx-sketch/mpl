# Manajemen Klien (admin · nav id `clients`)

**File:** `apps/web/src/pages/AdminComponents/ClientsSection.jsx` (1310 lines) · **Roles:** nav item visible to SUPERADMIN and OPERATIONS only (`AdminSidebar.jsx:53-67` hides `clients` for KEPALA_ARMADA/PIC_PABRIK/PIC_GUDANG/SUPPORT). Backend writes are gated by `clientManagerOnly` = SUPERADMIN + OPERATIONS (`apps/api/src/middleware/auth.ts:86`); `set-main-pic` is SUPERADMIN-only on both sides (UI `canSetMainPic`, line 16; API `requireRole("SUPERADMIN")`, `users.ts:319`).

## What it does

- Lists client accounts grouped **one row per company** (accounts sharing `companyName`; no-company accounts get a singleton row keyed `__self_${id}`, lines 64-100).
- KPI cards: total companies, verified, unverified (lines 404-405, 544-583); filter tabs + search over company/PIC names (lines 390-402).
- Company CRUD: create ("+Daftar Perusahaan"), edit, delete — all via the underlying `users` records (lines 201-292).
- PIC management: add PIC manually (with optional temp password) or via **magic link** per company (lines 325-382, 988-1234); expandable row shows every PIC with per-PIC actions (lines 636-751).
- Verification: activates PENDING accounts ("Aktifkan"), row-level and in the detail panel (lines 248-261, 819-832).
- Main-PIC designation: SUPERADMIN can promote any PIC to "PIC Utama" (lines 263-276, 690-713).
- Reset-password links: generates a one-time client reset link and shows a copy modal (lines 294-310, 1236-1307).
- Slide-in detail panel (portal) with company info, shipment count, per-PIC selector (lines 764-890); polls the list every 8 s (line 112) and syncs the open panel (lines 117-125).

## Data & endpoints

| api.js fn (`usersAPI`) | HTTP route | Purpose |
|---|---|---|
| `listAll` (api.js:214) | `GET /api/users` | All client accounts + `_count.shipments`, `isMainPic` (`users.ts:44`, adminOnly) |
| `createUser` (api.js:218) | `POST /api/users` | Create company anchor or PIC; auto-`VERIFIED`; returns `temporaryPassword` once (`users.ts:82`) |
| `updateUser` (api.js:234) | `PATCH /api/users/:id` | Edit one client account (`users.ts:662`) |
| `verify` (api.js:222) | `PATCH /api/users/:id/verify` | PENDING → VERIFIED; creates a client notification (`users.ts:278`) |
| `reject` (api.js:226) | `PATCH /api/users/:id/reject` | → REJECTED. **Backend-ready, no UI caller** (`users.ts:364`) |
| `setMainPic` (api.js:230) | `PATCH /api/users/:id/set-main-pic` | SUPERADMIN; unsets siblings in a transaction (`users.ts:319`) |
| `deleteUser` (api.js:238) | `DELETE /api/users/:id` | Deletes client **and their shipments**; promotes next-oldest PIC to main (`users.ts:717`) |
| `generateMagicLink` (api.js:245) | `POST /api/users/magic-link` | Registration link `/auth/register/:token`; lifetime `MAGIC_LINK_HOURS` (default 24 h, `users.ts:40`) |
| `generateResetLink` (api.js:257) | `POST /api/users/reset-password-link` | Reset link `/reset-password?token=`; lifetime `RESET_LINK_HOURS` (default 24 h, `users.ts:41`) |
| `validateMagicLink` / `registerViaMagicLink` (api.js:249/253) | `GET`/`POST /api/users/magic-link/:token[/register]` | Public; consumed by `MagicLinkPage.jsx`, Turnstile-guarded, registrant lands PENDING |
| `validateResetLink` / `resetPassword` (api.js:261/265) | `GET`/`POST /api/users/reset-password/:token` | Public; consumed by `ResetPasswordPage.jsx`, Turnstile-guarded, one-time use |
| `getCompanies` (api.js:241) | `GET /api/users/companies` | Distinct company names — **currently unused**; dropdown is derived client-side (line 386) |
| `renameCompany(from, to)` | `PATCH /api/users/company-rename` | **New 2026-09-22.** Bulk-renames a company across ALL its PICs in one `updateMany` (avoids splitting the company); `clientManagerOnly`; registered BEFORE `/:id` in `users.ts` so Express doesn't swallow it as an id param |

## Key state & flows

- `CLIENTS` — company-grouped rows (`{id, companyName, shipmentCount, pics[], address, city, npwp, isActive}`), built in `fetchClients` (lines 60-108). Company `isActive` = every PIC `VERIFIED` (line 99); `shipmentCount` summed across PICs (line 82).
- `selectedClient` + `selectedPicByRow` — detail panel and its per-row PIC dropdown; `getMainPic` (line 161) falls back to `pics[0]`, `getSelectedPic` (line 165) defaults to main PIC.
- Create/Edit modal: `showCreateModal`, `isEditMode`, `editingClientId`, `formCompanyName/Phone/Email/City/Address/Npwp`, `createSuccess` (lines 21, 35, 53-58, 172-173). Edit mode also carries `editFullName` (the PIC's real name, seeded from `pic.name` on open) and `editOriginalCompanyName` (to detect a rename) — added 2026-09-22, see Gotchas.
- PIC modal: `showPicModal`, `showPicMagicLinkSection` (manual form vs magic-link view), `picForm*`, `picCreateSuccess`, `picCreatedCredentials`, `picMagicLink` (lines 38-50).
- Reset modal: `showResetModal`, `resetUser`, `resetLink`, `resetLinkCopied` (lines 29-32).
- Verification lifecycle: magic-link registration → `PENDING` → admin `verify` → `VERIFIED` (client gets an in-app notification). `REJECTED` exists in the schema/API but this page never sends it and renders it identically to PENDING ("❌ Belum Terverifikasi", line 76).
- Main-PIC flow: star badge + "Jadikan PIC Utama" button (SUPERADMIN, >1 PIC, lines 690-713); optimistic local update then refetch (lines 263-276).

## Cross-page couplings

- **Shipments:** shipments carry `clientId`; deleting a client cascades `shipment.deleteMany` (`users.ts:743`) — Pengiriman lists shrink. ShipmentsSection's create-for-client dropdown reads the same user set.
- **Overview:** "Total Klien" KPI routes here (`OverviewSection.jsx:310`, `onChangeNav('clients')`).
- **Notifications:** verify creates a client `notification` row (`users.ts:299-305`) shown in the client app.
- **Audit logs:** create/verify/reject/set-main-pic/update/delete/magic-link/reset-link/**company-rename** all write `adminAuditLog` (e.g. `users.ts:149, 289, 345, 428, 574`) — surfaces in Beranda's SUPERADMIN activity feed.
- **Client-facing shared contracts:** `MagicLinkPage.jsx` (`/auth/register/:token`) and `ResetPasswordPage.jsx` (`/reset-password?token=`) consume the public token endpoints; link URLs are built from `CLIENT_URL` (`users.ts:438, 584`). Don't change token paths or response shapes without updating both apps.

## Gotchas

- **UI vs backend gates:** `canSetMainPic` (line 16) is display-only; the API enforces SUPERADMIN. Conversely the whole page renders for any role that reaches it — RBAC failures surface as 403 toasts.
- **Main-PIC field:** `isMainPic` added by migration `20260914091951_add_user_main_pic` (2026-09-14) with backfill; delete auto-promotes the next-oldest PIC (`users.ts:732-745`).
- **Company create makes a real account:** `handleCreateClient` (lines 201-222) creates a user with `fullName: 'Admin Perusahaan'`, auto-VERIFIED — and the returned `temporaryPassword` is discarded (success screen, lines 901-919, tells the admin to add PICs instead). That anchor account exists but nobody holds its password.
- **Edit clobbering names / splitting companies — FIXED 2026-09-22.** `handleUpdateClient` used to always send `fullName: 'Admin Perusahaan'` and PATCH **one** user row; a rename would move just that PIC out of the group. Now: the edit modal shows a "Nama PIC" field (`editFullName`, seeded from the real name on open) and sends it verbatim; a company-name change is detected against `editOriginalCompanyName` and routed through `usersAPI.renameCompany` (bulk, all PICs) INSTEAD of the per-user `companyName` field. **The company-create anchor account still hardcodes `'Admin Perusahaan'`** (next bullet) — that's a separate, still-open issue.
- **Pagination is decorative:** `totalPages={1}` hardcoded and the table receives the full `filtered` array unsliced (lines 633-759).
- Row-level actions (verify/edit/reset/delete) always target the **main PIC** (lines 410, 471-515); other PICs are only reachable via the expanded card list.
- New-shipment eligibility etc. treats anything ≠ VERIFIED as inactive; a REJECTED user shows an "Aktifkan" button that re-verifies them.

## How to add a feature cleanly

1. New endpoint? Add the fn to `usersAPI` in `apps/web/src/lib/api.js:200-267` (JSDoc one-liner, arrow style) and the route to `apps/api/src/routes/users.ts` — pick the right guard: `adminOnly` (read), `clientManagerOnly` (write), `requireRole("SUPERADMIN")` (privileged). Write an `adminAuditLog` row for mutations.
2. UI state: add `useState` near the existing modal blocks (lines 18-58); handlers next to their peers (lines 175-382); reset it in `resetForm`/`resetPicModal`.
3. If the feature is per-PIC, wire it into both the row actions column (lines 469-516) **and** the expanded PIC card actions (lines 714-746) — they are separate lists.
4. Keep the company-grouping contract (lines 64-100) intact: any new list field must be mapped there or it won't reach rows/detail panel.
5. **Do not break client-facing shared routes:** `/api/users/me*`, the public magic-link and reset-password token endpoints, and their response shapes are consumed by the client app (`MagicLinkPage.jsx`, `ResetPasswordPage.jsx`). `PATCH /:id` is registered after `/me` deliberately (`users.ts:661`).
6. Verify: `cd apps/api && npm run typecheck` then `cd apps/web && npx vite build`. Manually re-login after any reseed (stale-JWT gotcha).
