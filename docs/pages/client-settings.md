# Pengaturan Akun (client · nav id `settings`)
**File:** `apps/web/src/pages/dashboard/SettingsSection.jsx` (27 lines) · **Roles:** clients only — verification enforced at login (`auth.ts:101-110`).

**Status: largely a UI stub.** The layout and components exist, but almost nothing persists to the backend.

## What it does
- Renders a header plus two cards: `CompanyProfile` (191 lines) and `SecurityAccess` (59 lines), both under `apps/web/src/pages/dashboard/components/`.
- `CompanyProfile`: read-only profile fields (all inputs `disabled`, labelled "Hanya Admin yang dapat mengubah profil", `CompanyProfile.jsx:77`) + a company-logo upload with crop (`LogoStudioModal`), a 2MB size check, and a 7-day change cooldown.
- `SecurityAccess`: current/new password inputs and a "Perbarui Kredensial" button.
- Reached via sidebar nav or by clicking the profile in the topbar (`ClientDashboardPage.jsx:247`).

## Data & endpoints
| api.js fn | HTTP route | Purpose |
|---|---|---|
| — (none called from this page) | — | — |
| `useAuth().user` | (populated by `GET /api/users/me` in `AuthContext`) | Fills companyName / fullName / email / phoneNumber display values |

Backend-ready but unused here: `usersAPI.getMe` / `updateMe` / `updateSettings` (`api.js:200-211`) → `GET/PATCH /api/users/me`, `PATCH /api/users/me/settings` (`users.ts:173,202,256`).

## Key state & flows
- `SettingsSection` itself: no state; passes `user` from `useAuth()` to `CompanyProfile` (line 22).
- `CompanyProfile` state: `currentLogo`, `lastUploadDate`, `studioImageUrl` (`CompanyProfile.jsx:9-14`). Logo flow: click → file input → 2MB check → `LogoStudioModal` crop → `handleApplyLogo` sets **local state only** — never uploaded; a page refresh reverts to `/mpl_logo_proto.svg` and resets the cooldown.
- `SecurityAccess`: password inputs are **uncontrolled** (no state, no validation); the button calls `onUpdateCredentials`, which is just `showToast('Kredensial keamanan berhasil diperbarui.', 'success')` (`SettingsSection.jsx:23`) — **no API call, nothing changes**.

## Cross-page couplings
⚠️ **SHARED CONTRACT** — `useAuth()`/`AuthContext` is an explicitly protected shared contract (CLAUDE.md). The `user` shape (`fullName`, `companyName`, `email`, `phoneNumber`) comes from `GET /api/users/me` — the same `users.ts` route family the admin dashboard manages clients through. Renaming those fields admin-side blanks this page's displays (they fall back to hardcoded defaults, see Gotchas).
- Topbar display name/role also read `user.fullName` / `user.companyName` (`ClientDashboardPage.jsx:210-211`).

## Gotchas
- **Password change is fake:** the success toast fires without any request (`SettingsSection.jsx:23`) — and there is currently **no backend endpoint** for a client self-service password change: `updateMeSchema` only allows `fullName`/`companyName`/`phoneNumber` (`apps/api/src/lib/validate.ts:186-190`); passwords change only via admin-generated reset links (`users.ts:552`).
- **Logo upload is fake:** state-only, not persisted (`CompanyProfile.jsx:49-54`); the 7-day cooldown is also state-only.
- Hardcoded placeholder data shown as real: NIB `912000-834-291` (`CompanyProfile.jsx:137`) and office address (`CompanyProfile.jsx:173`); field fallbacks like "Ananditha Putri" / "ops@mahkotaputra.com" render when `user` fields are missing (`CompanyProfile.jsx:128-165`).
- Disabled inputs use `defaultValue={user…}` — if `user` loads after mount, `defaultValue` does not update; stale/fallback values can stick until remount.

## What's missing (to de-stub)
- Wire `SecurityAccess` to a real password-change endpoint — one must be built first (with current-password verification); `PATCH /api/users/me` does not accept a password field today.
- Persist the logo (needs a backend upload route — none exists for client logos; admin avatars have `POST /api/auth/admin/me/avatar` as a pattern, `api.js:195`).
- Replace hardcoded NIB/address with real `user` fields (schema fields must exist first — check before adding, per project memory).

## How to add a feature cleanly
1. Read `context.md`/`RUNBOOK.md`; **client changes require explicit approval** (CLAUDE.md admin-only scope) — and `AuthContext` is a named shared contract, so treat any `user`-shape change as cross-app.
2. Use the existing `usersAPI` block (`api.js:200-211`); do not add raw fetches.
3. After a successful `updateMe`, call `AuthContext`'s refresh (`refreshUser`, `AuthContext.jsx:121-129`) so the topbar/profile update without re-login.
4. Convert `SecurityAccess` inputs to controlled state with validation before wiring the API (they currently submit nothing).
5. Verify: `cd apps/web && npx vite build`; log in at `/client`, confirm changes persist across a hard refresh (this page's current features do not).
