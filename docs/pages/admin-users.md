# Daftar Admin (admin · nav id `users`)

**File:** `apps/web/src/pages/AdminComponents/UsersSection.jsx` (496 lines) · **Roles:** SUPERADMIN only. The sidebar hides `users` for every other role (`AdminSidebar.jsx:53-67`: OPERATIONS gets everything *except* `users`; SUPPORT/pipeline roles lose it too). The backend enforces it independently: all `/api/admins` routes run `requirePermission("admin:manage")`, held only by SUPERADMIN (`apps/api/src/lib/rbac.ts:28`, `apps/api/src/routes/admins.ts:23,37,77`). The component itself takes no role prop (`AdminDashboardPage.jsx:249`).

## What it does

- Lists internal admin accounts (`Admin` table, not clients): name, email, role badge, created date (columns, lines 168-224).
- KPI cards: Total Admin, Tim Pipeline (KEPALA_ARMADA/PIC_PABRIK/PIC_GUDANG), Super Admin (lines 226-228, 244-267).
- Creates admin accounts with a role picker over all six roles (`ROLE_LABELS`, lines 9-16); password is auto-generated server-side and shown **once** with a copy button (lines 112-132, 329-386).
- Resets an admin's password — returns a one-time temp password displayed in a modal (lines 134-150, 422-493). Unlike clients, this is an inline temp password, **not** a reset link.
- Read-only detail panel (avatar initials, email, role, created date) via row click or the pencil button (lines 277-318).
- Polls the roster every 8 s (line 68).

## Data & endpoints

| api.js fn (`adminsAPI`) | HTTP route | Purpose |
|---|---|---|
| `list` (api.js:442) | `GET /api/admins` | List admin accounts (SUPERADMIN via `admin:manage`) |
| `create` (api.js:446) | `POST /api/admins` | Create admin; returns `{ admin, tempPassword }` shown once |
| `resetPassword` (api.js:450) | `POST /api/admins/:id/reset-password` | One-time temp password for that admin |

No magic-link or reset-link flow exists for admins: registration magic links are client-only — the public register endpoint rejects `accountType !== "client"` (`apps/api/src/routes/users.ts:494`), and admin resets are temp-password-based. (Client link flows live on the Klien page; see `docs/pages/admin-clients.md`.)

## Key state & flows

- `admins` — mapped roster `{id, name, email, role, createdAt(localized)}` from `fetchAdmins` (lines 44-64); `loading` gates the table.
- Create modal: `showCreateModal`, `formName`, `formEmail`, `formRole` (default `OPERATIONS`), then success mode `createSuccess` + `createdCredentials` + `credentialsCopied` (lines 25-36). `handleModalSubmit` (line 159) doubles as "Buat Akun" / "Selesai"; `resetModal` (line 103) clears everything.
- Reset modal: `showResetModal`, `resetTarget`, `resetPassword`, `resetPasswordCopied` (lines 38-42); `handleResetPassword` (line 134) fetches the temp password before opening.
- `selectedAdmin` — detail panel (line 26); anime.js entrance effects on load/panel (lines 72-101).
- No verification lifecycle here — admins are created active. PENDING/VERIFIED/REJECTED applies only to client accounts on the Klien page. No company grouping either; roles are the only categorization (`ROLE_LABELS`, lines 9-16).

## Cross-page couplings

- **Sidebar/RBAC:** the `role` values created here drive `AdminSidebar.jsx` nav filtering and every `userRole`-gated section (Shipments, Armada, Drivers, Klien). Creating a pipeline-role admin changes what that person can see everywhere.
- **Beranda activity feed:** admin creation/reset writes `adminAuditLog` rows server-side; the SUPERADMIN-only feed (`auditLogsAPI`, `GET /api/audit-logs`, api.js:433-437) and roster on Beranda surface these accounts.
- **Auth:** created admins log in through the shared admin auth flow (`/api/auth/*` in `authAPI`); "Admin harus mengganti password ini setelah login pertama" (line 489) is advisory copy only — nothing forces the change.
- **No client-facing contract:** this page touches only `/api/admins`; nothing in the client app consumes it.

## Gotchas

- **UI-side vs backend-side gates:** hiding the nav item is the only frontend gate — the component renders fine for any role, and protection is the API's `admin:manage` check returning 403.
- The "Detail" action button uses the `edit` icon (lines 207-213) but only opens the read-only panel — there is **no edit or delete admin** endpoint or UI at all.
- Temp passwords (`tempPassword`) appear exactly once in the API response; closing the modal loses them — the only recovery is another reset.
- `main-PIC` (`isMainPic`, migration `20260914091951_add_user_main_pic`) is a **client-account** concept; despite the roles named "PIC_*" here, admin rows have no main-PIC field.
- The 8 s polling refetches the full roster with no change fingerprint (fine at this scale, unlike shipments' `getVersion` pattern).
- `createdAt` is formatted at fetch time (lines 53-55), so the detail panel and table share the same display string — sort/compare on it would be wrong.

## How to add a feature cleanly

1. Backend first: add the route in `apps/api/src/routes/admins.ts` with `authenticate, adminOnly, requirePermission("admin:manage")` (match lines 23/37/77) and write an `adminAuditLog` entry for mutations.
2. Add the fn to `adminsAPI` in `apps/web/src/lib/api.js:440-452` — one JSDoc line, arrow style, same as `resetPassword`.
3. UI: state near lines 23-42, handler near lines 112-157, action button in the `actions` column (lines 203-223) or detail panel (lines 277-318). Reset new modal state in `resetModal`/the modal `onClose`.
4. Keep `ROLE_LABELS` (lines 9-16) in sync with the Prisma `AdminRole` enum if roles change — it feeds both the badge render and the create dropdown.
5. **Do not break shared contracts:** `api.js` is shared with the client-facing app — only append to it; never touch `/api/users/*` public token routes or `AuthContext` from here.
6. Verify: `cd apps/api && npm run typecheck` then `cd apps/web && npx vite build`; smoke by creating a throwaway admin and logging in as it (remember to clean up — no delete endpoint, so use a reseed).
