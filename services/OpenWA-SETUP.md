# OpenWA Setup — WhatsApp Gateway

How to set up the **OpenWA** self-hosted WhatsApp gateway and wire it to the MPL
backend. The backend (`apps/api`) sends driver/notification WhatsApp messages
through it via [`apps/api/src/services/whatsapp.ts`](../apps/api/src/services/whatsapp.ts).

OpenWA runs as a **separate service** from this monorepo.

---

## ⚠️ It is not committed to this repo

`services/OpenWA/` is **gitignored** (it's a large standalone project with its own
git repo). A fresh clone of MPL will **not** contain it — you must obtain it:

```bash
cd services
git clone https://github.com/rmyndharis/OpenWA.git
```

> **Do not put it under `apps/`.** The root `package.json` has `"workspaces": ["apps/*"]`,
> so OpenWA's NestJS/puppeteer dependencies would get hoisted into the monorepo root
> and break the workspace. Keep it in `services/`.

If OpenWA is not configured, the backend **degrades gracefully** — WhatsApp sends
become a no-op warning in the API log, no crash.

---

## 1. Install & configure

```bash
cd services/OpenWA
npm install        # NestJS + puppeteer Chromium + dashboard (postinstall) — a few minutes
```

Create `services/OpenWA/.env` (SQLite, local dev — no Docker/Postgres/Redis needed):

```env
PORT=2785
NODE_ENV=development

DATABASE_TYPE=sqlite
DATABASE_NAME=./data/openwa.sqlite
DATABASE_SYNCHRONIZE=true

ENGINE_TYPE=whatsapp-web.js
SESSION_DATA_PATH=./data/sessions
PUPPETEER_HEADLESS=true
PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage

STORAGE_TYPE=local
STORAGE_LOCAL_PATH=./data/media
REDIS_ENABLED=false
QUEUE_ENABLED=false

# Local dev ONLY: seeds the well-known, insecure key "dev-admin-key"
# (also written to services/OpenWA/data/.api-key on first boot).
# For anything beyond local, set API_MASTER_KEY=<secure value> instead and remove this.
ALLOW_DEV_API_KEY=true
```

> **Node version:** OpenWA targets **Node 22 LTS**. Newer (e.g. 24) generally works;
> if boot fails, suspect the `sqlite3` / puppeteer native modules.

---

## 2. Run it

```bash
npm run dev
```

| URL | What |
|---|---|
| http://localhost:2785/api | REST API |
| **http://localhost:2886** | **Dashboard (dev) — use this to scan the QR** |

> In `npm run dev` the dashboard runs on the Vite port **:2886**. Only the Docker/prod
> build bundles the dashboard onto :2785.

---

## 3. Link a WhatsApp number

In the dashboard (http://localhost:2886):

1. Create a session → **Start** → scan the QR with the phone (WhatsApp → **Linked Devices**).
2. Wait until the session status is **`ready`** (the phone number is populated).

**API key** for logging into the dashboard / API calls: **`dev-admin-key`**
(from `ALLOW_DEV_API_KEY=true`).

> ⚠️ **Gotcha:** the session **id changes** when a `qr_ready` session actually connects.
> Read the **final** id *after* it shows `ready`, not the one shown while waiting for the scan.

Get the connected session id via API:

```bash
curl -H "X-API-Key: dev-admin-key" http://localhost:2785/api/sessions
```

---

## 4. Wire the MPL backend to it

Add to `apps/api/.env` (see [`apps/api/.env.example`](../apps/api/.env.example)):

```env
OPENWA_BASE_URL=http://localhost:2785
OPENWA_API_KEY=dev-admin-key
OPENWA_SESSION_ID=<the connected session id from step 3>
```

**Restart the API** — it reads `.env` only at boot.

---

## 5. Test

The driver notification fires from the **Shipments** admin screen:

1. Open a shipment with an assigned driver (use a **real WhatsApp number** to verify receipt).
2. Click **"Kirim Notifikasi WhatsApp Driver"** → calls `POST /api/shipments/:id/notify-driver`,
   which sends the Bahasa Indonesia template via OpenWA.

Quick reachability check (no message sent):

```bash
# expect HTTP 404 "Pengiriman tidak ditemukan" — route is wired, nothing sent
curl -X POST -H "Authorization: Bearer <admin-jwt>" \
  http://localhost:3001/api/shipments/__nope__/notify-driver
```

Success/error shows in the API log: `[WhatsApp] Sent to …` or `[WhatsApp] OpenWA send failed (…)`.

---

## Contract (what `whatsapp.ts` calls)

```
POST {OPENWA_BASE_URL}/api/sessions/{OPENWA_SESSION_ID}/messages/send-text
  header: X-API-Key: {OPENWA_API_KEY}
  body:   { "chatId": "628xxxxxxxxxx@c.us", "text": "…" }
```

Phone normalization (`toChatId`): digits only; leading `0` → `62`; no country code → prefixed `62`
(assumes Indonesian numbers); result is `<intl>@c.us`.
