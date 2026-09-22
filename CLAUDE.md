# CLAUDE.md

## Start here — every session

> **READ THIS FIRST, BEFORE ANYTHING ELSE:**
> **[context.md](context.md)** — the single most complete snapshot of the project: full schema, all routes, all uncommitted changes, status flow spec, driver-vehicle pairing model, every gotcha, and the resume checklist. If you read nothing else, read this.

**Resuming / continuing work?** After context.md, read **[DEV-PLAN.md](DEV-PLAN.md)** — current state, locked decisions, and prioritized next steps.

Before doing any work, read **[RUNBOOK.md](RUNBOOK.md)** — the §1–§5 cookbook + the
newest §6 Session Log entries (older logs live in `RUNBOOK-ARCHIVE.md`; read only if you
need history) — and follow it: sync (§2) → integration audit (§3) → **report findings
before editing** → append a dated **Session Log** entry (§5) before finishing.

**Scope:** admin dashboard only. Do not modify the client-facing side — note client
implications for follow-up instead. Don't break shared contracts (schema, shared
routes, `api.js`, `AuthContext`, `TrackingSection`). Never force-push `main`.

> **Exception (2026-09-22, user-approved):** the Phase-2f auth cutover may touch the
> client-facing side — `api.js`, `AuthContext`, and the client login/registration forms.
> Cookie auth cannot be finished without them. ⚠️ These are the highest-collision files in
> the repo, so coordinate with the friend's agent before further edits there.
>
> **Temporary exception (2026-09-15, user-approved):** landing-page SEO work
> (robots.txt, sitemap.xml, meta tags) in `apps/web` is in scope until this
> exception is removed. All other client-facing-side restrictions still apply.

## Coding standards & review agents (from ECC, curated)
Follow the coding/security standards in **[.claude/rules/](.claude/rules/)** for TypeScript
(`typescript/`), React (`react/`), and cross-cutting (`common/`) work.

Specialist review subagents live in `.claude/agents/` — invoke them for focused review:
`code-reviewer`, `typescript-reviewer`, `react-reviewer`, `security-reviewer`,
`database-reviewer` (Postgres/Prisma), `build-error-resolver`. (No auto-run hooks were added.)

Config-hygiene scan (agent setup, secrets, MCP): `npm run security:scan` (runs AgentShield).
This is NOT app-security — rate limiting / helmet / input validation / `npm audit` are
separate deployment-hardening tasks.

## Frontend/design skills (migrated from Antigravity, curated)
Skills below live in **[.claude/skills/](.claude/skills/)** (each a `SKILL.md`) and are
auto-loaded by name/description match, or invoke explicitly via the Skill tool. They
apply to **admin dashboard UI work only** — scope in §"Start here" still governs; do not
use them to touch the client-facing landing page.

- **Structure & standards:** `frontend-design` → `frontend-dev-guidelines` →
  `senior-frontend` → `frontend-developer` — layout/architecture decisions and
  React/Next/TS conventions for new components or pages.
- **Visual, components & motion:** `ui-ux-pro-max` → `ui-ux-designer` →
  `antigravity-design-expert` → `animejs-animation` → `shadcn` — color/typography/
  component choices and micro-interactions. Cross-reference dashboard color tokens
  (`--dash-primary` `#002442`, `--dash-secondary` `#fec330`, defined in
  `apps/web/src/index.css`) rather than inventing new hex values.
- **Scaffolding:** `frontend-mobile-development-component-scaffold` — generating a new
  component with tests/types already wired up.
- **Validation:** `ui-visual-validator` — pixel/accessibility check after a UI change,
  before calling it done.
- **Meta:** `antigravity-skill-orchestrator` — use when a task might need several of the
  above and you want help picking which, instead of loading all of them.

**Out of scope here:** `seo-audit`, `seo-aeo-landing-page-writer`,
`seo-aeo-meta-description-generator`, `seo-aeo-schema-generator` target the public
landing page, not the dashboard. Don't invoke them for dashboard work; note SEO
implications for follow-up instead, per the client-facing-side rule above.
