# Profil Admin (admin · nav id `profile`)
**File:** `apps/web/src/pages/AdminComponents/AdminProfileSection.jsx` (394 lines) + `components/AdminSessionsPanel.jsx` (184 lines). · **Roles:** every admin role (sidebar allows `profile` for all — `AdminSidebar.jsx` L53–66). No props; identity comes from `useAuth()`. No per-role differences — the hero badge just shows `user?.role` (L182).

## What it does
- Self-service account page: hero card (avatar + role badge + name/email), Sesi Aktif panel, Informasi Pribadi form, Keamanan Akun (password change), Riwayat Aktivitas sidebar, avatar-upload modal.
- Avatar: loads saved `avatarUrl` from `GET /api/auth/admin/me` on mount; click avatar → modal with click-to-pick or drag & drop; JPG/PNG/WEBP ≤ 5MB validated client-side; multipart upload (field `file`).
- Password change: verifies `currentPassword` is filled and `newPassword` ≥ 6 chars client-side, then `PATCH /api/auth/admin/me/password`.
- Sessions panel (`AdminSessionsPanel`): lists active server-side sessions + trusted devices (browsers that skip the 2FA email code for 7 days); revoke one or "Keluar dari Semua".
- **Riwayat Aktivitas is REAL (fixed 2026-09-22)** — `auditLogsAPI.mine({ limit: 10 })` → `GET /api/audit-logs/me`, self-scoped server-side (any role reads only their own rows, no `admin:manage` needed). Was mock data behind a fake 1s `setTimeout`.
- **Informasi Pribadi save is REAL (fixed 2026-09-22)** — `authAPI.updateAdminMe({ fullName })` → `PATCH /api/auth/admin/me`. Only `fullName` is editable/sendable: **Admin has no `phoneNumber` column**, and the email field is now `disabled`/`readOnly` (changing email isn't supported by this endpoint — was previously an editable-looking field that silently did nothing on submit, the same "fake" pattern as the activity log). Was a simulated no-op toast.

## Data & endpoints
| api.js fn | HTTP route | Purpose |
|---|---|---|
| `authAPI.getAdminMe()` | `GET /api/auth/admin/me` | own profile incl. `avatarUrl`; also seeds `formData` (fullName/email) on mount — fixed 2026-09-22, was AuthContext-only |
| `authAPI.updateAdminMe({fullName})` | `PATCH /api/auth/admin/me` | **New 2026-09-22.** Self-update, any role; `updateAdminMeSchema` (Zod) validates; writes `adminAuditLog` (`UPDATE_ADMIN` — new enum value, migration `add_update_admin_action_type`) |
| `authAPI.uploadAdminAvatar(file)` | `POST /api/auth/admin/me/avatar` (multipart, field `file`) | avatar upload → `{ avatarUrl }` |
| `authAPI.changeAdminPassword({currentPassword,newPassword})` | `PATCH /api/auth/admin/me/password` | self-service password change |
| `authAPI.adminSessions()` | `GET /api/auth/admin/sessions` | sessions + trusted devices (SessionsPanel) |
| `authAPI.adminRevokeSession(id)` | `DELETE /api/auth/admin/sessions/:id` | revoke one session (SessionsPanel) |
| `authAPI.adminRevokeAllSessions()` | `DELETE /api/auth/admin/sessions` | revoke ALL incl. current (SessionsPanel) |
| `auditLogsAPI.mine({limit,offset})` | `GET /api/audit-logs/me` | **New 2026-09-22.** Own activity only — `adminId` forced server-side to the caller, cannot leak another admin's rows |

## Key state & flows
- Forms: `formData` (fullName/email), `passwords`, `showCurrentPass`/`showNewPass` visibility toggles, `isSavingPassword`.
- Avatar: `avatarUrl`, `uploadingAvatar`, `showAvatarModal`, `selectedFile`, `preview` (object URL), `dragOver`, `fileInputRef`.
- Avatar flow: `openAvatarModal` → `pickFile` validates type/size and swaps the preview object URL (revoked on re-pick and on close) → `handleUploadAvatar` uploads, sets `avatarUrl`, closes modal. `resolveAvatar` prefixes relative `/api/files/...` paths with `BASE_URL`; fallback is a ui-avatars.com generated image.
- File input clears `e.target.value` so the same file can be re-picked.
- Password flow: client-side guards → API → success clears both fields; errors surface via toast with the server message.
- **Profile save flow (fixed 2026-09-22):** `handleProfileSubmit` validates `fullName` non-empty client-side, calls `authAPI.updateAdminMe`, toasts success/failure. Email input is disabled — there is no email-change path on this page.
- **Activity flow (fixed 2026-09-22):** on mount, `auditLogsAPI.mine({ limit: 10 })` maps `{logs}` into the same `{id, details, createdAt}` shape the old mock used, so the render body (timeline dots, `relativeTime`) needed no changes. Falls back to `humanizeAction(actionType)` when `changesSummary` is empty (mirrors OverviewSection's fallback, though not its full Indonesian regex table — a lighter local copy).
- Sessions: `sessions`, `devices`, `loading`, `busyId` (SessionsPanel). Revoke-one reloads the list; "Keluar dari Semua" also kills the CURRENT session, toasts the count, then hard-redirects to `/admin` after 1.2s — being signed out is the intended proof it worked. No revoke button on your own session.

## Cross-page couplings
- Rendered by `AdminDashboardPage.jsx` with NO props — unlike other sections it receives neither `userRole` nor nav callbacks.
- Avatar changes do NOT propagate to the topbar/sidebar in the same session (local `avatarUrl` state only; AuthContext `user` is not refreshed by an avatar upload). A `fullName` save via `updateAdminMe` ALSO does not refresh AuthContext — the topbar/sidebar name goes stale until next login. Not fixed this pass; flag if it becomes visible.
- `GET /api/audit-logs/me` is a **new sibling route** to the SUPERADMIN-only `GET /api/audit-logs` — same file (`auditLogs.ts`), same response shape, different `where` (forced to the caller). The Beranda feed still uses the original `/` route; this page uses `/me`. Don't merge them — `/me`'s whole safety property is that `adminId` is never read from the client.
- Backend logs "Changed own password" and now "Updated own profile" to `AdminAuditLog` — both surface in Beranda's feed (existing `SUMMARY_RULES` entry covers the password one; the profile one falls back to `humanizeAction` there too since it wasn't added to that regex table).

## Gotchas
- 2FA surfaces here only indirectly: "Perangkat Terpercaya" = browsers that skip the emailed OTP (SessionsPanel); forgetting one does NOT log it out. There is no 2FA enable/disable toggle on this page.
- Role badge falls back to the string `'SUPERADMIN'` when `user` is null — cosmetic but misleading.
- `getAdminMe` failure is silently swallowed (placeholder avatar + AuthContext-snapshot form values kept) — fine as a fallback, but don't hang new must-load data off that effect without its own error path.
- **Admin has no `phoneNumber` column** (checked against `schema.prisma` before adding the self-update route) — don't add a phone field to this form without a migration first.
- After a DB reseed, a stale session cookie still renders this page but writes fail (admin FK gone) — re-login (see memory: stale session after reseed).

## How to add a feature cleanly
- [x] ~~Wire the real activity log~~ — done 2026-09-22 (`GET /api/audit-logs/me`).
- [x] ~~Wire the profile form~~ — done 2026-09-22 (`PATCH /api/auth/admin/me`, `fullName` only).
- [ ] New security card: add below the Keamanan Akun block in the left `lg:col-span-2` column; follow the card header pattern (icon tile + h3).
- [ ] New auth endpoint: add to the `authAPI` block of `apps/web/src/lib/api.js`, one-line JSDoc, next to the sessions trio.
- [ ] New self-update field: extend `updateAdminMeSchema` in `apps/api/src/lib/validate.ts` (Zod) — check `schema.prisma` `model Admin` FIRST, this page already hit a case where a plan assumed a column (`phoneNumber`) that doesn't exist.
- [ ] Do NOT break: `AuthContext`/`api.js` shared contracts (client side uses them too — repo scope rule), the multipart field name `file`, or SessionsPanel's revoke-all redirect behavior (intentional). `GET /api/audit-logs/me` must keep forcing `adminId` server-side — never accept it from the client.
- [ ] Verify: `cd apps/api && npm run typecheck` then `cd apps/api && npm run smoke` then `cd apps/web && npx vite build`.
