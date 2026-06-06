# MPL Logistics System

A web-based logistics and fleet management platform built for internal operations and client-facing shipment tracking. Admins manage the entire operation through a CRM dashboard, while clients can request shipments, track deliveries, and receive notifications via WhatsApp and email.

---

## Features

### Client Portal
- **Dashboard** — shipment statistics with Daily / Weekly / Monthly / Yearly filters
- **Pengiriman** — view and request new shipments
- **Pelacakan** — timeline of ongoing shipments with manual checkpoint updates from admin
- **Riwayat** — full shipment history filtered by status (delivered, ongoing, failed)
- **Faktur** — view invoices issued by admin
- **Pengaturan** — profile management, WhatsApp & email notification toggles, language and theme preferences

### Admin CRM
- Verify and manage client accounts
- Create and assign shipments to drivers and vehicles
- Manage driver and vehicle fleet (separate entries for flexibility)
- Add manual tracking checkpoints per shipment
- Create, send, and mark invoices as paid
- Push manual notifications to clients
- Full audit log of every admin action

---

## Tech Stack

### Frontend
| Tool | Purpose |
|---|---|
| React + Vite | UI framework |
| Tailwind CSS | Styling |

### Backend
| Tool | Purpose |
|---|---|
| Express.js | API server |
| Prisma 7 | ORM |
| PostgreSQL | Database |
| JSON Web Tokens | Authentication (7-day expiry) |
| bcrypt | Password hashing |

### Infrastructure
| Tool | Purpose |
|---|---|
| Docker | PostgreSQL container (dev + production) |
| Cloudflare | CDN, DNS, edge security |
| NAS (Synology/QNAP) | Self-hosted database server (production target) |
| npm workspaces | Monorepo management |

### Notifications
| Tool | Purpose |
|---|---|
| Fonnte | WhatsApp notifications |
| Resend / Nodemailer | Email notifications |

---

## Project Structure

```
mpl/
├── apps/
│   ├── web/                        # React + Vite frontend
│   │   └── src/
│   │       ├── pages/
│   │       └── components/
│   │
│   └── api/                        # Express.js backend  ← you are here
│       ├── prisma/
│       │   ├── schema.prisma       # Database schema
│       │   ├── migrations/         # Migration history (auto-generated)
│       │   └── seed.ts             # Seeds admin + client accounts
│       ├── src/
│       │   ├── generated/
│       │   │   └── prisma/         # Auto-generated Prisma client (gitignored)
│       │   ├── lib/
│       │   │   └── prisma.ts       # Prisma client singleton
│       │   ├── middleware/
│       │   │   └── auth.ts         # JWT auth + role guards
│       │   └── routes/
│       │       ├── auth.ts         # Register + login
│       │       ├── shipments.ts    # Shipment CRUD + stats
│       │       ├── tracking.ts     # Shipment event timeline
│       │       ├── users.ts        # Profile + admin verify/reject
│       │       ├── fleet.ts        # Drivers + vehicles (separate)
│       │       ├── invoices.ts     # Invoice lifecycle
│       │       ├── notifications.ts
│       │       └── index.ts        # Express entry point
│       ├── prisma.config.ts        # Prisma 7 datasource config (reads .env)
│       ├── .env                    # Local environment variables (never commit)
│       └── package.json
│
└── package.json                    # Monorepo root
```

---

## Database Schema

The system has 10 tables:

```
admins              → internal team with role-based access (SUPERADMIN, OPERATIONS, SUPPORT)
admin_audit_logs    → records every admin action (who, what, when)
users               → client accounts (pending verification by default)
user_settings       → per-user notification toggles, theme, language
drivers             → fleet drivers managed by admin
vehicles            → fleet vehicles managed by admin (separate from drivers)
shipments           → core shipment records (heart of the system)
shipment_events     → manual tracking timeline per shipment
notifications       → in-app alerts (auto-triggered or manual from admin)
invoices            → invoices per shipment (DRAFT → SENT → PAID / OVERDUE / CANCELLED)
```

---

## Local Setup

### Prerequisites
- Node.js 18+
- Docker Desktop

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

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/mpl_logistics"
JWT_SECRET="your-random-secret-key"
CLIENT_URL="http://localhost:5173"
PORT=3001
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 5. Run database migrations

```bash
cd apps/api
npx prisma migrate dev
npx prisma generate
```

> `migrate dev` applies all pending migrations in `prisma/migrations/` in order.
> `generate` builds the TypeScript client in `src/generated/prisma/`.

### 6. Seed initial accounts

```bash
npx prisma db seed
```

This creates two accounts:

| Type | Email | Password |
|---|---|---|
| Admin (SUPERADMIN) | `admin@mpl.com` | `admin1234` |
| Client (verified) | `client@mpl.com` | `client1234` |

> **Change the admin password immediately after first login.**

### 7. Start the development servers

```bash
# From monorepo root — starts both frontend and backend
npm run dev

# Or individually:
cd apps/api && npm run dev     # API → http://localhost:3001
cd apps/web && npm run dev     # Frontend → http://localhost:5173
```

---

## Resetting the Database (Dev Only)

To wipe all data and re-run migrations from scratch:

```bash
cd apps/api
npx prisma migrate reset      # ⚠️ drops and recreates the DB
npx prisma db seed            # re-seeds admin + client accounts
```

To only re-seed without wiping:

```bash
cd apps/api
npx prisma db seed
```

---

## API Reference

Base URL (local): `http://localhost:3001`

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
| PATCH | `/api/users/:id/verify` | Admin | Verify a client account |
| PATCH | `/api/users/:id/reject` | Admin | Reject a client account |

### Shipments
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/shipments` | Both | List shipments (client: own only) |
| GET | `/api/shipments/stats` | Both | Dashboard stats by period |
| GET | `/api/shipments/:id` | Both | Shipment detail |
| POST | `/api/shipments` | Both | Create shipment request |
| PATCH | `/api/shipments/:id/assign` | Admin | Assign driver & vehicle → flips to TRANSIT |
| PATCH | `/api/shipments/:id/status` | Admin | Update status & progress % |

### Tracking
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/tracking/:shipmentId` | Both | Full tracking timeline |
| POST | `/api/tracking/:shipmentId/events` | Admin | Add checkpoint event |
| PATCH | `/api/tracking/events/:eventId` | Admin | Update checkpoint status |

### Fleet
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/fleet/drivers` | Admin | List drivers |
| POST | `/api/fleet/drivers` | Admin | Add driver |
| PATCH | `/api/fleet/drivers/:id` | Admin | Update driver |
| GET | `/api/fleet/vehicles` | Admin | List vehicles |
| POST | `/api/fleet/vehicles` | Admin | Add vehicle |
| PATCH | `/api/fleet/vehicles/:id` | Admin | Update vehicle |

### Invoices
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/invoices` | Both | List invoices (client: own only) |
| GET | `/api/invoices/:id` | Both | Invoice detail with shipment info |
| POST | `/api/invoices` | Admin | Create invoice from a shipment |
| PATCH | `/api/invoices/:id/send` | Admin | Send to client (DRAFT → SENT) |
| PATCH | `/api/invoices/:id/paid` | Admin | Mark as paid (SENT/OVERDUE → PAID) |
| PATCH | `/api/invoices/:id/cancel` | Admin | Cancel invoice (DRAFT/SENT → CANCELLED) |

> Invoices are auto-marked OVERDUE on any GET request if status is SENT and `dueDate` has passed.

### Notifications
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/notifications` | Client | Get latest 50 notifications |
| PATCH | `/api/notifications/read-all` | Client | Mark all as read |
| PATCH | `/api/notifications/:id/read` | Client | Mark one as read |

---

## Authentication

All protected routes require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

Tokens are issued by the login endpoints and expire after **7 days**.

### Role levels
| Role | Access |
|---|---|
| `user` | Own shipments, profile, notifications, own invoices |
| `OPERATIONS` | Shipments, fleet, tracking, invoices |
| `SUPPORT` | Client accounts, notifications |
| `SUPERADMIN` | Full access including audit logs |

---

## Useful Commands

```bash
# Prisma
npx prisma migrate dev --name <description>   # create + apply a new migration
npx prisma generate                            # regenerate TypeScript client
npx prisma studio                             # visual database browser (localhost:5555)
npx prisma migrate reset                      # ⚠️ wipe DB and reapply all migrations (dev only)
npx prisma db seed                            # run seed file

# Docker
docker start mpl-postgres        # start DB container
docker stop mpl-postgres         # stop DB container
docker logs mpl-postgres         # view DB logs
docker exec -it mpl-postgres psql -U postgres -d mpl_logistics   # open psql shell
```

---

## Environment Variables

| Variable | Required | Description | Example |
|---|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://postgres:pass@localhost:5432/mpl_logistics` |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens (64-char hex recommended) | `ad614b16...` |
| `CLIENT_URL` | Yes | Frontend origin for CORS | `http://localhost:5173` |
| `PORT` | No | API server port (default: 3001) | `3001` |

---

## Docker — Production Notes

The Docker command in step 3 is production-ready as-is with two changes:

1. **Use a strong password** — replace `yourpassword` with a randomly generated secret
2. **Bind to localhost only** on the host if the DB is not exposed publicly:
   ```bash
   -p 127.0.0.1:5432:5432
   ```

For NAS (Synology/QNAP) deployment, create the container via Docker Compose instead:

```yaml
# docker-compose.yml (place in apps/api/)
services:
  postgres:
    image: postgres:16
    container_name: mpl-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: mpl_logistics
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - mpl-data:/var/lib/postgresql/data

volumes:
  mpl-data:
```

Run with:
```bash
docker compose up -d
```

---

## Security

- Passwords hashed with **bcrypt** (salt rounds: 10)
- Auth via **JWT** with 7-day expiry
- Role-based access control on all admin routes
- All admin actions logged to `admin_audit_logs`
- DNS and edge security via **Cloudflare**
- New client accounts require **manual admin verification** before access

---

## Roadmap

- [x] Express API with JWT auth and role-based guards
- [x] Client registration + admin verification workflow
- [x] Shipment CRUD with driver/vehicle assignment
- [x] Manual tracking timeline (shipment events)
- [x] Fleet management (drivers + vehicles)
- [x] In-app notifications
- [x] Invoice lifecycle (create → send → paid/overdue/cancelled)
- [x] Full admin audit log
- [ ] WhatsApp notifications via Fonnte
- [ ] Email notifications via Resend
- [ ] Excel report export (SheetJS)
- [ ] Surat jalan PDF generation
- [ ] Real-time tracking (driver app → Redis pub/sub → SSE → client browser)
- [ ] Deploy backend to VPS / NAS

---

## License

Private project — all rights reserved.
