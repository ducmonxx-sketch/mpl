# MPL Logistics System — Frontend Web Application

This directory contains the client-facing tracking portal and the internal Admin CRM dashboard. It is a React 19 single-page application built on Vite and styled with a hybrid of Tailwind CSS and custom vanilla CSS variables.

---

## 💻 Tech Stack & Key Packages

- **Core**: React 19, JavaScript (ES modules)
- **Bundler & Tooling**: Vite 6, ESLint 9, PostCSS 8
- **Styling**: Tailwind CSS v3 (layout/utility grids) + Custom CSS files per dashboard/page (colors, typography, effects)
- **Routing**: React Router DOM v7
- **Excel Generation**: SheetJS (`xlsx` package) for client/admin report downloads
- **Bot Protection**: Cloudflare Turnstile integration on client login/registration

---

## 📁 Codebase Directory Structure

```
apps/web/
├── public/                 # Static assets (logos, icons, web manifest)
├── src/
│   ├── assets/             # Images, static landing site media
│   ├── components/         # Shared and modular UI components
│   │   ├── AdminComponents/     # Components specific to the Admin panel
│   │   ├── ClientComponents/    # Components specific to the Client portal
│   │   ├── LandingComponents/   # Components specific to the landing homepage
│   │   ├── CloudflareTurnstile.jsx # CAPTCHA verification widget
│   │   ├── Icon.jsx            # Centralized SVG / material symbol icon engine
│   │   ├── ProtectedRoute.jsx  # Admin route-guard component
│   │   └── WhatsAppButton.jsx  # Floating WhatsApp chat overlay
│   ├── contexts/           # Global React state contexts
│   │   ├── AuthContext.jsx     # Session storage & JWT auth state handler
│   │   └── ToastContext.jsx    # Custom global notifications banner
│   ├── hooks/              # Custom reusable hooks
│   │   └── useFadeInOnScroll.js # Scroll trigger animation utility
│   ├── lib/
│   │   └── api.js              # Centralized fetch API wrapper (HTTP Requests)
│   ├── pages/              # Main Route-level page components
│   │   ├── dashboard/          # Client dashboard section components
│   │   │   ├── DashboardSection.jsx  # Analytics overview, charts, excel reports
│   │   │   ├── HistorySection.jsx    # Completed / Failed shipments listing
│   │   │   ├── InvoicesSection.jsx   # Client billings & payment reports
│   │   │   ├── SettingsSection.jsx   # Profile & notifications toggle UI
│   │   │   ├── ShipmentsSection.jsx  # Active shipments view & new requests
│   │   │   └── TrackingSection.jsx   # Live timeline search & details
│   │   ├── AdminComponents/    # Admin dashboard sections
│   │   │   ├── OverviewSection.jsx   # System status, rapid stats widget
│   │   │   ├── ShipmentsSection.jsx  # Direct shipment list, status changes, assignments
│   │   │   ├── ClientsSection.jsx    # Client verification approval/rejection panel
│   │   │   ├── DriversSection.jsx    # Vehicle and Driver fleet registry CRUD
│   │   │   ├── InvoicesSection.jsx   # Invoice builder & billing list
│   │   │   └── UsersSection.jsx      # Admin account manager
│   │   ├── HomePage.jsx        # Public corporate website
│   │   ├── ClientAuthPage.jsx  # Client registration, login, and authorization
│   │   ├── VerificationPage.jsx # Pending admin approval notification page
│   │   ├── ClientDashboardPage.jsx # Parent dashboard shell for clients
│   │   ├── AdminAuthPage.jsx   # Admin authentication login
│   │   ├── AdminDashboardPage.jsx  # Parent dashboard shell for admins
│   │   └── NotFoundPage.jsx    # Fallback 404 handler
│   ├── App.jsx             # Main Router structure & Context Providers root
│   ├── index.css           # Global CSS variables, custom typography, utility styles
│   └── main.jsx            # Vite DOM mounting entry point
├── package.json            # Script definitions and dependency trees
└── tailwind.config.js      # Utility-class framework custom overrides
```

---

## 🗺️ App Routing Matrix

| Route Path | Component | Access Level | Description |
|:---|:---|:---|:---|
| `/` | `HomePage.jsx` | Public | Public corporate page, fleet services details, contact points. |
| `/client` | `ClientAuthPage.jsx` | Public | Client login & registration interface. Protected by Cloudflare Turnstile. |
| `/client/verification` | `VerificationPage.jsx` | Public / Pending | Redirect target for newly registered clients who have not been verified by an admin. |
| `/client/dashboard` | `ClientDashboardPage.jsx` | Client (`user`) | Client dashboard shell. Sub-tabs: analytics, shipments, tracking, history, invoices, settings. |
| `/admin` | `AdminAuthPage.jsx` | Public | Credentials portal for system administrators. |
| `/admin/dashboard` | `AdminDashboardPage.jsx` | Admin (`admin`) | Operations management panel. Protected by `ProtectedRoute` role guard. |
| `*` | `NotFoundPage.jsx` | Public | Fallback page for unmatched browser routes. |

---

## 🔒 Authentication Flow & Session Management

The frontend session lifecycle is governed by the `AuthContext` (`src/contexts/AuthContext.jsx`) and secured via JSON Web Tokens:
1. **Credentials verification**: Submitting the login forms calls `/api/auth/login` (Client) or `/api/auth/admin/login` (Admin).
2. **Session Storage**: On successful authentication, the API returns a JWT token along with the user profile:
   - `mpl_token`: Saved in `localStorage`. Automatically attached to all subsequent request headers as `Authorization: Bearer <token>`.
   - `mpl_user`: Stores JSON string representation of current user profile.
   - `mpl_user_type`: Designates role authorization levels (`'user'` or `'admin'`).
3. **Guard Checking**: The `<ProtectedRoute>` component intercepts routing attempts to admin pages, ensuring the client's `mpl_user_type` equals `'admin'` before displaying sections.
4. **Automatic Expiry (401 Handling)**: In `src/lib/api.js`, if a request returns a `401 Unauthorized` status (e.g. token expired, database revoked token), the frontend automatically:
   - Wipes tokens and profile details from `localStorage`.
   - Fires a warning toast message.
   - Force-redirects the user back to `/client` (if client section) or `/admin` (if admin section).

---

## ⚙️ Environment Configuration

Copy `apps/web/.env.example` into a new file `apps/web/.env` and update configuration keys:
```env
# Cloudflare Turnstile public verification site key
VITE_TURNSTILE_SITE_KEY=your_cloudflare_turnstile_site_key

# Address of running Backend API (No trailing slash)
VITE_API_BASE_URL=http://localhost:3001

# Public display items
VITE_CONTACT_EMAIL=info@mahkotaputralogistik.co.id
VITE_WHATSAPP_LINK=https://wa.me/62812XXXXXXXX
VITE_APP_NAME=PT Mahkota Putra Logistik
```

---

## ⚡ API Client Reference (`src/lib/api.js`)

The `api.js` client organizes endpoint consumption into clear, modular namespaces. Here is the contract the frontend expects the backend API to fulfill:

### 1. `authAPI` (Authentication)
- **`register(data)`**
  - **HTTP & Endpoint**: `POST /api/auth/register`
  - **Payload**: `{ email, password, fullName, companyName, phone, address, turnstileToken }`
- **`login(email, password)`**
  - **HTTP & Endpoint**: `POST /api/auth/login`
  - **Payload**: `{ email, password }`
  - **Expected Response**: `{ token: string, user: { id, email, fullName, companyName, status } }`
- **`adminLogin(email, password)`**
  - **HTTP & Endpoint**: `POST /api/auth/admin/login`
  - **Payload**: `{ email, password }`
  - **Expected Response**: `{ token: string, user: { id, email, fullName, role } }`

### 2. `usersAPI` (Profile & Administration verification)
- **`getMe()`**
  - **HTTP & Endpoint**: `GET /api/users/me` (requires Bearer token)
  - **Expected Response**: `{ id, email, fullName, companyName, phone, address, settings: { whatsappEnabled, emailEnabled, theme, language } }`
- **`updateMe(data)`**
  - **HTTP & Endpoint**: `PATCH /api/users/me`
  - **Payload**: `{ fullName, companyName, phone, address }`
- **`updateSettings(data)`**
  - **HTTP & Endpoint**: `PATCH /api/users/me/settings`
  - **Payload**: `{ whatsappEnabled, emailEnabled, theme, language }`
- **`listAll(params)`**
  - **HTTP & Endpoint**: `GET /api/users` (requires Admin Bearer token)
  - **Query Params**: `?page=1&limit=20&search=ClientABC&status=PENDING`
  - **Expected Response**: `{ users: [...], totalCount: number }`
- **`verify(userId)`**
  - **HTTP & Endpoint**: `PATCH /api/users/:userId/verify` (requires Admin Bearer token)
- **`reject(userId)`**
  - **HTTP & Endpoint**: `PATCH /api/users/:userId/reject` (requires Admin Bearer token)

### 3. `shipmentsAPI` (Logistics Core)
- **`list(params)`**
  - **HTTP & Endpoint**: `GET /api/shipments` (Client: shows own; Admin: shows all)
  - **Query Params**: `?search=ID_001&status=TRANSIT`
  - **Expected Response**: `{ shipments: [{ id, packageType, originLocation, destinationLocation, status, createdAt, ... }] }`
- **`getStats(period)`**
  - **HTTP & Endpoint**: `GET /api/shipments/stats`
  - **Query Params**: `?period=daily|weekly|monthly|yearly`
  - **Expected Response**: `{ total: number, delivered: number, transit: number, pending: number, failed: number, cancelled: number }`
- **`getById(id)`**
  - **HTTP & Endpoint**: `GET /api/shipments/:id` (URL encoded)
- **`create(data)`**
  - **HTTP & Endpoint**: `POST /api/shipments`
  - **Payload**: `{ packageType, packageWeight, senderName, senderPhone, originLocation, receiverName, receiverPhone, destinationLocation, notes }`
- **`assign(id, data)`**
  - **HTTP & Endpoint**: `PATCH /api/shipments/:id/assign` (requires Admin Bearer token)
  - **Payload**: `{ driverId, vehicleId }`
- **`updateStatus(id, data)`**
  - **HTTP & Endpoint**: `PATCH /api/shipments/:id/status` (requires Admin Bearer token)
  - **Payload**: `{ status, description, location }` (updates core status field and logs a checkpoint trace)

### 4. `trackingAPI` (Timeline Events)
- **`getTimeline(shipmentId)`**
  - **HTTP & Endpoint**: `GET /api/tracking/:shipmentId`
  - **Expected Response**: `{ timeline: [{ id, status, description, location, createdAt }] }`
- **`addEvent(shipmentId, data)`**
  - **HTTP & Endpoint**: `POST /api/tracking/:shipmentId/events` (requires Admin Bearer token)
  - **Payload**: `{ status, description, location }`
- **`updateEvent(eventId, data)`**
  - **HTTP & Endpoint**: `PATCH /api/tracking/events/:eventId` (requires Admin Bearer token)
  - **Payload**: `{ status, description, location }`

### 5. `fleetAPI` (Drivers and Vehicles Registry)
- **`getDrivers(params)`**
  - **HTTP & Endpoint**: `GET /api/fleet/drivers`
  - **Expected Response**: `{ drivers: [{ id, name, licenseNumber, phone, status }] }`
- **`addDriver(data)`**
  - **HTTP & Endpoint**: `POST /api/fleet/drivers`
  - **Payload**: `{ name, licenseNumber, phone }`
- **`updateDriver(id, data)`**
  - **HTTP & Endpoint**: `PATCH /api/fleet/drivers/:id`
  - **Payload**: `{ name, licenseNumber, phone, status }`
- **`getVehicles(params)`**
  - **HTTP & Endpoint**: `GET /api/fleet/vehicles`
  - **Expected Response**: `{ vehicles: [{ id, plateNumber, type, capacity, status }] }`
- **`addVehicle(data)`**
  - **HTTP & Endpoint**: `POST /api/fleet/vehicles`
  - **Payload**: `{ plateNumber, type, capacity }`
- **`updateVehicle(id, data)`**
  - **HTTP & Endpoint**: `PATCH /api/fleet/vehicles/:id`
  - **Payload**: `{ plateNumber, type, capacity, status }`

### 6. `notificationsAPI` (Alerting Engine)
- **`list()`**
  - **HTTP & Endpoint**: `GET /api/notifications`
  - **Expected Response**: `{ notifications: [{ id, title, message, read, createdAt }], unreadCount: number }`
- **`markRead(id)`**
  - **HTTP & Endpoint**: `PATCH /api/notifications/:id/read`
- **`markAllRead()`**
  - **HTTP & Endpoint**: `PATCH /api/notifications/read-all`

---

## 🏗️ Commands for Development

Run these inside `apps/web/` if launching the frontend standalone:
```bash
# Install local packages (if not done from monorepo root)
npm install

# Boot development build on http://localhost:5173
npm run dev

# Lint JS and React JSX files
npm run lint

# Build optimized production bundle to the /dist folder
npm run build

# Preview the local production bundle locally
npm run preview
```
