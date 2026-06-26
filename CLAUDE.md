# CLAUDE.md

## Start here — every session
**Resuming / continuing work?** Read **[DEV-PLAN.md](DEV-PLAN.md)** first — current state, locked decisions, and the prioritized next steps.

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
