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

- **For the API server**: Copy `apps/api/.env.example` to `apps/api/.env` and update the parameters (Database connection string, Port, JWT secret, etc.).
- **For the Web client**: Copy `apps/web/.env.example` to `apps/web/.env` and configure key variables like `VITE_API_BASE_URL` (points to backend server) and `VITE_TURNSTILE_SITE_KEY`.

### 4. Initialize Database Schemas & Seed Data
Navigate to the API folder to set up Prisma and populate initial admin credentials:
```bash
cd apps/api

# Run migrations and generate Prisma client
npx prisma migrate dev --name init
npx prisma generate

# Seed database with the default Super Admin (admin@mpl.com / admin1234)
npx ts-node prisma/seed.ts
```

### 5. Running the Development Servers
You can launch both the frontend and backend applications simultaneously from the **root directory**:

```bash
# Starts Express API (localhost:3001) and Vite Frontend (localhost:5173) in watch-mode
npm run dev
```

Alternatively, you can run them individually:
```bash
# Run backend only
npm run dev --workspace=api

# Run frontend only
npm run dev --workspace=web
```

---

## 📋 Technology Stack Summary

### Frontend (Web)
- **Framework**: React 19 (JS / JSX)
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 3 & Vanilla CSS
- **Routing**: React Router DOM 7
- **Features**: SheetJS (`xlsx`) for Excel reports, custom Toast alerts, Cloudflare Turnstile integration.

### Backend (API)
- **Server**: Express.js
- **Database Engine**: PostgreSQL
- **ORM**: Prisma 7
- **Authentication**: JSON Web Tokens (JWT) + role-based middleware guards
- **Services**: Fonnte (WhatsApp integration), Resend / Nodemailer (Email notification engine)

---

## 🔒 Security Summary
- All credentials and sensitive tokens are injected via Environment Variables.
- Client account registers start in a `PENDING` state and require manual Admin verification.
- Protected client and admin requests verify JWT Bearer tokens in the HTTP headers.
- Critical operations are recorded in the `ADMIN_AUDIT_LOGS` table.

For detailed interface definitions, database schema descriptions, and API routes mapping, click through to the respective workspace folders.
