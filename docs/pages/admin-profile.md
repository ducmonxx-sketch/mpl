# Profil Admin (admin · nav id `profile`)
**File:** `apps/web/src/pages/AdminComponents/AdminProfileSection.jsx` (394 lines) + `components/AdminSessionsPanel.jsx` (184 lines). · **Roles:** every admin role (sidebar allows `profile` for all — `AdminSidebar.jsx` L53–66). No props; identity comes from `useAuth()`. No per-role differences — the hero badge just shows `user?.role` (L182).

## What it does
- Self-service account page: hero card (avatar + role badge + name/email), Sesi Aktif panel, Informasi Pribadi form, Keamanan Akun (password change), Riwayat Aktivitas sidebar, avatar-upload modal.
- Avatar: loads saved `avatarUrl` from `GET /api/auth/admin/me` on mount (L79–83); click avatar → modal with click-to-pick or drag & drop; JPG/PNG/WEBP ≤ 5MB validated client-side (L101–114); multipart upload (field `file`).
- Password change: verifies `currentPassword` is filled and `newPassword` ≥ 6 chars client-side (L58–65), then `PATCH /api/auth/admin/me/password` (L68).
- Sessions panel (`AdminSessionsPanel`): lists active server-side sessions + trusted devices (browsers that skip the 2FA email code for 7 days); revoke one or "Keluar dari Semua".
- Riwayat Aktivitas is MOCK DATA (L38–48) — three hardcoded entries behind a fake 1s `setTimeout`; the real backend (`GET /api/audit-logs?adminId=`) exists but is not wired (deferred).
- Informasi Pribadi form is a SIMULATION — submit shows "Profil berhasil diperbarui (Simulasi)" and calls no API (L50–54, TODO at L52).

## Data & endpoints
| api.js fn | HTTP route | Purpose |
|---|---|---|
| `authAPI.getAdminMe()` | `GET /api/auth/admin/me` | own profile incl. `avatarUrl` (L80) |
| `authAPI.uploadAdminAvatar(file)` | `POST /api/auth/admin/me/avatar` (multipart, field `file`) | avatar upload → `{ avatarUrl }` (L135) |
| `authAPI.changeAdminPassword({currentPassword,newPassword})` | `PATCH /api/auth/admin/me/password` | self-service password change (L68) |
| `authAPI.adminSessions()` | `GET /api/auth/admin/sessions` | sessions + trusted devices (SessionsPanel L55) |
| `authAPI.adminRevokeSession(id)` | `DELETE /api/auth/admin/sessions/:id` | revoke one session (SessionsPanel L71) |
| `authAPI.adminRevokeAllSessions()` | `DELETE /api/auth/admin/sessions` | revoke ALL incl. current (SessionsPanel L84) |

## Key state & flows
- Forms: `formData` (fullName/email, L13–16), `passwords` (L18–21), `showCurrentPass`/`showNewPass` visibility toggles (L23–24), `isSavingPassword` (L25).
- Avatar: `avatarUrl`, `uploadingAvatar`, `showAvatarModal`, `selectedFile`, `preview` (object URL), `dragOver`, `fileInputRef` (L30–36).
- Avatar flow: `openAvatarModal` (L87) → `pickFile` validates type/size and swaps the preview object URL (L101–114; revoked on re-pick and on close L95, L111) → `handleUploadAvatar` (L128–144) uploads, sets `avatarUrl`, closes modal. `resolveAvatar` prefixes relative `/api/files/...` paths with `BASE_URL` (L85); fallback is a ui-avatars.com generated image (L169).
- File input clears `e.target.value` so the same file can be re-picked (L118).
- Password flow: client-side guards (L58–65) → API → success clears both fields (L70); errors surface via toast with the server message (L72).
- Sessions: `sessions`, `devices`, `loading`, `busyId` (SessionsPanel L48–51). Revoke-one reloads the list; "Keluar dari Semua" also kills the CURRENT session, toasts the count, then hard-redirects to `/admin` after 1.2s (L84–93) — being signed out is the intended proof it worked. No revoke button on your own session (L144–146). Mock activity log: `activityLogs`/`isLoading` (L27–28).

## Cross-page couplings
- Rendered by `AdminDashboardPage.jsx` L250 with NO props — unlike other sections it receives neither `userRole` nor nav callbacks.
- Avatar changes do NOT propagate to the topbar/sidebar in the same session (local `avatarUrl` state only; AuthContext `user` is not refreshed).
- The deferred real activity log would consume `GET /api/audit-logs?adminId=<self>` (`auditLogs.ts` L6, L10–12 explicitly reserve `scope=all`/`adminId` for this page) — same endpoint the Beranda feed uses, but that route is SUPERADMIN-gated (`requirePermission("admin:manage")`, L27), so wiring it for non-superadmins needs a backend change (own-logs-only path).
- Backend logs "Changed own password" to `AdminAuditLog` — it surfaces in Beranda's feed and has a translation rule there (`OverviewSection.jsx` L111).

## Gotchas
- Two fake UI surfaces on one page: the profile form (simulated save, L50–54) and Riwayat Aktivitas (hardcoded mock, L38–48). Don't "fix" a bug in them — replace them with real wiring.
- 2FA surfaces here only indirectly: "Perangkat Terpercaya" = browsers that skip the emailed OTP (SessionsPanel L13–17); forgetting one does NOT log it out. There is no 2FA enable/disable toggle on this page.
- Role badge falls back to the string `'SUPERADMIN'` when `user` is null (L182) — cosmetic but misleading.
- `getAdminMe` failure is silently swallowed (placeholder avatar kept, L82) — fine for avatar, but don't hang new must-load data off that effect.
- After a DB reseed, a stale localStorage JWT still renders this page but writes 500 (admin FK gone) — re-login (see memory: stale session after reseed).

## How to add a feature cleanly
- [ ] Wire the real activity log: replace L38–48 with an `auditLogsAPI.list({ adminId: user.id })` fetch, but first relax the backend gate in `apps/api/src/routes/auditLogs.ts` L27 (allow self-scope for non-superadmins) — do not drop `requirePermission` for cross-admin reads.
- [ ] Wire the profile form: add a `PATCH /api/auth/admin/me` route + `authAPI` fn following the `changeAdminPassword` pattern (api.js L183–189), then replace L50–54; refresh AuthContext `user` after save.
- [ ] New security card: add below the Keamanan Akun block (L239–296) in the left `lg:col-span-2` column; follow the card header pattern (icon tile + h3).
- [ ] New auth endpoint: add to the `authAPI` block of `apps/web/src/lib/api.js` (L160–197) with a one-line JSDoc, like the sessions trio (L175–178).
- [ ] Do NOT break: `AuthContext`/`api.js` shared contracts (client side uses them too — repo scope rule), the multipart field name `file` (L194), or SessionsPanel's revoke-all redirect behavior (intentional).
- [ ] Verify: `cd apps/api && npm run typecheck` then `cd apps/web && npx vite build`.
