# Page docs — MPL dashboards

One doc per dashboard page: what it does, its endpoints, load-bearing state, cross-page
couplings, gotchas, and a "how to add a feature cleanly" checklist with line-cited render
regions. Written 2026-09-22 from an audit of `main` @ `ba48b2c`. **If a page changes
materially, update its doc in the same commit.**

## Admin dashboard (`/admin/dashboard`, `AdminDashboardPage.jsx`)

| Nav id | Page | Doc |
|---|---|---|
| `overview` | Beranda — KPIs, activity feed, charts | [admin-overview.md](admin-overview.md) |
| `laporan` | Laporan — condition analytics + drill-down | [admin-laporan.md](admin-laporan.md) |
| `shipments` | Pengiriman — the status-pipeline hub | [admin-shipments.md](admin-shipments.md) |
| `clients` | Klien — companies + PIC management | [admin-clients.md](admin-clients.md) |
| `drivers` | Driver — driver CRUD + SIM compliance | [admin-drivers.md](admin-drivers.md) |
| `armada` | Armada — vehicle CRUD, pairing, docs expiry | [admin-armada.md](admin-armada.md) |
| `users` | Admin accounts (SUPERADMIN oversight) | [admin-users.md](admin-users.md) |
| `profile` | Profil — avatar, password, sessions | [admin-profile.md](admin-profile.md) |
| `tracking` | Pelacakan (shared component) | [tracking-shared.md](tracking-shared.md) |

## Client dashboard (`/client/dashboard`, `ClientDashboardPage.jsx`)

⚠️ Client pages are **shared contracts** — admin-scope sessions must not modify them
(note implications for follow-up instead; see CLAUDE.md).

| Nav id | Page | Doc |
|---|---|---|
| `dashboard` | Dashboard — stats + chart | [client-dashboard.md](client-dashboard.md) |
| `shipments` | Pengiriman Saya (+ CreateShipmentModal) | [client-shipments.md](client-shipments.md) |
| `tracking` | Pelacakan (same shared component) | [tracking-shared.md](tracking-shared.md) |
| `history` | Riwayat + Excel export + receipt | [client-history.md](client-history.md) |
| `settings` | Pengaturan (largely a stub) | [client-settings.md](client-settings.md) |

## Reading order for a new session
1. [context.md](../../context.md) — schema, routes, status flow (project root)
2. The doc for the page you're touching (above)
3. [RUNBOOK.md](../../RUNBOOK.md) §6 newest session logs
