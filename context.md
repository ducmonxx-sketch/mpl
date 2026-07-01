# MPL Logistics — Full Session Context
> Last updated: 2026-07-01. This file is the single most comprehensive snapshot of the project state.
> Read this + RUNBOOK.md §6 Session Log to resume any session cold.

---

## 1. Project Overview

**Fullstack monorepo** — two-person repo (user + friend who uses a Gemini-as-Opus agent).
- **Repo root:** `d:\Gawe\Gawe Eick\Logisticss\mpl\` (Windows, PowerShell primary shell)
- **npm workspaces:** root `package.json` → `"workspaces": ["apps/*"]`. Deps resolve to root `node_modules`.
- **Branch:** `tier1-infra` — all active work lives here. NOT pushed (branch-push lock: never push without user's explicit OK).
- **`main`:** friend's frontend is frozen ~this week, so we have full ownership of `apps/web`.

### Stack
| App | Path | Stack | Port |
|---|---|---|---|
| Backend API | `apps/api` | Express 5 + Prisma 7 + TypeScript, run via `tsx` (no compile step at runtime) | 3001 |
| Frontend | `apps/web` | React 19 + Vite 6 | 5173 |
| WhatsApp gateway | `services/OpenWA/` | NestJS (gitignored, runs standalone) | 2785 |

---

## 2. Authentication

- **JWT** stored in `localStorage` as `mpl_token`.
- Payload: `{ id, role, type: "user" | "admin" }`, 7-day expiry.
- Admin login: `POST /api/auth/admin/login`.
- Middleware: `authenticate` (any valid JWT) · `adminOnly` (type === "admin") · `requireRole(...roles)`.
- Admin roles: `SUPERADMIN` · `OPERATIONS` · `SUPPORT`.
- User `verificationStatus`: `PENDING` · `VERIFIED` · `REJECTED`.
- **Auth rehaul (localStorage → httpOnly cookies + CSRF) is DEFERRED** — see DEPLOYMENT.md §3. Do not do piecemeal.

### Seed Accounts
| Email | Password | Role/Type |
|---|---|---|
| admin@mpl.com | admin1234 | Admin — SUPERADMIN |
| ops@mpl.com | ops1234 | Admin — OPERATIONS |
| client@mpl.com | client1234 | User (client) — VERIFIED |

> ⚠️ After any `prisma db seed` or `migrate reset`: re-login. Stale JWT stays "logged in" but FKs are wiped → writes 500.

---

## 3. Prisma / Database

### Prisma 7 Specifics (CRITICAL — differs from v6)
- DB URL is in `apps/api/prisma.config.ts`, NOT in `schema.prisma`.
- Generator: `prisma-client` (not `prisma-client-js`), output to `apps/api/src/generated/prisma/` — **gitignored**, must regenerate after every pull.
- Uses `PrismaPg` driver adapter + `pg` Pool.
- ADD VALUE migrations (enum) are **non-transactional** in PostgreSQL — cannot be wrapped in a transaction block. Use `ALTER TYPE "X" ADD VALUE 'Y' AFTER 'Z'` with no `BEGIN/COMMIT`.

### Key Commands
```bash
cd apps/api
npx prisma generate              # regenerate client (after schema or pull)
npx prisma migrate deploy        # apply pending migrations (prod-safe)
npx prisma migrate dev --name X  # create + apply new migration (dev only)
npx prisma db seed               # run seed.ts
npx prisma migrate reset --force # ⚠️ wipe DB — dev only; requires PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION
```

### Database: `mpl_logistics` on PostgreSQL localhost:5432

---

## 4. Full Schema (as of 2026-07-01)

### Enums

```prisma
enum AdminRole       { SUPERADMIN  OPERATIONS  SUPPORT }
enum VerificationStatus { PENDING  VERIFIED  REJECTED }

enum DriverStatus {
  ACTIVE      // free, available for assignment
  ON_DUTY     // currently driving an in-transit shipment (auto-managed by shipment lifecycle)
  UNAVAILABLE // sick/leave — manual toggle; NOT auto-reactivated on shipment completion
}

enum VehicleStatus { AVAILABLE  IN_USE  MAINTENANCE }

enum ShipmentStatus {
  PENDING      // created, not yet assigned
  DITUGASKAN   // driver & vehicle assigned; staging before departure ← ADDED 2026-07-01
  TRANSIT      // currently being delivered
  DELIVERED    // successfully delivered
  FAILED       // legacy; no longer offered as a forward option
  CANCELLED    // cancelled (after departure or terminal)
}

enum EventStatus { UPCOMING  ACTIVE  DONE }

enum AuditActionType {
  VERIFY_USER  REJECT_USER  CREATE_DRIVER  UPDATE_DRIVER  DELETE_DRIVER
  CREATE_VEHICLE  UPDATE_VEHICLE  DELETE_VEHICLE  CREATE_SHIPMENT  UPDATE_SHIPMENT
  ASSIGN_DRIVER  ASSIGN_VEHICLE  UPDATE_STATUS  ADD_SHIPMENT_EVENT
  CREATE_INVOICE  SEND_INVOICE  MARK_INVOICE_PAID  CANCEL_INVOICE
  GENERATE_MAGIC_LINK  RESET_PASSWORD  SEND_WHATSAPP_DRIVER  CREATE_USER
  UPDATE_USER  DELETE_USER  CREATE_ADMIN
}

enum InvoiceStatus { DRAFT  SENT  PAID  OVERDUE  CANCELLED }
```

### Models (summary)

| Model | Key fields | Notes |
|---|---|---|
| `Admin` | id, fullName, email, passwordHash, role (AdminRole), avatarKey | avatarKey → storage key |
| `AdminAuditLog` | actionType, targetTable, targetRecordId, changesSummary | every admin write is logged |
| `User` | id, fullName, companyName, email, passwordHash, phoneNumber, city, address, npwp, avatarKey, verificationStatus | clients |
| `UserSettings` | emailNotifications, whatsappNotifications, language, theme | 1:1 with User, cascade delete |
| `Driver` | id, fullName, phoneNumber, status (DriverStatus), licenseNumber, licenseType, licenseExpiry, lastUpdatedByAdminId | `primaryVehicle Vehicle? @relation("VehiclePrimaryDriver")` back-rel |
| `Vehicle` | id, type, licensePlate (unique), status (VehicleStatus), stnkExpiry, kirExpiry, serviceDate, chassisNumber, engineNumber, **primaryDriverId String? @unique**, lastUpdatedByAdminId | 1:1 pairing: `primaryDriverId @unique`; `primaryDriver Driver? @relation("VehiclePrimaryDriver")` |
| `Shipment` | id (format #MPL-00001-JKT), packageType, weightKg, units, serviceLevel, originLocation, destinationLocation, specialNotes, price, status (ShipmentStatus), currentProgressPercent, pickupDate, estimatedArrival, completionDate, clientId, **driverId**, **vehicleId**, createdByAdminId, lastUpdatedByAdminId | driverId/vehicleId nullable (set at assignment) |
| `ShipmentEvent` | id, stepName, location, status (EventStatus), driverNotes, eventTimestamp, shipmentId, createdByAdminId | cascade delete with shipment |
| `Notification` | id, title, message, isRead, userId, sentByAdminId | client-facing |
| `Invoice` | id, invoiceNumber (unique), subtotal, taxRate (default 11), taxAmount, totalAmount, status (InvoiceStatus), dueDate, paidAt, notes, shipmentId (unique), clientId, createdByAdminId | 1:1 with Shipment |
| `MagicLink` | id, token (unique), type ('registration'|'reset_password'), companyName, userId, used, expiresAt | |
| `AdminNotification` | id, title, message, category, isRead, linkTo, linkId | admin-facing compliance/workload alerts |

---

## 5. Migrations (all applied as of 2026-07-01)

| Migration file | What it does |
|---|---|
| `20260610082635_init` (or similar) | Initial schema |
| `20260611184550_add_admin_notifications_and_audit_actions` | AdminNotification table + new AuditActionType values |
| `20260628140129_add_avatar_key` | avatarKey on Admin + User |
| `20260628172950_add_create_admin_audit` | CREATE_ADMIN audit value |
| `20260629175841_add_vehicle_service_chassis_engine` | serviceDate, chassisNumber, engineNumber on Vehicle |
| `20260701130000_add_ditugaskan_status` | `ALTER TYPE "ShipmentStatus" ADD VALUE 'DITUGASKAN' AFTER 'PENDING'` |

All 6 (or 11 total per `migrate status` output) migrations applied as of this session.

---

## 6. Status Flow (LOCKED SPEC)

Lives in `apps/api/src/lib/statusFlow.ts`. Enforced on the backend; frontend mirrors it.

### Shipment FORWARD transitions (regular admins — forward only)
```
PENDING    → [DITUGASKAN]
DITUGASKAN → [TRANSIT]
TRANSIT    → [DELIVERED, CANCELLED]
DELIVERED  → []  (terminal)
FAILED     → []  (terminal, legacy)
CANCELLED  → []  (terminal)
```

### Role rules
- **OPERATIONS / SUPPORT:** forward-only. Any reversal or off-flow move → 403.
- **SUPERADMIN:** all statuses except current (can reverse/override). Enforced via `roleHas(role, "status:override")`.

### DITUGASKAN semantics
- Shipment is assigned a driver+vehicle but has NOT departed yet.
- Set automatically by the `/assign` route when coming from PENDING.
- Re-assigning a DITUGASKAN or TRANSIT shipment (SUPERADMIN) does NOT change the status.

### ON_DUTY auto-lifecycle (Phase ②)
- `PENDING → DITUGASKAN`: no driver status change.
- `DITUGASKAN → TRANSIT`: assigned driver `ACTIVE → ON_DUTY` (idempotent: `updateMany` with `{ status: 'ACTIVE' }` filter). UNAVAILABLE drivers are NOT auto-promoted.
- `TRANSIT → DELIVERED or CANCELLED`: assigned driver `ON_DUTY → ACTIVE` (idempotent: `updateMany` with `{ status: 'ON_DUTY' }` filter). UNAVAILABLE drivers NOT auto-reactivated.

### Departure guard
Before setting TRANSIT: if the assigned driver is already `ON_DUTY`, find the conflicting TRANSIT shipment and return `409` with a message naming the driver and conflicting shipment ID.

---

## 7. Driver↔Vehicle Pairing Model (LOCKED SPEC — Phase ①, done)

- **1:1 pairing:** `Vehicle.primaryDriverId String? @unique` + back-relation `Driver.primaryVehicle Vehicle?`.
- Pairing is set via Armada UI (`PATCH /api/fleet/vehicles/:id/pair-driver`) and cleared via unpair.
- A driver can only be primary on one vehicle.
- When assigning a shipment from PENDING, the frontend reads the vehicle's `primaryDriver` and uses that driver.

### Substitute Driver (Pengganti)
- If `shipment.driverId ≠ vehicle.primaryDriverId`, the driver is a substitute.
- Shown as a **"Pengganti"** badge in the shipment detail panel.
- No stored flag — derived at render time.
- Swapping is done via the "Ganti Driver" checkbox in the DITUGASKAN reconfirm modal.

### Linked Shipments
- One vehicle can carry two shipments simultaneously.
- "Link Shipment" checkbox in the PENDING assign modal; if checked + a second PENDING shipment is selected, both get the same driver+vehicle on confirm (two separate assign API calls).
- No schema field — handled entirely in the frontend call flow.

---

## 8. Backend Routes (full list)

### Auth (`/api/auth`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /api/auth/admin/login | public | returns `{ token }` |
| GET | /api/auth/admin/me | adminOnly | returns admin profile + avatarUrl |
| POST | /api/auth/admin/me/avatar | adminOnly | multipart, field `file` |
| PATCH | /api/auth/admin/me/password | adminOnly | self-service password reset |
| POST | /api/auth/login | public | client login |
| POST | /api/auth/register | public | client register (or magic-link) |
| POST | /api/auth/reset-password | public | request reset link |
| POST | /api/auth/reset-password/:token | public | apply reset |

### Users (`/api/users`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/users | adminOnly | list all clients |
| GET | /api/users/me | authenticate | client profile |
| POST | /api/users/me/avatar | authenticate | client avatar upload |
| PATCH | /api/users/me | authenticate | client self-update |
| GET | /api/users/:id | adminOnly | single user |
| POST | /api/users | adminOnly | create client |
| PATCH | /api/users/:id | adminOnly | update client |
| DELETE | /api/users/:id | adminOnly | delete client |
| POST | /api/users/:id/verify | adminOnly | verify client |
| POST | /api/users/:id/reject | adminOnly | reject client |
| POST | /api/users/magic-link | adminOnly | generate magic link |
| POST | /api/users/reset-password/:token | public | apply reset |

### Shipments (`/api/shipments`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/shipments | authenticate | list (client: own; admin: all) — includes `vehicle.primaryDriverId` |
| GET | /api/shipments/stats | authenticate | dashboard counts by period |
| GET | /api/shipments/:id | authenticate | single shipment |
| POST | /api/shipments | authenticate | create |
| PATCH | /api/shipments/:id/assign | adminOnly | assign driver+vehicle; sets DITUGASKAN only when from PENDING |
| PATCH | /api/shipments/:id/status | adminOnly | update status; includes departure guard + ON_DUTY lifecycle |
| POST | /api/shipments/:id/notify-driver | adminOnly | send WhatsApp via OpenWA |

### Fleet (`/api/fleet`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/fleet/drivers | adminOnly | list drivers (includes `primaryVehicle`) |
| POST | /api/fleet/drivers | adminOnly | create driver |
| PATCH | /api/fleet/drivers/:id | adminOnly | update driver |
| DELETE | /api/fleet/drivers/:id | adminOnly | delete driver |
| GET | /api/fleet/vehicles | adminOnly | list vehicles (includes `primaryDriver`) |
| POST | /api/fleet/vehicles | adminOnly | create vehicle |
| PATCH | /api/fleet/vehicles/:id | adminOnly | update vehicle |
| DELETE | /api/fleet/vehicles/:id | adminOnly | delete vehicle |
| PATCH | /api/fleet/vehicles/:id/pair-driver | adminOnly | pair driver to vehicle (1:1) |
| PATCH | /api/fleet/vehicles/:id/unpair-driver | adminOnly | unpair |

### Tracking (`/api/tracking`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/tracking/:shipmentId | authenticate | full timeline |
| POST | /api/tracking/:shipmentId/events | adminOnly | add checkpoint |
| PATCH | /api/tracking/events/:eventId | adminOnly | update checkpoint |

### Invoices (`/api/invoices`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/invoices | adminOnly | list |
| POST | /api/invoices | adminOnly | create (blocks FAILED shipments) |
| PATCH | /api/invoices/:id | adminOnly | update |
| PATCH | /api/invoices/:id/status | adminOnly | update status (SUPERADMIN can reverse) |

### Admins (`/api/admins`) — SUPERADMIN only
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/admins | requireRole(SUPERADMIN) | list admins |
| POST | /api/admins | requireRole(SUPERADMIN) | create admin (one-time temp password) |
| POST | /api/admins/:id/reset-password | requireRole(SUPERADMIN) | reset another admin's password |

### Admin Notifications (`/api/admin-notifications`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/admin-notifications | adminOnly | list |
| PATCH | /api/admin-notifications/:id/read | adminOnly | mark read |

### Files (`/api/files`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/files/:key | public | serve uploaded file (avatars, proofs) |

### Health
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/health | public | returns `{ status: "ok" }` |

---

## 9. Frontend Structure

### Pages
| Path | Component | Notes |
|---|---|---|
| `/` | LandingPage | public; client-facing |
| `/admin` | AdminDashboardPage | admin SPA shell |
| `/dashboard` | ClientDashboardPage | client SPA shell |
| `/track/:id` | tracking | public/shared |

### AdminDashboardPage sections (via tab routing)
All under `apps/web/src/pages/AdminComponents/`:

| Section | File | Status |
|---|---|---|
| Overview | OverviewSection.jsx | stats, KPI cards |
| Shipments | **ShipmentsSection.jsx** | ⚡ fully rewritten 2026-07-01 |
| Clients | ClientsSection.jsx | CRUD |
| Drivers | DriversSection.jsx | CRUD + status badges |
| Armada | ArmadaSection.jsx | CRUD + pair/unpair driver |
| Invoices | InvoicesSection.jsx | CRUD + status |
| Users | UsersSection.jsx | user management |
| Profile | AdminProfileSection.jsx | self-service password change |

### Shared Components (`AdminComponents/components/`)
| Component | Notes |
|---|---|
| AdminModal.jsx | z-index: `z-[200]` (above detail panel) — fixed 2026-07-01 |
| AdminStatusBadge.jsx | shipment: pending/assigned/in_transit/delivered/cancelled; driver/vehicle/invoice badges |
| AdminDataTable.jsx | generic sortable table |
| AdminPagination.jsx | pagination controls |
| AdminFormField.jsx | form field wrapper |
| AdminDatePicker.jsx | date picker |
| SearchableSelect.jsx | dropdown with search |

### Key shared files
| File | Notes |
|---|---|
| `apps/web/src/lib/api.js` | Central API layer — all `shipmentsAPI`, `fleetAPI`, `usersAPI`, etc. calls |
| `apps/web/src/contexts/AuthContext.jsx` | JWT read from localStorage; `useAuth()` hook |
| `apps/web/src/contexts/ToastContext.jsx` | `useToast()` → `showToast(msg, type)` |
| `apps/web/src/pages/dashboard/TrackingSection.jsx` | Shared between admin+client via `isAdmin` prop |

---

## 10. api.js Contract (critical frontend↔backend glue)

```js
// Auth
authAPI.adminLogin(data)             → POST /api/auth/admin/login
authAPI.changeAdminPassword(data)    → PATCH /api/auth/admin/me/password

// Shipments
shipmentsAPI.list(params)            → GET  /api/shipments
shipmentsAPI.getStats(period)        → GET  /api/shipments/stats
shipmentsAPI.getById(id)             → GET  /api/shipments/:id
shipmentsAPI.create(data)            → POST /api/shipments
shipmentsAPI.assign(id, data)        → PATCH /api/shipments/:id/assign  { driverId, vehicleId }
shipmentsAPI.updateStatus(id, data)  → PATCH /api/shipments/:id/status  { status }
shipmentsAPI.notifyDriver(id)        → POST /api/shipments/:id/notify-driver

// Fleet
fleetAPI.getDrivers(params)          → GET  /api/fleet/drivers
fleetAPI.addDriver(data)             → POST /api/fleet/drivers
fleetAPI.updateDriver(id, data)      → PATCH /api/fleet/drivers/:id
fleetAPI.deleteDriver(id)            → DELETE /api/fleet/drivers/:id
fleetAPI.getVehicles(params)         → GET  /api/fleet/vehicles
fleetAPI.addVehicle(data)            → POST /api/fleet/vehicles
fleetAPI.updateVehicle(id, data)     → PATCH /api/fleet/vehicles/:id
fleetAPI.deleteVehicle(id)           → DELETE /api/fleet/vehicles/:id
fleetAPI.pairDriver(vehicleId, data) → PATCH /api/fleet/vehicles/:id/pair-driver
fleetAPI.unpairDriver(vehicleId)     → PATCH /api/fleet/vehicles/:id/unpair-driver
```

---

## 11. ShipmentsSection.jsx — Current Design (post 2026-07-01 rewrite)

### Status mapping
```js
PENDING    → 'pending'    (Menunggu)
DITUGASKAN → 'assigned'   (Ditugaskan)
TRANSIT    → 'in_transit' (Dalam Perjalanan)
DELIVERED  → 'delivered'  (Terkirim)
FAILED     → 'cancelled'  (Dibatalkan — legacy fallback)
CANCELLED  → 'cancelled'  (Dibatalkan)
```

### Filter tabs
`all` · `pending` · `assigned` · `in_transit` · `delivered` · `cancelled`

### Role: SUPERADMIN
- Has a row-level "person_add" button → direct assign modal (raw driver + vehicle dropdowns, any status).
- "Update Status" button → generic status picker (all statuses except current, no FAILED offered).

### Role: OPERATIONS / SUPPORT (regular admin)
- No row-level assign button.
- "Update Status" button → per-status modal:

| Shipment rawStatus | Modal content | On confirm |
|---|---|---|
| PENDING | Radio cards of ACTIVE+paired vehicles (DriverVehicleCard) + optional "Link Shipment" checkbox | `shipmentsAPI.assign()` for shipment (+ linked if selected) → status becomes DITUGASKAN |
| DITUGASKAN | Current driver+vehicle card (read-only) + "Ganti Driver" checkbox (reveals radio cards of other ACTIVE drivers) + "Tandai driver lama tidak tersedia" checkbox (default on) | Optionally: `fleetAPI.updateDriver(oldDriverId, { status: 'UNAVAILABLE' })` + `shipmentsAPI.assign()` with new driver; then `handleStatusUpdate('TRANSIT')` |
| TRANSIT | Two buttons: Terkirim · Dibatalkan | `shipmentsAPI.updateStatus(id, { status: 'DELIVERED' or 'CANCELLED' })` |
| DELIVERED / CANCELLED | "Update Status" button hidden | — |

### Helper components (inline in ShipmentsSection.jsx)
- **`ExpiryLabel`**: takes `date` + `label`; colors red if overdue, amber if within 30 days, gray otherwise. Shows ⚠ or ⚡ icon.
- **`DriverVehicleCard`**: 2-column radio card. Col 1: driver name, phone, SIM expiry. Col 2: vehicle type, plate, STNK/KIR/service expiry. Highlighted border when selected.

### Pengganti badge
Shown in the detail panel Driver row when `shipment.driverId !== shipment.vehiclePrimaryDriverId`. Amber badge labeled "Pengganti".

### z-index layering
- Detail panel backdrop: `z-[100]`
- Detail panel: `z-[101]`
- AdminModal: `z-[200]` ← fixed this session

---

## 12. Uncommitted Changes on Disk (as of 2026-07-01 end of session)

All on branch `tier1-infra`, NOT committed, NOT pushed.

### Backend (`apps/api/`)
| File | What changed |
|---|---|
| `prisma/schema.prisma` | `DITUGASKAN` in ShipmentStatus; `Vehicle.serviceDate/chassisNumber/engineNumber`; `Vehicle.primaryDriverId @unique`; `Driver.primaryVehicle` back-rel; `ON_DUTY` in DriverStatus |
| `prisma/seed.ts` | Full reseed — 2 admins, 10 clients, 8 drivers, 9 vehicles, 13 shipments |
| `prisma/migrations/20260629175841_add_vehicle_service_chassis_engine/migration.sql` | New migration |
| `prisma/migrations/20260701130000_add_ditugaskan_status/migration.sql` | `ALTER TYPE "ShipmentStatus" ADD VALUE 'DITUGASKAN'` |
| `src/lib/statusFlow.ts` | FORWARD map updated with DITUGASKAN |
| `src/routes/shipments.ts` | assign→DITUGASKAN conditional; departure guard; ON_DUTY lifecycle; vehicle.primaryDriverId in GET; CANCELLED in notify trigger |
| `src/routes/fleet.ts` | serviceDate/chassisNumber/engineNumber persisted; service expiry compliance flag |
| `src/index.ts` | Rate limit 300→1500 req/15min |

### Frontend (`apps/web/`)
| File | What changed |
|---|---|
| `src/pages/AdminComponents/components/AdminModal.jsx` | z-index `z-[100]` → `z-[200]` |
| `src/pages/AdminComponents/components/AdminStatusBadge.jsx` | Added `assigned` shipment status (Ditugaskan, blue) |
| `src/pages/AdminComponents/ShipmentsSection.jsx` | Full rewrite (see §11) |

### Docs
| File | What changed |
|---|---|
| `DEV-PLAN.md` | Phase ②③ marked DONE; Where we are updated |
| `RUNBOOK.md` | Session logs appended (cont., cont.², cont.³) |
| `DEPLOYMENT.md` | Auth rehaul plan, rate-limit deploy notes |

---

## 13. Environment Variables

All in `apps/api/.env` (gitignored — recreate from `.env.example`):

| Key | Notes |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `CLIENT_URL` | Frontend origin (CORS) |
| `PORT` | API port (default 3001) |
| `STORAGE_DRIVER` | `local` (default) |
| `STORAGE_LOCAL_PATH` | `./uploads` |
| `OPENWA_BASE_URL` | OpenWA gateway base URL (e.g. `http://localhost:2785`) |
| `OPENWA_API_KEY` | OpenWA API key (from `data/.api-key` in the OpenWA dir) |
| `OPENWA_SESSION_ID` | OpenWA session UUID (changes when session reconnects — re-read after linking) |
| `SMTP_HOST/PORT/USER/PASS/FROM` | Email delivery (no-op when unset) |
| `ADMIN_EMAIL` | Hardcoded admin contact for WA message |
| `ADMIN_WHATSAPP` | Currently hardcoded in shipments.ts:270 — TODO: move to env |

---

## 14. Rate Limiting

- General API: **1500 req / 15 min** per IP (`/api/*`)
- Auth endpoints: **50 req / 15 min** per IP (`/api/auth/*`)
- Note: auth requests are billed to BOTH limiters (matched by both `app.use("/api/auth")` and `app.use("/api")`). Harmless now (auth not polled) but revisit if a polled `/api/auth/admin/me` check is ever added.

---

## 15. Key Gotchas / Lessons Learned

1. **Stale JWT after reseed:** `migrate reset` wipes all user/admin records. The old JWT in localStorage still looks valid (correct signature, not expired) but the admin ID it references is gone → any write hits a FK violation → 500. Always re-login after any reseed.

2. **Migration not applied → 500 on assign:** adding a new enum value to the schema is not enough. The migration must be applied (`prisma migrate deploy`) AND the Prisma client regenerated (`prisma generate`) AND the server restarted. Skipping any step → Postgres `invalid input value for enum` → 500 at runtime.

3. **Prisma 7 ADD VALUE migrations are non-transactional:** the migration SQL for new enum values must NOT use `BEGIN/COMMIT`. PostgreSQL prohibits `ALTER TYPE ... ADD VALUE` inside a transaction block.

4. **Orphaned `node` processes:** `tsx` and `vite` spawn child processes that survive normal Ctrl+C. They keep squatting on ports 3001/5173. Always kill before restarting: `Stop-Process -Name node -Force -ErrorAction SilentlyContinue`.

5. **`migrate status` lies:** it only checks recorded migrations vs the `migrations/` folder. It does NOT compare the schema against the DB. You can have "all up to date" while the schema is ahead (i.e., no migration was generated for a schema change). Always generate a migration after editing `schema.prisma`.

6. **Rate limit and polling:** the frontend polls every 8s across multiple sections (~15+ req/min idle). The old 300/15min limit got blown in ~10-13 minutes. Bumped to 1500.

7. **Frontend-ahead-of-backend pattern:** the friend often builds UI that sends fields the backend silently drops. ALWAYS grep the frontend before adding a new backend field — adopt the existing name and shape. Example: `serviceDate`/`chassisNumber`/`engineNumber` were already in the Armada UI, being silently dropped.

8. **Two-person repo etiquette:** always `git fetch` + check before any push. Never force-push `main`. The friend uses a Gemini-as-Opus agent — their commits can appear on `origin/main` unexpectedly.

9. **SUPERADMIN status:override:** SUPERADMIN can move a shipment to any status (reverse, off-flow). Regular admins are forward-only. This is enforced in `statusFlow.ts` → `canChangeStatus()` → `roleHas(role, "status:override")`.

10. **OpenWA session ID changes:** when you link a new WhatsApp session, the session ID in the OpenWA dashboard changes once the QR is scanned and the session is `ready`. Update `OPENWA_SESSION_ID` in `.env` after every re-link.

---

## 16. What's Deferred / Next

### Deferred (do not touch without discussion)
- **Auth rehaul** (localStorage → httpOnly cookies + CSRF): big coordinated task, needs friend + deploy domain finalized. Details in DEPLOYMENT.md §3.
- **Profile picture frontend** (#3): backend done; friend's UI pending. Wire `POST /api/users/me/avatar` and `POST /api/auth/admin/me/avatar` when UI lands.
- **PDF invoice generator**: parked — needs invoice layout design first.
- **Client dashboard** (new statuses): DITUGASKAN and the new status flow are client-visible. Coordinate with friend during their client-dashboard pass.
- **Gagal (FAILED) on client side**: FAILED is now legacy; the client dashboard may still reference it.

### Deferred CI / quality
- Burn down ~55 typecheck errors + ~26 lint errors, then flip `continue-on-error: false` in CI.
- `npm audit` (14 known vulns) — separate hardening task.
- Pagination on list endpoints (currently unbounded).
- Zod validation layer (one schema per route).
- `asyncHandler` + central error middleware (removes ~49 try/catch blocks).

### Likely next features
- Profile info form (fullName/email self-update) — needs `PATCH /api/auth/admin/me` endpoint.
- `#1` Cleaner notification integration.
- `#4` WhatsApp driver notify already done; `#6` client-backend integration.
- `ADMIN_WHATSAPP` env var (move hardcoded `087875387552` from `shipments.ts:270` to `.env`).

---

## 17. Build Verification

As of 2026-07-01 end of session:
- `vite build` ✓ (6.09s, no errors — only pre-existing chunk-size warnings from anime.js dynamic imports)
- `npx prisma migrate deploy` ✓ (all 6 migrations applied, including `add_ditugaskan_status`)
- `npx prisma generate` ✓ (Prisma Client 7.8.0)
- API typecheck: ~54 pre-existing errors, non-blocking (see DEV-PLAN §Decisions locked)

Server must be restarted after migration + generate for changes to take effect at runtime.

---

## 18. Resume Checklist

```bash
# 1. Confirm branch
git branch --show-current  # expect: tier1-infra
git fetch --all --prune
git status -sb             # check ahead/behind

# 2. Apply any new migrations + regenerate
cd apps/api
npx prisma migrate deploy
npx prisma generate

# 3. Start servers
cd apps/api && npx tsx src/index.ts   # :3001
cd apps/web && npm run dev            # :5173

# 4. Kill orphans when done
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
```
