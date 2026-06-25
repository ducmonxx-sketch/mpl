# PT Mahkota Putra Logistik (MPL Logistics System)

Welcome to the MPL Logistics System monorepo. This codebase hosts both the client/admin web application and the Express API server.

---

## 📂 Project Architecture

This repository uses **npm workspaces** to manage packages in a monorepo structure.

```
mpl-logistics/
├── apps/
│   ├── web/        # React + Vite frontend (Client Dashboard & Admin CRM)
│   └── api/        # Node.js + Express.js backend (with Prisma 7 ORM)
├── package.json    # Monorepo configuration
└── README.md       # Root documentation (this file)
```

For package-specific documentation, refer to:
- 💻 **Frontend Web App**: [`apps/web/README.md`](./apps/web/README.md)
- ⚙️ **Backend Express API**: [`apps/api/README.md`](./apps/api/README.md)

---

## 🛠️ Prerequisites

Make sure you have the following installed on your machine:
- **Node.js** (v18.0.0 or higher)
- **Docker Desktop** (or a local PostgreSQL instance running on port 5432)
- **npm** (v9.0.0 or higher)

---

## 🚀 Quick Start Guide

Follow these steps to get the entire stack running locally.

### 1. Clone & Install Dependencies
From the repository root directory, run:
```bash
# Install dependencies for all workspaces (root, api, and web)
npm install
```

### 2. Launch the PostgreSQL Database
If you use Docker, spin up a PostgreSQL 16 container:
```bash
docker run -d \
  --name mpl-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=mpl_logistics \
  -p 5432:5432 \
  -v mpl-data:/var/lib/postgresql/data \
  postgres:16
```

### 3. Configure Environment Variables
You need to create configuration files in both `apps/api/` and `apps/web/`.

- **For the API server**: Copy `apps/api/.env.example` to `apps/api/.env` and update the parameters below.
- **For the Web client**: Copy `apps/web/.env.example` to `apps/web/.env` and configure `VITE_API_BASE_URL` and `VITE_TURNSTILE_SITE_KEY`.

**Required API environment variables (`apps/api/.env`):**

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:yourpassword@localhost:5432/mpl_logistics` |
| `JWT_SECRET` | Secret key for signing JWT tokens | `your-secret-key` |
| `OPENWA_BASE_URL` | Base URL of your self-hosted OpenWA instance | `http://localhost:2785` |
| `OPENWA_API_KEY` | OpenWA API master key or operator key | `your-openwa-key` |
| `OPENWA_SESSION_ID` | OpenWA session ID of the linked WhatsApp session | `my-session` |

> **WhatsApp Note:** This project uses **OpenWA** (self-hosted WhatsApp gateway) instead of Fonnte. See the [OpenWA setup section](#-openwa-whatsapp-gateway) below before running.

### 4. Initialize Database Schemas & Seed Data
Navigate to the API folder to set up Prisma and populate initial data:
```bash
cd apps/api

# Run migrations and generate Prisma client
npx prisma migrate dev --name init
npx prisma generate

# Seed database with default Super Admin and sample data
npx ts-node prisma/seed.ts
```

Default Super Admin credentials after seeding: **`admin@mpl.com`** / **`admin1234`**

### 5. Running the Development Servers
Launch both the frontend and backend simultaneously from the **root directory**:

```bash
# Starts Express API (localhost:3001) and Vite Frontend (localhost:5173) in watch-mode
npm run dev
```

Alternatively, run them individually:
```bash
# Run backend only
npm run dev --workspace=api

# Run frontend only
npm run dev --workspace=web
```

---

## 📡 OpenWA WhatsApp Gateway

This project uses **OpenWA** — a self-hosted, open-source WhatsApp HTTP API — to send WhatsApp notifications (shipment updates, invoice alerts, driver assignments, etc.).

### Why OpenWA?
- Free and self-hosted — no per-message fees
- No third-party dependency (replaces the previous Fonnte integration)
- Full control over the WhatsApp session and message history

### Setup
OpenWA lives in `services/OpenWA/` (gitignored — clone it there separately) and runs as
its own service. **Full step-by-step: [services/OpenWA-SETUP.md](services/OpenWA-SETUP.md).**
In short:
1. Clone OpenWA into `services/`, then `npm install` and `npm run dev` (API on :2785, dashboard on **:2886**)
2. Scan the QR in the dashboard (http://localhost:2886) to link a WhatsApp account — wait for status `ready`
3. Copy the session ID and API key (`dev-admin-key` in local dev) into `apps/api/.env` as shown in the table above, then restart the API

### Phone Number Format
The API automatically normalizes Indonesian phone numbers:
- `0821-xxxx-xxxx` → `62821xxxxxxxx@c.us`
- `+62812…` → `62812…@c.us`
- `812…` (local, no prefix) → `62812…@c.us`

If OpenWA is not configured, the app degrades gracefully — WhatsApp messages are skipped with a warning log, and no errors are thrown.

---

## 🔄 Admin Dashboard — Live Polling

The admin dashboard uses a centralized polling utility (`apps/web/src/lib/polling.js`) to auto-refresh data without manual page reloads.

### Polling Intervals

| Constant | Interval | Used For |
|---|---|---|
| `POLL_INTERVAL.LIVE` | 10 seconds | Notifications, active shipments, driver activity |
| `POLL_INTERVAL.REFERENCE` | 30 seconds | Clients, drivers, vehicles, invoices |

### Smart Polling Behavior
- **Pauses automatically** when the browser tab is hidden — no wasted background requests
- **Fires immediately** when the tab becomes visible again to flush stale data
- Polling is driven by the `usePolling(onPoll, interval)` hook, used across all Admin sections:
  - `AdminDashboardPage` — notification badge refresh
  - `ArmadaSection` — vehicle fleet list
  - `ClientsSection` — client list
  - `DriversSection` — driver list
  - `InvoicesSection` — invoice list
  - `ShipmentsSection` — shipment list
  - `UsersSection` — user list
  - `TrackingSection` — live shipment tracking

---

## 📋 Technology Stack Summary

### Frontend (Web)
- **Framework**: React 19 (JS / JSX)
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 3 & Vanilla CSS
- **Routing**: React Router DOM 7
- **Features**: SheetJS (`xlsx`) for Excel reports, custom Toast alerts, Cloudflare Turnstile integration, centralized live polling

### Backend (API)
- **Server**: Express.js
- **Database Engine**: PostgreSQL
- **ORM**: Prisma 7
- **Authentication**: JSON Web Tokens (JWT) + role-based middleware guards
- **Services**: OpenWA (self-hosted WhatsApp gateway), Resend / Nodemailer (email notification engine)

---

## 🔒 Security Summary
- All credentials and sensitive tokens are injected via Environment Variables.
- Client account registers start in a `PENDING` state and require manual Admin verification.
- Protected client and admin requests verify JWT Bearer tokens in the HTTP headers.
- Critical operations are recorded in the `ADMIN_AUDIT_LOGS` table.

For detailed interface definitions, database schema descriptions, and API routes mapping, click through to the respective workspace folders.
