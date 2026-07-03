# CLAUDE.md

## Start here — every session

> **READ THIS FIRST, BEFORE ANYTHING ELSE:**
> **[context.md](context.md)** — the single most complete snapshot of the project: full schema, all routes, all uncommitted changes, status flow spec, driver-vehicle pairing model, every gotcha, and the resume checklist. If you read nothing else, read this.

**Resuming / continuing work?** After context.md, read **[DEV-PLAN.md](DEV-PLAN.md)** — current state, locked decisions, and prioritized next steps.

Before doing any work, read **[RUNBOOK.md](RUNBOOK.md)** in full and follow it:
sync (§2) → integration audit (§3) → **report findings before editing** → append a
dated **Session Log** entry (§5) before finishing.

**Scope:** admin dashboard only. Do not modify the client-facing side — note client
implications for follow-up instead. Don't break shared contracts (schema, shared
routes, `api.js`, `AuthContext`, `TrackingSection`). Never force-push `main`.

## Coding standards & review agents (from ECC, curated)
Follow the coding/security standards in **[.claude/rules/](.claude/rules/)** for TypeScript
(`typescript/`), React (`react/`), and cross-cutting (`common/`) work.

Specialist review subagents live in `.claude/agents/` — invoke them for focused review:
`code-reviewer`, `typescript-reviewer`, `react-reviewer`, `security-reviewer`,
`database-reviewer` (Postgres/Prisma), `build-error-resolver`. (No auto-run hooks were added.)

Config-hygiene scan (agent setup, secrets, MCP): `npm run security:scan` (runs AgentShield).
This is NOT app-security — rate limiting / helmet / input validation / `npm audit` are
separate deployment-hardening tasks.
