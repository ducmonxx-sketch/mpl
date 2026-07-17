# MPL Logistics — Full Session Context
> Last updated: **2026-07-18**. The single current snapshot of the project. Read this + the newest RUNBOOK §6 Session Log entries to resume cold.
> (Supersedes the pre-2026-07-15 version — the app is now a multi-role delivery pipeline; invoices removed.)

---

## 1. Overview & Stack
**Fullstack monorepo**, two people through one shared GitHub repo (`origin` = `github.com/ducmonxx-sketch/mpl`). The friend uses a Gemini-as-Opus agent → branches/`main` drift; **always pull before working**.
- **Repo:** `g:\Programming\mpl` (this machine; Windows, PowerShell primary). npm workspaces → root `node_modules`.
- **Branch:** `tier1-infra` = active line. `main` now also carries the full pipeline (friend pushes `main` too). Push only on explicit OK; never force-push.

| App | Path | Stack | Port |
|---|---|---|---|
| Backend | `apps/api` | Express 5 + Prisma 7 + TS, run via `tsx` (no compile step) | 3001 |
| Frontend | `apps/web` | React 19 + Vite 6 | 5173 |
| WhatsApp gateway | `services/OpenWA/` | NestJS (gitignored, standalone) | 2785 |

**Scope:** admin dashboard only. Note client-side implications; don't fix client. Shared contracts: `schema.prisma`, `/api/users|shipments|tracking|notifications`, `api.js`, `AuthContext`, `TrackingSection`.

---

## 2. Roles & Auth
JWT in `localStorage` (`mpl_token`), payload `{ id, role, type }`, 7-day expiry. Middleware (`apps/api/src/middleware/auth.ts`): `authenticate` · `adminOnly` · `requireRole(...)`. Permission matrix in `lib/rbac.ts` (`requirePermission`); only SUPERADMIN holds `status:override` + `admin:manage`.

**Admin roles (`AdminRole`):** `SUPERADMIN` · `OPERATIONS` · `SUPPORT` · `KEPALA_ARMADA` · `PIC_PABRIK` · `PIC_GUDANG`. The 3 pipeline roles have **no** matrix perms (`[]`) — they're gated per-status in the UI, not via rbac.
- `PIC_PABRIK` accounts can be **bound to a plant** (`Admin.pickupPlantId`) → default Lokasi Plant filter.

**Seed logins** (`npx prisma db seed`): `admin@mpl.com`/`admin1234` (SUPER) · `ops@`/`ops1234` (OPS) · `armada@`/`armada1234` · `pabrik@`/`pabrik1234` · `gudang@`/`gudang1234` · `client@mpl.com`/`client1234`. Also `pabrik1..3@mpl.com`/`admin1234` (plant-bound).
> ⚠️ After any `db seed`/`migrate reset`: **re-login** (old JWT's admin id is gone → writes 500).

**Auth rehaul** (localStorage → httpOnly cookies + CSRF) is **DEFERRED** (DEPLOYMENT.md §3) — don't do piecemeal.

---

## 3. Prisma 7 / DB (`mpl_logistics` @ localhost:5432)
- DB URL is in `apps/api/prisma.config.ts`, NOT `schema.prisma`. Generator `prisma-client` → `apps/api/src/generated/prisma/` (**gitignored** → `npx prisma generate` after every pull).
- `PrismaPg` adapter + `pg` Pool. `ADD VALUE` enum migrations are **non-transactional** (no BEGIN/COMMIT).
- Commands: `prisma generate` · `migrate deploy` (prod-safe) · `migrate dev --name X` (dev) · `db seed` · `migrate reset --force` (⚠️ wipe; needs `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`, does **not** auto-seed → run `db seed` after).

---

## 4. Schema (current — 22 migrations, all applied)
**Enums:** `Manufacturer` (HONDA/YAMAHA/SUZUKI) · `AdminRole` (6, above) · `VerificationStatus` · `DriverStatus` (ACTIVE/**STANDBY**/ON_DUTY/UNAVAILABLE) · `VehicleStatus` (AVAILABLE/**STANDBY**/IN_USE/MAINTENANCE) · `ShipmentStatus` (see §5) · `EventStatus` · `AuditActionType` (still lists `*_INVOICE` values — harmless, dropping a PG enum value is destructive). **No `InvoiceStatus` — invoices removed.**

**Models:**
| Model | Notes |
|---|---|
| `Admin` | +`pickupPlantId`→`PickupPlant` (PIC_PABRIK binding); `avatarKey` |
| `AdminAuditLog` | every admin write logged (read via `/api/audit-logs`) |
| `User` | clients; `avatarKey`, `verificationStatus`; **no invoice relation** |
| `UserSettings` | 1:1 User |
| `Driver` | `status` (DriverStatus); `primaryVehicle` back-rel |
| `Vehicle` | `licensePlate @unique`, stnk/kir/service, chassis/engine, **brand/modelName/color**, `primaryDriverId @unique` (1:1 pairing) |
| `VehicleBrand` / `VehicleColor` | lookup lists (name @unique) for Armada dropdowns |
| `PickupPlant` | `name @unique`, `code`, `manufacturer`; ← Admin + Shipment |
| `Shipment` | id `#MPL-00001-JKT`; `status`; **pipeline fields:** `shippingCategory`(Unit/Cargo/Container), `dimensions`, `containerType`, `pickupPlantId`, `vehicleCondition`, `lkuNumber`, `pabrikNotes`, `serahTerimaUrl`, `handoverNotes`, `catatanPlantPengirim`, `catatanGudangPenerima`. `driverId`/`vehicleId` nullable. **Dropped `price` + `estimatedArrival`.** |
| `PlantCheck` (1:1 Shipment) + `PlantCheckPengiriman` / `PlantCheckLku` / `PlantCheckKsu` (child rows) | Pengurus Pabrik form (Data Pengiriman + LKU + KSU); cascade delete; feeds future Surat Jalan |
| `ShipmentEvent` | manual tracking timeline (cascade) |
| `Notification` (client) · `MagicLink` · `AdminNotification` | |

---

## 5. Status Flow (pipeline — LOCKED) — `lib/statusFlow.ts`, mirrored in `ShipmentsSection`
```
PENDING (Menunggu) ─ admin creates
  → STANDBY        ─ Kepala Armada creates (driver+vehicle from paired dropdown); server-derived by role
  → DITUGASKAN     ─ Armada reconfirm (Ganti Driver / Pengganti swap)
  → [AT_PLANT]     ─ (Di Pabrik) defined; keep-or-drop still OPEN
  → TRANSIT        ─ Pengurus Pabrik plant-check submit (Dalam Perjalanan)
  → DITERIMA       ─ Kepala Gudang: received (1-tap)
  → DITURUNKAN     ─ Kepala Gudang: unloaded (1-tap)
  → DELIVERED      ─ Kepala Gudang handover (serah-terima notes form) = "Selesai"
CANCELLED (Dibatalkan) ← from TRANSIT.  FAILED = legacy, not offered.
```
- **Regular admin (OPS/SUPPORT):** forward-only (403 on reversal). **SUPERADMIN:** any status (`status:override`).
- **Status mirror (1:1 shipment→driver→vehicle):** STANDBY→driver+vehicle STANDBY; DITUGASKAN/TRANSIT→ON_DUTY / IN_USE; DELIVERED/CANCELLED→release (ACTIVE/AVAILABLE). Centralized in `/status`; create mirrors on STANDBY; `/handover` frees both.
- **Departure guard:** blocks TRANSIT if the driver is on a *different* TRANSIT shipment (409). ⚠️ **`/plant-check` bypasses the guard + ON_DUTY promotion** (open, needs friend coordination — see DEV-PLAN).

### Driver↔Vehicle pairing
1:1 via `Vehicle.primaryDriverId @unique` (Armada pair/unpair; **Lepas-first** to re-pair). Shipment brings the paired driver by default; a **substitute ("Pengganti", derived: `shipment.driverId ≠ vehicle.primaryDriverId`)** can swap the driver for one shipment (vehicle unchanged), shown on Armada/Driver pages.

---

## 6. Backend Routes (mounted in `src/index.ts`; **no `/api/invoices`**)
- **`/api/auth`** — POST `register`·`login`·`admin/login`; GET `admin/me` (→avatarUrl); POST `admin/me/avatar` (multipart `file`); PATCH `admin/me/password`.
- **`/api/users`** — CRUD clients (adminOnly); GET/PATCH `me`, POST `me/avatar`, PATCH `me/settings`; verify/reject; `companies`; magic-link + reset-password flows.
- **`/api/shipments`** — GET `pickup-plants` · list · `stats` · `:id` · POST create · PATCH `:id/assign` · POST `:id/notify-driver` (OpenWA) · PATCH `:id/plant-check` (Pabrik) · `:id/handover` (Gudang) · `:id/status` · DELETE `:id`.
- **`/api/fleet`** — drivers CRUD · vehicles CRUD · `:id/pair-driver`·`unpair-driver` · GET/POST `brands`·`colors`.
- **`/api/tracking`** — GET `:shipmentId` · POST `:shipmentId/events` · PATCH `events/:eventId`.
- **`/api/notifications`** (client) · **`/api/admin-notifications`** · **`/api/admins`** (SUPERADMIN) · **`/api/audit-logs`** (SUPERADMIN) · **`/api/files/*`** (public, serves avatars).
- Rate limit: general 1500/15min, auth 50/15min. `/api/files` currently has **no** limiter (DoS note in DEPLOYMENT.md §5).

---

## 7. Frontend (`apps/web/src`)
Pages: `/` landing · `/admin` `AdminDashboardPage` · `/dashboard` `ClientDashboardPage` · `/track/:id`. Sidebar/dashboard adapt per role (PIC_GUDANG/PABRIK trims, plant filter).
Admin sections (`pages/AdminComponents/`): Overview, **Shipments** (big pipeline rewrite: per-role/per-status modals, plant-check wizard, gudang handover form), Clients, Drivers, Armada, Users, Profile. **InvoicesSection removed** (admin + client).
Key shared: `lib/api.js` (`authAPI`/`usersAPI`/`shipmentsAPI`/`fleetAPI`/`trackingAPI`/`notificationsAPI`/`adminNotificationsAPI`/`auditLogsAPI`/`adminsAPI`; **no `invoicesAPI`**). `shipmentsAPI` has `plantCheck`/`handover`/`getPickupPlants`. `authAPI` has `getAdminMe`/`uploadAdminAvatar`. `BASE_URL` exported; `request()` is FormData-aware (avatar uploads). `contexts/AuthContext.jsx`, `ToastContext.jsx`. `components/AdminModal.jsx` (portaled to `<body>`, z-top). CSP (`vite.config.js` dev + `public/_headers`/`.htaccess` prod) allows the **API origin in `img-src`** for avatars.

---

## 8. Gotchas
1. **Reseed on a dirty DB collides** — `seed.ts` upserts (only 3 vehicles/paired) but old rows linger → `Vehicle.primaryDriverId @unique` P2002. **Reseed via `migrate reset --force` (clean) then `db seed`**, not `db seed` alone.
2. **Stale JWT after reseed** → re-login.
3. **Schema-ahead-of-migrations:** `migrate status` only compares recorded migrations vs the folder, not schema↔DB. Always generate a migration after editing `schema.prisma` (the friend has pushed un-migrated schema before).
4. **No runtime typecheck** (`tsx` strips types) → exercise routes; a clean boot ≠ correct.
5. **Frontend-ahead-of-backend:** friend ships UI sending fields the backend drops — grep frontend before adding a field/route.
6. **Orphan node** on :3001/:5173 → `Stop-Process -Name node -Force` before restart.
7. **Two-agent repo:** `git fetch` before push; friend pushes `main` too. CI/smoke = model-agnostic net.
8. **`/plant-check` guard gap** (§5) — don't add other direct-TRANSIT routes without the guard+mirror.

---

## 9. Deferred / Next
- **Pengurus Pabrik / Kepala Gudang flow** — built (plant-check wizard + gudang leg). Remaining: **`AT_PLANT` keep-or-drop** decision; Surat Jalan print-to-PDF (pulls plant-check + serah-terima).
- **Admin topbar avatar** — Profil upload works; topbar still a `ui-avatars` placeholder → wire via additive `AuthContext.updateUser` (frontend-only).
- **Client-side (note only):** Faktur pages removed (friend's domain); auto-WA-on-assign double-fires with manual `/notify-driver`; TrackingSection ETA blank (price/eta dropped); new statuses client-visible on the client pass.
- **Deferred infra:** auth rehaul (cookies/CSRF); Zod validation layer; asyncHandler + error middleware; pino logger; pagination; flip CI typecheck/lint to blocking (after the ~pre-existing-error cleanup — non-blocking on purpose).
- **Driver archive/resign** (soft-delete) — design only.

---

## 10. Resume Checklist
```bash
git branch --show-current            # tier1-infra
git fetch --all --prune && git status -sb   # check vs origin (friend may have pushed main)
# if behind & clean: git pull --ff-only
cd apps/api && npx prisma generate && npx prisma migrate deploy   # gitignored client + new migrations
#   reseed (clean): $env:PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="1"; npx prisma migrate reset --force; npx prisma db seed  → re-login
cd apps/api && npx tsx src/index.ts  # :3001
cd apps/web && npm run dev           # :5173  (restart after any CSP/config change)
# done: Stop-Process -Name node -Force -ErrorAction SilentlyContinue
```
