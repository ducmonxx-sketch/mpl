# Admin/backend fix plan — execution handoff

> Written 2026-09-22 by the audit session (Opus), designed to be executed by ANY model.
> Parent doc: [client-deployment.md](../../client-deployment.md) (packages 4·6·5·8·9 = this file).
> Packages 1–3 are the friend's client rehaul — **do not touch the client dashboard here.**
>
> **How to use this file:** work top-to-bottom, one package per commit (4 may be several).
> Every fix has: Problem → Locate (grep anchor, NOT a bare line number — lines drift) →
> Change → Verify → after the package: run the FULL LOOP (below), tick the checkbox in
> client-deployment.md, update the affected `docs/pages/*.md`, commit.
> Where a judgment call could arise, the decision is **pre-made** in the fix. Only the
> items explicitly marked **ASK USER** need a question.

## Ground rules (from CLAUDE.md — re-read it first)
- Read `context.md`, then the page doc in `docs/pages/` for every page you touch.
- Admin scope only. `TrackingSection.jsx` is SHARED — gate anything UI-visible behind `isAdmin`.
- Don't break shared contracts: `schema.prisma`, shared routes, `api.js`, `AuthContext`.
- **Additive API changes only** where the client also consumes the route (`/stats`, tracking).
- Never force-push `main`. Pull before working (two-agent repo). Commit per package; push only on explicit user OK.
- End of session: RUNBOOK §6 session-log entry.

## FULL LOOP (run after every package)
```
cd apps/api && npm run typecheck        # baseline 0 errors — keep it 0
cd apps/api && npm run smoke            # baseline 50/50 (self-cleaning; needs API running)
cd apps/web && npx vite build           # must stay green
```
Server for smoke: `cd apps/api && npx tsx src/index.ts` (background). Seed if needed:
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=1 npx prisma migrate reset --force` then
`npx prisma db seed` (reset does NOT reliably auto-seed). Seed accounts: `admin@mpl.com`,
`admin2@mpl.com` (OPERATIONS), `armada@`, `pabrik@`, `gudang@` — all `<name>1234`, admin2 uses
`admin1234`. Seed creates NO clients/shipments; smoke bootstraps its own.

---

# PACKAGE 4 — broken admin actions (4 commits ok, or one)

## 4a. WhatsApp notify button never renders
- **Problem:** the render gate compares the *display* status (lowercase, e.g. `pending`) against raw enums, so the block is unreachable.
- **Locate:** `apps/web/src/pages/AdminComponents/ShipmentsSection.jsx`, grep `Kirim Notifikasi WhatsApp Driver`. A few lines above it: `selectedShipment.status === 'PENDING' || selectedShipment.status === 'DITUGASKAN'`.
- **Change:** `selectedShipment.status` → `selectedShipment.rawStatus` in that condition (both operands' object, keep the enum strings).
- **Verify:** in the running app (or by reading `mapShipment`: `status: mapStatus(s.status), rawStatus: s.status`) confirm `rawStatus` holds the enum. Open a DITUGASKAN shipment's detail panel → button renders. No API change.

## 4b. ClientsSection: PIC edit clobbers the name + company rename splits the company
- **Problem 1:** grep `'Admin Perusahaan'` in `apps/web/src/pages/AdminComponents/ClientsSection.jsx` — `handleUpdateClient` hardcodes `fullName: 'Admin Perusahaan'`, silently renaming any PIC you edit.
- **Change 1:** the edit modal must carry the PIC's real name: add `editFullName` state seeded from the selected user (`setEditFullName(u.fullName)` wherever the modal opens — grep the handler that sets the other `edit*` states), render an `AdminFormField label="Nama PIC"` text input alongside the existing fields, send `fullName: editFullName.trim()` in the PATCH. Do not touch other payload fields.
- **Problem 2:** renaming `companyName` PATCHes only the one user row → that PIC leaves the group, siblings keep the old company.
- **Change 2 (backend, pre-decided):** new endpoint in `apps/api/src/routes/users.ts`:
  ```ts
  // PATCH /api/users/company-rename  { from: string, to: string }
  // Renames a company across ALL its PICs (updateMany). clientManagerOnly.
  router.patch("/company-rename", authenticate, clientManagerOnly, async (req, res) => {
    const { from, to } = req.body
    if (!from?.trim() || !to?.trim()) return res.status(400).json({ message: "from/to wajib diisi." })
    const r = await prisma.user.updateMany({ where: { companyName: from }, data: { companyName: to.trim() } })
    await prisma.adminAuditLog.create({ data: { adminId: req.user!.id, actionType: "UPDATE_USER",
      targetTable: "users", targetRecordId: from, changesSummary: `Renamed company "${from}" -> "${to}" (${r.count} accounts)` } })
    res.json({ updated: r.count })
  })
  ```
  ⚠️ Mount it BEFORE any `/:id` route in that file or Express will treat `company-rename` as an id (check route order; the magic-link routes show the pattern). Reuse the exact `clientManagerOnly` guard already in the file.
  Frontend: `usersAPI.renameCompany = (from, to) => api.patch('/api/users/company-rename', { from, to })` in `apps/web/src/lib/api.js`; in `handleUpdateClient`, when the company name changed, call it INSTEAD of putting `companyName` in the per-user PATCH.
- **Verify:** smoke stays green; probe: create 2 PICs under "SmokeCo2" via `POST /users`, rename via new endpoint, `GET /users` shows both moved; audit log row exists. Clean the 2 users up after (DELETE).

## 4c. SUPPORT's dead/broken fallback status flows
- **Problem:** SUPPORT's "Konfirmasi Keberangkatan" sends DITUGASKAN→TRANSIT; server forward map (`apps/api/src/lib/statusFlow.ts`, grep `DITUGASKAN`) only allows →AT_PLANT, and AT_PLANT is PIC_PABRIK/override-gated → SUPPORT always 403s. Its PENDING-assign fallback also swallows errors (empty `catch`), and its Ganti-Driver UI collects state that is never sent.
- **Pre-made decision:** SUPPORT becomes **read-only on statuses** (it has `[]` permissions in `lib/rbac.ts`; there is no forward move it may legally make — verify by reading `canChangeStatus` in `statusFlow.ts` before deleting; if you find SUPPORT *can* make some move, keep that one flow and retarget the modal to it — then **ASK USER** which they prefer).
- **Change:** in `ShipmentsSection.jsx` `canUpdateStatus` (grep `const canUpdateStatus`), make the generic fallback branch return `false` for SUPPORT (`if (role === 'SUPPORT') return false`). Then delete the now-dead SUPPORT fallback branches in `handleConfirmStatus` and `renderModalContent` (grep `Fallback` comments), incl. the unused `newDriverVehicleId` + empty-catch block.
- **Verify:** grep the deleted state setters for zero remaining references; build green; log in as a SUPPORT account if one exists (seed has none — creating one via Prisma is optional; static verification acceptable).

## 4d. Admin Profil page is fake (mock activity + simulated save)
- **Problem:** `apps/web/src/pages/AdminComponents/AdminProfileSection.jsx` — grep `Simulasi` (the no-op save) and grep `setTimeout` (mock activity rows).
- **Change (backend, two small pieces):**
  1. **Self-serve activity:** in `apps/api/src/routes/auditLogs.ts`, allow ANY admin to read *their own* log: replace the single `requirePermission("admin:manage")` gate with a handler-level check — if `req.query.adminId === req.user.id` allow; otherwise require the permission (import `roleHas` from `lib/rbac` or keep `requirePermission` and add a second route `GET /api/audit-logs/me` that forces `adminId = req.user!.id` — **pick the `/me` route variant; it's simpler and can't leak**). Add `auditLogsAPI.mine = (params) => api.get('/api/audit-logs/me', params)` in api.js.
  2. **Profile self-update:** in `apps/api/src/routes/auth.ts` next to `GET /admin/me` (grep `admin/me`), add `PATCH /admin/me` accepting `{ fullName?, phoneNumber? }` — Zod-validate (see `lib/validate.ts` patterns; strings 1–100 chars), update via `prisma.admin.update`, write an `adminAuditLog` row (`actionType: "UPDATE_ADMIN"`), return the fresh admin (same shape as GET /admin/me). Check `schema.prisma` `model Admin` for which fields exist — do NOT invent columns.
- **Change (frontend):** replace the mock activity fetch with `auditLogsAPI.mine({ limit: 10 })` rendering the same list shape as OverviewSection's feed (reuse its `humanizeAction` approach or copy the minimal formatter); replace the simulated save with the real PATCH + toast on success/failure.
- **Verify:** typecheck 0; probe with cookies (copy the pattern from `test/smoke.mjs`): PATCH /admin/me changes the name (GET reflects it), GET /audit-logs/me returns rows for that admin only. Add BOTH probes to `test/smoke.mjs` as new PASS lines (keep it self-cleaning: rename back).

## 4e. `/assign` skips the fleet mirror
- **Problem:** `apps/api/src/routes/shipments.ts` — the `/assign` handler (grep `"/:id/assign"`) updates driver/vehicle (+PENDING→DITUGASKAN) but never mirrors fleet statuses; driver/vehicle stay ACTIVE/AVAILABLE.
- **Change (exact algorithm — order matters):**
  ```ts
  // BEFORE the update: const prev = await prisma.shipment.findUnique({ where:{id}, select:{ driverId:true, vehicleId:true, status:true } })
  // AFTER the update (updated = the new row):
  const { mirrorFleetStatus, releaseFleetIfUnused } = require-them-from "../lib/shipmentStatus" (already imported in this file — check)
  // 1. old pair changed? free it (group-aware — only if no other OCCUPYING shipment uses it)
  if (prev?.driverId && prev.driverId !== updated.driverId)   await releaseFleetIfUnused(prev.driverId, null)
  if (prev?.vehicleId && prev.vehicleId !== updated.vehicleId) await releaseFleetIfUnused(null, prev.vehicleId)
  // 2. engage the new pair per the updated shipment's status (handles STANDBY + DITUGASKAN both)
  await mirrorFleetStatus(updated.status, updated.driverId, updated.vehicleId, updated.id)
  ```
  Read `lib/shipmentStatus.ts` first: `releaseFleetIfUnused(driverId?, vehicleId?)` signature and `mirrorFleetStatus(status, driverId, vehicleId, shipmentId)`; both already group-aware. Place AFTER the existing sibling-mirror `updateMany` (linked shipments get the same pair, so one engage covers the group).
- **Verify (add to smoke):** after the existing `PATCH /shipments/:id/assign` PASS line, GET the driver and assert `status === 'ON_DUTY'` (shipment went PENDING→DITUGASKAN). The existing trip-1 DELIVERED release + trip-2 depart already regression-test the release path.

---

# PACKAGE 6 — KPI correctness (one commit)

- **Problem:** Beranda "Pengiriman Aktif" = `stats.transit` where `/stats` (a) counts only TRANSIT and (b) windows on `createdAt` last-month → in-flight shipments older than the window vanish. "X menunggu" counts drivers via stale status logic.
- **Constraint:** `GET /api/shipments/stats` is consumed by the CLIENT dashboard too → **additive only**.
- **Change (backend):** in the `/stats` handler (`routes/shipments.ts`, grep `"/stats"`), add one more parallel count, **unwindowed** (no `createdAt` filter, but keep the client scoping `where` for non-admins):
  ```ts
  prisma.shipment.count({ where: { ...(isAdmin?{}:{clientId:req.user!.id}),
    status: { in: ["STANDBY","DITUGASKAN","AT_PLANT","TRANSIT","DITERIMA","DITURUNKAN"] } } })
  ```
  Return it as a NEW field `active` (leave every existing field untouched).
- **Change (frontend `OverviewSection.jsx`):** grep `activeShipments` — set it from `stats.active`; grep `unassignedDrivers` / `menunggu` — replace the shipment-scan with a fleet-derived count: the section already fetches drivers (check; if not, `fleetAPI.getDrivers()` is one call) → `drivers.filter(d => d.status === 'ACTIVE').length` labelled as available/waiting.
- **Update the doc:** `docs/pages/admin-overview.md` KPI row.
- **Verify:** liveish reseed gives known truth: 6 ongoing (2 STANDBY, 1 DITUGASKAN, 1 AT_PLANT, 1 TRANSIT, 1 DITERIMA) → `active` = 5 or 6 depending on whether DITURUNKAN/DITERIMA rows exist — compute from the seed distribution and assert the exact number via a probe. Add a smoke line: `GET /shipments/stats` response has numeric `active`.

---

# PACKAGE 5 — fleet + tracking integrity (one commit, or two: fleet/tracking)

## 5a. Fleet delete guards
- **Locate:** `apps/api/src/routes/fleet.ts`, the driver DELETE and vehicle DELETE handlers (grep `router.delete`).
- **Change:** before deleting, check for an OCCUPYING shipment (same list as `lib/shipmentStatus.ts` `OCCUPYING` — import it or re-declare identically): `prisma.shipment.findFirst({ where: { driverId: id, status: { in: OCCUPYING } } })` → if found, `409 { message: "Driver sedang terpakai di pengiriman <id>. Selesaikan atau pindahkan dulu." }` (same for vehicle). Export `OCCUPYING` from `lib/shipmentStatus.ts` if not already exported.
- **Verify (smoke):** the suite already creates driver+vehicle and runs a shipment; add a probe that tries DELETE mid-pipeline expecting 409, and keep the final cleanup delete AFTER the shipment finishes (it already is — cleanup order: shipments first).

## 5b. Vehicle PATCH duplicate-plate check
- **Locate:** fleet.ts vehicle PATCH (grep `licensePlate` in the update handler vs the create handler — create has a uniqueness pre-check, PATCH doesn't).
- **Change:** if `licensePlate` present in body and differs from current, `findFirst({ where: { licensePlate, id: { not: id } } })` → 409 with a clear message. (Alternative accepted: catch P2002 via `lib/prismaErrors.ts` if it has a helper — read it; prefer whichever pattern that file already uses.)

## 5c. Manual status edits stomping the mirror
- **Pre-made decision (minimal):** only guard the DANGEROUS direction — freeing a resource that's still in use. In driver PATCH and vehicle PATCH: if body sets status to `ACTIVE`/`AVAILABLE` while an OCCUPYING shipment references them → 409 "masih terpakai di pengiriman <id>". Setting UNAVAILABLE/MAINTENANCE stays allowed (that's the substitute-driver escape hatch). Do NOT build a full transition matrix.
- Frontend (optional, same commit): in `DriversSection.jsx`/`ArmadaSection.jsx` edit modals, disable the "Tersedia" option when current status is ON_DUTY/IN_USE with a title tooltip. Cosmetic; backend is the gate.

## 5d. Tracking fixes (SHARED component — gate admin-only behavior)
Read `docs/pages/tracking-shared.md` first. All in `apps/web/src/pages/dashboard/TrackingSection.jsx` + `apps/api/src/routes/tracking.ts`.
1. **Poll re-opens closed panel:** grep `initialSearchQuery` inside the fetch function — the auto-select runs on every 8s poll. Fix: `const autoSelectedRef = useRef(false)`; only auto-select when `!autoSelectedRef.current`, set it true after; reset it in the effect that watches `initialSearchQuery` changing. Pure bugfix, both dashboards benefit (noted in client-deployment.md handoff note 3).
2. **Proof photo wiped:** grep `proofPhoto: null` — the status-change payload always nulls it. Fix: omit the field unless explicitly changing it (send `proofPhoto: undefined` / drop the key); check the backend handler treats absent ≠ null (Prisma `undefined` skips the column — verify the route builds `data` with spread-if-present; adjust if it passes the raw body field through).
3. **Stale timeline after add-event:** grep `handleAddEvent` — after the POST succeeds, also re-fetch the timeline for the selected shipment (the same fetch used on select — extract/reuse it).
4. **Backend PATCH events:** in `tracking.ts` (grep `events/:eventId` or the PATCH handler): add existence check → 404 (use `lib/prismaErrors.ts` pattern), and write an `adminAuditLog` row (`actionType: "UPDATE_SHIPMENT_EVENT"`, mirror the POST handler's fields).
- **Verify:** smoke already PATCHes an event (200 path). Add a probe: PATCH a bogus event id → 404. UI fixes: `vite build` + manual click-through if a browser is available; otherwise static verification + note in the session log.

---

# PACKAGE 8 — dead-code sweep + real pagination (one commit)

Pure deletion + small fixes. For EVERY deletion: `grep` the symbol repo-wide first; delete only on zero remaining references. Build after each file.

**Fix (not delete):**
- `AdminDashboardPage.jsx` grep `'Super Admin'` — the `displayRole` fallback never matches enum checks. Change fallback to `'SUPERADMIN'` and pass `userRole` in the `default:` nav case (grep `default:` in the switch).
- Real pagination: `ClientsSection.jsx` (grep `totalPages={1}`), `ArmadaSection.jsx` + `DriversSection.jsx` (grep `AdminPagination`) — compute `totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))` and render the sliced page (`filtered.slice((page-1)*N, page*N)`), copying the exact pattern from ShipmentsSection.

**Delete (verify-then-delete each):**
- `ShipmentsSection.jsx`: `SERVICE_LABELS`, `STATUS_OPTIONS` (module consts, zero importers), `STATUS_SORT_RANK` (sorting moved server-side — confirm no local sort uses it), handover leftovers `serahTerimaUrl`/`handoverNotes`/`vehicleCondition`/`lkuNumber`/`pabrikNotes` (state set/reset but never read — grep each), the unreachable KEPALA_ARMADA PENDING branch (grep `KEPALA_ARMADA' && rawStatus === 'PENDING'` — confirm `canUpdateStatus` still limits KA to STANDBY first).
- `TrackingSection.jsx`: `handleUpdateStatus` (dead; the select uses `handleStatusSelectChange`).
- `api.js`: `usersAPI.reject`, `usersAPI.getCompanies`, `trackingAPI.updateEvent` — ⚠️ smoke calls `PATCH /tracking/events/:id` directly (keep the BACKEND route; only the unused frontend fn goes). ⚠️ `getCompanies`: grep first — if 4b wiring or any dropdown started using it, keep.
- `ArmadaSection.jsx`: unused `useRef`/static `anime`/`AdminStatusBadge` imports, `VEHICLE_STATUS_BADGE_MAP`, the dynamic `import('../../lib/api')` (static import exists), `serviceNotes` modal field (collected, never sent — either wire it into the PATCH payload (1 line, backend accepts?) — read fleet.ts; if the column doesn't exist, delete the field).
- `DriversSection.jsx`: `detailPanelRef`.
- `OverviewSection.jsx`: the empty `useEffect(..., [loading])`.
- Empty `catch {}` blocks flagged in the audit: add `showToast(err.message, 'error')` minimum (repo rule: never swallow).

**Verify:** FULL LOOP; grep `eslint` — `npm run lint` exists in apps/web; run it, fix only NEW warnings you introduced.

---

# PACKAGE 9 — dependency vulns (SEPARATE session, needs manual retest)
`npm audit` = 30 (1 critical: jsPDF path traversal — the Surat Jalan export uses it). Plan: `npm audit fix` first (non-breaking), then targeted `jspdf`/`jspdf-autotable` major bump; retest Surat Jalan PDF + the xlsx history export MANUALLY in the browser. Don't run `audit fix --force` blind. **ASK USER before this package** (it can churn lockfiles for both apps).

---

# Definition of done (whole plan)
- [ ] Packages 4, 6, 5, 8 committed (typecheck 0 · smoke ≥50/50 incl. the NEW probes added in 4d/4e/5a/5d/6 · build green · lint no new warnings)
- [ ] client-deployment.md checkboxes ticked with dates
- [ ] Affected `docs/pages/*.md` updated in the same commits (CLAUDE.md rule)
- [ ] RUNBOOK §6 session log appended
- [ ] Nothing pushed without explicit user OK
- [ ] Package 9 proposed to the user, not started
