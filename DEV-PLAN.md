# DEV-PLAN — resume point

> **Resuming?** Read this first, then [RUNBOOK.md](RUNBOOK.md) (sync + audit) and [CLAUDE.md](CLAUDE.md) (scope).
> Last updated: 2026-06-27.

## Where we are right now
- **Branch:** `tier1-infra` (checked out). **2 commits ahead of `main`, NOT pushed:**
  - `08c0096` — curated ECC review agents (`.claude/agents/`) + rules (`.claude/rules/`) + `npm run security:scan`
  - `a213cad` — Tier-1 dev infra: `apps/api/tsconfig.json` + `npm run typecheck`, `apps/api/test/smoke.mjs` + `npm run smoke` (26/26 green), `.github/workflows/ci.yml`
- **`main`:** clean and current (local + remote are **main-only**; all old branches deleted).
- **Working tree:** clean. A local reminder hook lives in `.claude/settings.local.json` (gitignored — reminds to run `npm run security:scan` after edits; never auto-runs).

## Decisions locked (don't redo these)
- **typecheck + web lint are NON-BLOCKING in CI on purpose.** There are ~55 `tsc` + ~26 lint pre-existing issues — all **type-friction / dead-code, NOT runtime bugs** (verified: smoke is green). Details in RUNBOOK 2026-06-27.
- **Do NOT clean up the 81 yet.** It edits many shared backend files and would merge-conflict with the friend's in-flight work. Do it in a coordinated quiet window, then flip CI `continue-on-error: false`.
- **TypeScript pin left as-is** (`apps/api` → `~5.8.3`, tooling-only; runtime uses `tsx`). Don't revert unless asked.
- **Don't push `tier1-infra` / open a PR** until the user says so.
- **Two-agent repo:** the friend uses a Gemini-as-Opus agent on the same GitHub repo. **Always pull before working** (RUNBOOK §2) and **agree on file ownership** to avoid collisions. CI/smoke are the model-agnostic safety net.

## Next steps — backend roadmap (prioritized)
Build reusable primitives first; most items depend on the same few.

**1. Quick wins (small, contained, low conflict)**
- [ ] **#9** Failed shipments must NOT appear in faktur (invoice route logic).
- [ ] **#7 (partial)** Security basics: add `helmet` + `express-rate-limit`.

**2. Reusable primitives (build once → unlocks many)**
- [ ] **File upload helper** → profile picture (#3), payment proof, tracking images, proof-of-delivery.
- [ ] **PDF generator** → invoice PDF (#5/#6) + "send invoice PDF to WhatsApp" (#5).
- [ ] **RBAC / roles helper** → super-admin vs admin (#10: super-admin can change shipment + invoice status, reset admin passwords, view internal users; admin sees clients only).

**3. Features built on the primitives**
- [ ] **#2** Reset password in profile  · **#1** cleaner notification integration  · **#4** one-time-use WhatsApp driver notify  · **#6** integrate client side to backend.

**Recommended very-next action:** quick wins (#9 + helmet/rate-limit), then the **file upload helper** (unblocks the most).

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
