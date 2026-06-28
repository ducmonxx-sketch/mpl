# DEV-PLAN — resume point

> **Resuming?** Read this first, then [RUNBOOK.md](RUNBOOK.md) (sync + audit) and [CLAUDE.md](CLAUDE.md) (scope).
> Last updated: 2026-06-28.

## Where we are right now
- **Branch:** `tier1-infra` (checked out), **NOT pushed** (per lock). Commits ahead of `main`: Tier-1 infra (`08c0096` agents/rules, `a213cad` tsconfig/smoke/CI) + this session:
  - `d81c9db` quick wins (#9 + #7 helmet/rate-limit) · `5e21f8f` DEPLOYMENT.md · `1789e45` auth-rehaul deferred note
  - `a9f20f5` file-upload storage primitive (Tier-2) · `48a9e50` profile pictures #3 (backend) · **RBAC helper IN PROGRESS**
- **`main`:** behind `tier1-infra`; origin has only `main` + `tier1-infra`.
- **DB:** migration `add_avatar_key` applied locally → friend needs `npx prisma migrate deploy` on pull.
- **New `apps/api` deps:** helmet, express-rate-limit, multer → friend needs `npm install` on pull.
- **Working tree:** clean. Local reminder hook in `.claude/settings.local.json` (gitignored).

## Decisions locked (don't redo these)
- **typecheck + web lint are NON-BLOCKING in CI on purpose.** There are ~55 `tsc` + ~26 lint pre-existing issues — all **type-friction / dead-code, NOT runtime bugs** (verified: smoke is green). Details in RUNBOOK 2026-06-27.
- **Do NOT clean up the 81 yet.** It edits many shared backend files and would merge-conflict with the friend's in-flight work. Do it in a coordinated quiet window, then flip CI `continue-on-error: false`.
- **TypeScript pin left as-is** (`apps/api` → `~5.8.3`, tooling-only; runtime uses `tsx`). Don't revert unless asked.
- **Don't push `tier1-infra` / open a PR** until the user says so.
- **Two-agent repo:** the friend uses a Gemini-as-Opus agent on the same GitHub repo. **Always pull before working** (RUNBOOK §2) and **agree on file ownership** to avoid collisions. CI/smoke are the model-agnostic safety net.
- **Auth storage rehaul is DEFERRED to a dedicated, coordinated session** (pre-launch hardening) — do NOT do it piecemeal. Moving JWT from localStorage → httpOnly cookies + CSRF touches **shared client+admin contracts** (`api.js`, `AuthContext`, `middleware/auth.ts`, auth routes), and cookie config depends on final deploy domains. Full phased plan + rationale in **[DEPLOYMENT.md](DEPLOYMENT.md) §3**. Backend Phase 1 (cookie alongside body token + dual-read) is non-breaking and can go first; the frontend cutover needs friend coordination. Known gaps to close then: `api.js` missing `credentials:'include'`, and no admin `/me` endpoint.

## Next steps — backend roadmap (prioritized)
Build reusable primitives first; most items depend on the same few.

**1. Quick wins** — ✅ DONE
- [x] **#9** Failed shipments excluded from faktur (invoices.ts POST guard).
- [x] **#7 (partial)** Security basics: `helmet` + `express-rate-limit`.

**2. Reusable primitives (build once → unlocks many)**
- [x] **File upload helper** ✅ — StorageAdapter + LocalAdapter + multer + `saveUpload` (pluggable to cloud later).
- [ ] **PDF generator** → ⏸ **PARKED — needs design first** (see Parked / handoffs below).
- [ ] **RBAC / roles helper** → super-admin vs admin (#10) — full design in [RBAC-PLAN.md](RBAC-PLAN.md). ← **IN PROGRESS** (piece 1: status state machine + audit)

**3. Features built on the primitives**
- [~] **#3 profile picture** — backend ✅ (admin + client); **FRONTEND PENDING** (see Parked / handoffs).
- [ ] **#2** Reset password in profile · **#1** cleaner notification integration · **#4** one-time-use WhatsApp driver notify · **#6** integrate client side to backend.

**Recommended very-next action:** RBAC helper (#10), then features #2/#1/#4.

## Parked / handoffs
- **#3 profile picture — FRONTEND PENDING (waiting on friend's UI).** Backend done & verified; wire when UI lands:
  - Client: `POST /api/users/me/avatar` (multipart, field `file`) → `{ avatarUrl }`; `GET /api/users/me` now returns `user.avatarUrl`.
  - Admin: `POST /api/auth/admin/me/avatar` (multipart, field `file`) → `{ avatarUrl }`; new `GET /api/auth/admin/me` → `admin.avatarUrl`.
  - Display: `<img src={API_BASE + avatarUrl}>` (public `/api/files/...`). Upload via **FormData**, do NOT set `Content-Type` (the JSON `api.post` wrapper won't work — needs a small FormData helper in `api.js`). Limits: JPG/PNG/WEBP ≤5 MB.
- **PDF generator — PARKED, needs design first.** Don't build until the invoice/PDF layout is decided (ties to frontend faktur item #6: "view details = total + notes only, no tax"). Then pdfkit/pdf-lib → invoice PDF + send-to-WhatsApp (#5).

## Dev-infrastructure tiers (accelerators — how we go faster)
Velocity/safety investments, separate from feature work. Tier-2 primitives overlap with the backend roadmap above — build the primitive once and many features speed up.

**Tier 1 — Safety nets — ✅ DONE (this branch)**
- ✅ `apps/api/tsconfig.json` + `npm run typecheck`
- ✅ GitHub Actions CI (Postgres → prisma generate/migrate/seed → typecheck → web build → web lint → smoke)
- ✅ Committed smoke test (`apps/api/test/smoke.mjs`, `npm run smoke`, 26/26)
- ⏳ Follow-up: burn down the ~81 type/lint issues, then flip CI typecheck + lint to **blocking**.

**Tier 2 — Reusable primitives (build once, reused everywhere)**
- [x] **File upload + storage helper** ✅ (multer→local; pluggable to Supabase/S3) → profile pic (#3 ✅ backend), payment proof, tracking images, proof-of-delivery
- [ ] **PDF generator** (pdfkit / pdf-lib) → invoice PDF + send-to-WhatsApp (#5) — ⏸ parked, needs design
- [ ] **Zod validation layer** (one schema per route) → every endpoint: input validation + inferred types + consistent 400s
- [ ] **`asyncHandler` wrapper + central error middleware** → removes ~49 repetitive try/catch blocks; uniform errors
- [ ] **RBAC / permission helper** (matrix over existing `requireRole`) → super-admin vs admin (#10) — **IN PROGRESS**

**Tier 3 — Hardening & quality-of-life**
- [x] **helmet + express-rate-limit** ✅ → security basics (#7), shipped with the quick wins
- [ ] **Structured logger (pino)** → faster debugging; replaces `console.error` (also fixes the buffered background-log pain)
- [ ] **`predev` script** that frees :3001 / kills orphaned node before start (we hit orphan-process traps repeatedly)
- [ ] **Shared types between `apps/web` and `apps/api`** → permanently kills frontend/backend drift (strategic fix)

**Further (once the basics are in)**
- [ ] Flip CI typecheck + web lint to **blocking** (after the ~81 cleanup).
- [ ] **Pagination** on list endpoints (`/users`, `/shipments`, `/fleet/*`, `/invoices`) — currently unbounded.
- [ ] Tests beyond smoke: unit/integration for business logic (points/totals, status transitions, auth).
- [ ] `npm audit` in CI + a pre-commit hook running typecheck/lint locally.
- [ ] Optional: error tracking (Sentry) + basic request logging/metrics.

## Full roadmap (the friend + user's original list — reference)
**Backend (focus):**
1. Cleaner notification integration · 2. Reset password in profile · 3. Profile picture change · 4. Notify driver via WhatsApp, one-time-use · 5. Send PDF invoice to WhatsApp · 6. Integrate client side to backend · 7. Security, rate limiter, etc. · 8. Bug: pengiriman section opens shipment detail without clicking (mostly frontend) · 9. Failed shipments excluded from faktur · 10. Super-admin vs admin roles.

**Frontend (handled later / by friend):**
1. Faktur: payment-term dropdown, dynamic payment rows (nominal + proof image, auto cross-check vs total, auto-complete when fully paid, "sisa pembayaran" display) · 2. Sync icons on Pengguna page · 3. Lock canvas · 4. Wrong creds stay on admin login page · 5. Mandatory image input on Pelacakan · 6. Invoice edit form + PDF gen; view-details payment = total + notes only, no tax · 7. Progress image preview on Pelacakan · 8. Apply-status button + confirm box on shipment status · 9. Redesign 404 page · 10. Client dashboard rehaul · 11. Rework shipment form (origin/destination address + Gmaps links; drop ETA) · 12. Client password reset (via magic link, admin dashboard) · 13. Unify "view details" design across driver/client/faktur/pengguna · 14. Notification delete (x) button once read.

## How to resume (checklist)
1. Open a session in `g:\Programming\mpl` (CLAUDE.md auto-loads).
2. Confirm branch: `git branch --show-current` → expect `tier1-infra`.
3. Sync per RUNBOOK §2 (`git fetch`, check vs `origin/main`, pull/merge as needed). Re-run `npm install` + `npx prisma generate` if backend deps/schema changed.
4. Pick the next unchecked item above. Coordinate file ownership with the friend's agent.
5. Before finishing: append a RUNBOOK Session Log entry and tick items here.
