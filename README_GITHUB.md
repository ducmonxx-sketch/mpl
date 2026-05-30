# 🚚 PT Mahkota Putra Logistik (MPL System)

[![License: Private](https://img.shields.io/badge/License-Private-red.svg)](https://img.shields.io/badge/License-Private-red.svg)
[![React](https://img.shields.io/badge/React-19.2-blue.svg?logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6.4-646CFF.svg?logo=vite)](https://vite.dev)
[![Express](https://img.shields.io/badge/Express-5.2-000000.svg?logo=express)](https://expressjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-7.8-2D3748.svg?logo=prisma)](https://prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1.svg?logo=postgresql)](https://postgresql.org)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED.svg?logo=docker)](https://www.docker.com)

A state-of-the-art corporate logistics and fleet management platform. The system operates as an **npm monorepo** hosting an Express API gateway connected to a PostgreSQL database, alongside a React SPA frontend catering to both client logistics operations and internal Admin CRM workflows.

---

## 🌟 Key Features

### 💻 Client Portal
- **Interactive Shipments**: Create delivery requests, specify package metrics, origin/destination hubs, and logistics instructions.
- **Live Timeline Tracking**: Interactive, step-by-step progress tracking for packages with administrative checkpoint logs and delivery orders (*surat jalan*).
- **Analytics Dashboard**: Dynamic analytical counters and charting widgets filtered by custom periods (Daily, Weekly, Monthly, Yearly).
- **Excel Report Generator**: One-click custom Excel sheets generation (`xlsx` via SheetJS) for invoice summaries, active shipments, and historical registries.
- **Security Toggles**: Self-serve client dashboard settings to toggle email alerts, SMS/WhatsApp integrations, and UI theme/language configurations.
- **Bot Verification**: Form portals secured via Cloudflare Turnstile challenge widgets.

### 🏢 Admin CRM Panel
- **Client Verification Queue**: Operational workflows to review, verify, or reject newly registered corporate client accounts.
- **Fleet Management (CRUD)**: Full registry controls to track active/idle vehicles (plate number, type, capacity) and drivers (licenses, contact numbers).
- **Logistics Dispatcher**: Map active packages to available drivers and vehicles, and update real-time shipment status checkpoints.
- **Audit Trails**: Security tracking logging every administrative state change (who, when, what changed) in the `ADMIN_AUDIT_LOGS` table.
- **System Monitoring**: Rapid KPI counters showing global system health, active transits, and pending invoices.

---

## 📂 Project Architecture

The codebase leverages **npm workspaces** to cleanly separate the client frontend and backend REST services:

```
mpl-logistics/
├── apps/
│   ├── web/                     # React 19 Frontend Web Application
│   │   ├── public/              # Static public assets
│   │   └── src/
│   │       ├── assets/          # Landing site media & local images
│   │       ├── components/      # Component Registry (Admin, Client, Landing)
│   │       ├── contexts/        # React Context Store (Auth, Global Toast alerts)
│   │       ├── hooks/           # Scroll transitions and page animation utilities
│   │       ├── lib/             # API HTTP endpoint consumption wrappers
│   │       └── pages/           # Page routers and major shell components
│   │
│   └── api/                     # Node.js + Express.js REST API
│       ├── prisma/              # Prisma 7 Database schema & Migrations
│       └── src/
│           ├── generated/       # Generated Prisma Client engines
│           ├── middleware/      # JWT auth middleware & RBAC guards
│           ├── routes/          # API endpoint routes grouping logic
│           └── index.ts         # Express bootstrapper entry-point
│
├── packages/
│   └── lib/                     # Shareable typescript schemas & types
│
├── package.json                 # Monorepo workspaces definition
└── README.md                    # Root repository developer docs
```

---

## 🛠️ Tech Stack & Dependencies

### Frontend Web App
* **Core Framework**: React 19 (Functional Components, Hooks, Contexts)
* **Build Engine**: Vite 6 (Fast Refresh, Optimized bundle splitting)
* **CSS Framework**: Tailwind CSS v3 (Utility classes) & modular HSL-tailored Custom CSS variables
* **Routing**: React Router DOM v7 (Loader-guarded layouts)
* **Addons**: SheetJS (`xlsx`) for Excel reports generation

### Backend REST API
* **Engine**: Node.js & Express.js (Modular Router Architecture)
* **Database Mapping**: Prisma ORM v7
* **Database Engine**: PostgreSQL 16
* **Security & Auth**: JWT (JSON Web Tokens) with a 7-day expiration cycle, bcrypt password-hashing
* **External Services**: Fonnte (WhatsApp API dispatch), Resend / Nodemailer (Email templates)

---

## 🗺️ System Routing Schema

### Public Routing
| Route Path | Associated Component | Access Type | Purpose |
| :--- | :--- | :--- | :--- |
| `/` | `HomePage.jsx` | Public | Institutional home page, company profile, and contact forms. |
| `/client` | `ClientAuthPage.jsx` | Public | Client onboarding/login portal. Guarded by Cloudflare Turnstile. |
| `/client/verification` | `VerificationPage.jsx` | Public (Pending) | Landing notice for newly registered accounts waiting for admin vetting. |
| `/admin` | `AdminAuthPage.jsx` | Public | Login credentials panel for operational teams and admins. |

### Private Client Workspace
| Route Path | Component Tab | Required Role | Functionality |
| :--- | :--- | :--- | :--- |
| `/client/dashboard` | `DashboardSection` | `user` (Verified) | Analytics counter cards, charting modules, and reports download. |
| `/client/dashboard` | `ShipmentsSection` | `user` (Verified) | Active shipment timeline overview and dispatch request forms. |
| `/client/dashboard` | `TrackingSection` | `user` (Verified) | Live waypoint tracking and delivery order (*surat jalan*) viewer. |
| `/client/dashboard` | `HistorySection` | `user` (Verified) | Historic logs of delivered, cancelled, or failed shipments. |
| `/client/dashboard` | `InvoicesSection` | `user` (Verified) | Payment records, billing values, and statement invoices. |
| `/client/dashboard` | `SettingsSection` | `user` (Verified) | Contact details settings, notification toggles, language, theme. |

### Administrative CRM Workspace (RBAC Guarded)
| Route Path | Component Tab | Required Role | Functionality |
| :--- | :--- | :--- | :--- |
| `/admin/dashboard` | `OverviewSection` | `OPERATIONS` / `SUPERADMIN` | High-level operations cockpit, active stats, and logs ticker. |
| `/admin/dashboard` | `ShipmentsSection` | `OPERATIONS` / `SUPERADMIN` | Assign drivers/trucks to deliveries, and issue checkpoints. |
| `/admin/dashboard` | `ClientsSection` | `SUPPORT` / `SUPERADMIN` | Account activation queue. Authorize or reject pending clients. |
| `/admin/dashboard` | `DriversSection` | `OPERATIONS` / `SUPERADMIN` | Add, update, suspend drivers; track license expirations. |
| `/admin/dashboard` | `InvoicesSection` | `SUPPORT` / `SUPERADMIN` | Create client bills, dispatch alerts, log payment arrivals. |
| `/admin/dashboard` | `UsersSection` | `SUPERADMIN` | Internal operational account creations and security audits. |

---

## 🔒 Security Architecture

1. **Role-Based Access Control (RBAC)**: All sensitive routes on the Express API are protected by middleware guards check matching user permissions (`user`, `OPERATIONS`, `SUPPORT`, `SUPERADMIN`).
2. **JWT Lifecycle Management**: Credentials verification generates a cryptographically signed JWT token stored in `localStorage` client-side. Requests automatically carry the `Authorization: Bearer <token>` header.
3. **Graceful 401 Session Wiping**: If a token is revoked in the database or expires (7-day duration), the API client (`src/lib/api.js`) automatically wipes local session caches and redirects users to their respective login portals with descriptive Toast notifications.
4. **Security Audits**: The `ADMIN_AUDIT_LOGS` table tracks every system mutation made by internal staff.
5. **Turnstile Bot Protection**: Prevents registration attacks using zero-friction CAPTCHA verification on credentials entry forms.

---

## 🚀 Setting Up the Repository Locally

### Prerequisites
* **Node.js** (v18.0.0 or higher)
* **npm** (v9.0.0 or higher)
* **Docker Desktop** (For spinning up local databases instantly)

### 1. Clone & Bootstrap Workspace
Execute at your preferred terminal directory:
```bash
# Clone the repository
git clone https://github.com/your-username/mpl-logistics.git
cd mpl-logistics

# Install workspace-wide dependencies for both apps/web and apps/api
npm install
```

### 2. Launch Local Database
Start a PostgreSQL 16 container inside Docker:
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

### 3. Environment Variables Configuration
Configure environment keys for both workspaces.

#### Backend Setup (`apps/api/.env`)
Copy `apps/api/.env.example` into a new file `apps/api/.env` and update the parameters:
```env
PORT=3001
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/mpl_logistics?schema=public"
JWT_SECRET="generate_a_secure_hex_key_here"
CLIENT_URL="http://localhost:5173"
```
*(Pro-tip: Generate a JWT secret via `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)*

#### Frontend Setup (`apps/web/.env`)
Copy `apps/web/.env.example` into a new file `apps/web/.env` and fill the variables:
```env
VITE_API_BASE_URL=http://localhost:3001
VITE_TURNSTILE_SITE_KEY=your_cloudflare_turnstile_site_key
VITE_APP_NAME="PT Mahkota Putra Logistik"
VITE_CONTACT_EMAIL=info@mahkotaputralogistik.co.id
VITE_WHATSAPP_LINK=https://wa.me/62812XXXXXXXX
```

### 4. Run Migrations & Seed Database
Prepare the Prisma client engine and populate initial user roles:
```bash
# Move to backend app
cd apps/api

# Run Prisma schema migrations
npx prisma migrate dev --name init
npx prisma generate

# Populate default database administrator seeds
npx ts-node prisma/seed.ts
```

This registers the default administrator account:
* **Admin Login**: `admin@mpl.com`
* **Admin Password**: `admin1234`
*(Important: Please update administrative passwords inside the CRM settings panel immediately on first login.)*

### 5. Running the Monorepo
Return to the monorepo root directory and run:
```bash
# Boot Express API (Port 3001) and Vite Frontend (Port 5173) in watch-mode simultaneously
npm run dev
```

Alternatively, you can run services individually using npm workspaces:
```bash
# Run API service only
npm run dev --workspace=api

# Run Vite web client only
npm run dev --workspace=web
```

---

## ⚡ Useful Operational Commands

### Database & Prisma Workflows
```bash
# Open Prisma visual database client editor in browser
npx prisma studio

# Create a database snapshot or apply updates after editing schemas
npx prisma migrate dev --name <your_change_description>

# Wipe database tables and re-apply migrations (development only)
npx prisma migrate reset
```

### Build & Deploy Standalone Frontend
Inside `apps/web/`:
```bash
# Lint source directories
npm run lint

# Compile production-ready build outputs to apps/web/dist
npm run build

# Preview compilation production outputs locally
npm run preview
```

---

## 🔒 License
Private Corporate Project. All rights reserved. Registered to **PT Mahkota Putra Logistik**.
