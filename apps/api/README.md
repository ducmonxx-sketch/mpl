# MPL Logistics System

A web-based logistics and fleet management platform built for internal operations and client-facing shipment tracking. Admins manage the entire operation through a CRM dashboard, while clients can request shipments, track deliveries in real-time, and receive notifications via WhatsApp and email.

---

## Features

### Client Dashboard
- **Dashboard** — shipment statistics with Daily / Weekly / Monthly / Yearly filters, downloadable Excel reports
- **Shipment** — view and request new shipments
- **Tracking** — live timeline of ongoing shipments with manual checkpoint updates from admin, including surat jalan (delivery order)
- **History** — full shipment history filtered by status (delivered, ongoing, failed)
- **Settings** — profile management, WhatsApp & email notification toggles, language and theme preferences

### Admin CRM
- Verify and manage client accounts
- Create and assign shipments to drivers and vehicles
- Manage driver and vehicle fleet
- Add manual tracking checkpoints per shipment
- Push manual notifications to clients
- Full audit log of every admin action

---

## Tech Stack

### Frontend
| Tool | Purpose |
|---|---|
| React + Vite | UI framework |
| Tailwind CSS | Styling |
| TypeScript | Type safety |

### Backend
| Tool | Purpose |
|---|---|
| Express.js | API server |
| Prisma 7 | ORM |
| PostgreSQL | Database |
| JSON Web Tokens | Authentication |
| bcrypt | Password hashing |

### Infrastructure
| Tool | Purpose |
|---|---|
| Docker | PostgreSQL container |
| Cloudflare | Security & DNS |
| NAS (Synology/QNAP) | Self-hosted database server |
| npm workspaces | Monorepo management |

### Notifications
| Tool | Purpose |
|---|---|
| Fonnte | WhatsApp notifications |
| Resend / Nodemailer | Email notifications |

---

## Project Structure

```
monorepo/
├── apps/
│   ├── web/                        # React + Vite frontend
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── Dashboard.tsx
│   │       │   ├── Shipment.tsx
│   │       │   ├── Tracking.tsx
│   │       │   ├── History.tsx
│   │       │   └── Settings.tsx
│   │       └── components/
│   │
│   └── api/                        # Express.js backend
│       ├── prisma/
│       │   ├── schema.prisma       # Database schema
│       │   ├── migrations/         # Migration history
│       │   └── seed.ts             # Initial data seed
│       ├── src/
│       │   ├── generated/
│       │   │   └── prisma/         # Auto-generated Prisma client
│       │   ├── lib/
│       │   │   └── prisma.ts       # Prisma client singleton
│       │   ├── middleware/
│       │   │   └── auth.ts         # JWT auth + role guards
│       │   ├── routes/
│       │   │   ├── auth.ts         # Register + login
│       │   │   ├── shipments.ts    # Shipment CRUD + stats
│       │   │   ├── tracking.ts     # Shipment event timeline
│       │   │   ├── users.ts        # Profile + admin verify
│       │   │   ├── fleet.ts        # Drivers + vehicles
│       │   │   └── notifications.ts
│       │   └── index.ts            # Express entry point
│       ├── prisma.config.ts        # Prisma 7 datasource config
│       ├── .env                    # Environment variables
│       └── package.json
│
└── packages/
    └── lib/                        # Shared TypeScript types
```

---

## Database Schema

The system has 9 tables:

```
ADMINS              → internal team with role-based access
ADMIN_AUDIT_LOGS    → records every admin action (who, what, when)
USERS               → client accounts (pending verification by default)
USER_SETTINGS       → per-user notification toggles, theme, language
DRIVERS             → fleet drivers managed by admin
VEHICLES            → fleet vehicles managed by admin
SHIPMENTS           → core shipment records (heart of the system)
SHIPMENT_EVENTS     → manual tracking timeline per shipment
NOTIFICATIONS       → in-app alerts (system or manual from admin)
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Docker Desktop (for PostgreSQL)
- pnpm

### 1. Clone the repository

```bash
git clone https://github.com/your-username/mpl-logistics.git
cd mpl-logistics
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start PostgreSQL with Docker

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

### 4. Configure environment variables

Create `apps/api/.env`:

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/mpl_logistics"
JWT_SECRET="your-random-secret-key"
CLIENT_URL="http://localhost:5173"
PORT=3001
```

> Generate a secure JWT secret:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### 5. Run database migrations

```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma generate
```

### 6. Seed the first admin

```bash
npx ts-node prisma/seed.ts
```

This creates:
- Admin: `admin@mpl.com` / `admin1234`

> ⚠️ Change the admin credentials immediately after first login.

### 7. Start the development servers

```bash
# From monorepo root — starts both frontend and backend
npm run dev

# Or individually:
cd apps/api && npm run dev     # API on http://localhost:3001
cd apps/web && npm run dev     # Frontend on http://localhost:5173
```

---

## API Reference

### Auth
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Client registration |
| POST | `/api/auth/login` | Public | Client login |
| POST | `/api/auth/admin/login` | Public | Admin login |

### Users
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/users` | Admin | List all clients |
| GET | `/api/users/me` | Client | Own profile |
| PATCH | `/api/users/me` | Client | Update profile |
| PATCH | `/api/users/me/settings` | Client | Update notification settings |
| PATCH | `/api/users/:id/verify` | Admin | Verify a client |
| PATCH | `/api/users/:id/reject` | Admin | Reject a client |

### Shipments
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/shipments` | Both | List shipments |
| GET | `/api/shipments/stats` | Both | Dashboard stats by period |
| GET | `/api/shipments/:id` | Both | Shipment detail |
| POST | `/api/shipments` | Both | Create shipment |
| PATCH | `/api/shipments/:id/assign` | Admin | Assign driver & vehicle |
| PATCH | `/api/shipments/:id/status` | Admin | Update status & progress |

### Tracking
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/tracking/:shipmentId` | Both | Full tracking timeline |
| POST | `/api/tracking/:shipmentId/events` | Admin | Add checkpoint |
| PATCH | `/api/tracking/events/:eventId` | Admin | Update checkpoint |

### Fleet
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/fleet/drivers` | Admin | List drivers |
| POST | `/api/fleet/drivers` | Admin | Add driver |
| PATCH | `/api/fleet/drivers/:id` | Admin | Update driver |
| GET | `/api/fleet/vehicles` | Admin | List vehicles |
| POST | `/api/fleet/vehicles` | Admin | Add vehicle |
| PATCH | `/api/fleet/vehicles/:id` | Admin | Update vehicle |

### Notifications
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/notifications` | Client | Get notifications |
| PATCH | `/api/notifications/read-all` | Client | Mark all as read |
| PATCH | `/api/notifications/:id/read` | Client | Mark one as read |

---

## Authentication

All protected routes require a Bearer token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

Tokens are obtained from the login endpoints and expire after **7 days**.

### Role levels
| Role | Access |
|---|---|
| `user` | Own shipments, profile, notifications |
| `OPERATIONS` | Shipments, fleet, tracking |
| `SUPPORT` | Client accounts, notifications |
| `SUPERADMIN` | Full access including audit logs |

---

## Useful Commands

```bash
# Prisma
npx prisma migrate dev --name <change_description>   # apply schema changes
npx prisma generate                                   # regenerate TS client
npx prisma studio                                     # visual database browser
npx prisma migrate reset                              # ⚠️ wipe database (dev only)

# Docker
docker start mpl-postgres        # start DB container
docker stop mpl-postgres         # stop DB container
docker logs mpl-postgres         # view DB logs
```

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:pass@localhost:5432/mpl_logistics` |
| `JWT_SECRET` | Secret key for signing tokens | 64-char random hex string |
| `CLIENT_URL` | Frontend URL for CORS | `http://localhost:5173` |
| `PORT` | API server port | `3001` |

---

## Security

- Passwords are hashed with **bcrypt** (salt rounds: 10)
- Authentication via **JWT** with 7-day expiry
- Role-based access control on all admin routes
- All admin actions logged in `ADMIN_AUDIT_LOGS`
- DNS and edge security via **Cloudflare**
- New client accounts require **manual admin verification** before access

---

## Roadmap

- [ ] Connect React frontend to API
- [ ] WhatsApp notifications via Fonnte
- [ ] Email notifications via Resend
- [ ] Excel report export (SheetJS)
- [ ] Surat jalan PDF generation
- [ ] Deploy backend to VPS / NAS
- [ ] Admin CRM dashboard UI

---

## License

Private project — all rights reserved.
