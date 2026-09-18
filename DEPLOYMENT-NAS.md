# DEPLOYMENT-NAS — self-hosted deployment topology + security plan
<!-- Filename kept for stable links; hardware decision is a mini PC + Linux (§2.1), not a NAS. -->

> **Status: infrastructure still unbuilt, but much of the APPLICATION work is now done.**
> Created 2026-09-17. Shipped since (see §3 Layer 4 for detail): pagination · query indexes ·
> `trust proxy` · CORS allowlist · rate-limit gaps · access-control sweep · **signed file URLs** ·
> **image pipeline** · Turnstile verification (backend). Still to do: the auth rehaul + admin 2FA
> (needs client-side coordination), Redis-backed limits, and all of the Phase 0–5 infra itself.
> **DECIDED 2026-09-17: Option B — Cloudflare Tunnel + Cloudflare Access ("fullscale"), plus a LAN
> fallback for on-site staff.** Scale basis: **130k shipments/year**, now a **30-year** storage
> horizon (§2.2 — the 14-day image purge made the original 5-year framing moot).
> **Supersedes [DEPLOYMENT.md](DEPLOYMENT.md) §1 (topology) and §2 (access model)** — the LAN-only
> admin model is void. §3 (auth rehaul) and §5 (rate-limit hardening) still apply and are now
> **blocking**, not deferred. Companion: [SECURITY-MAGICLINK.md](SECURITY-MAGICLINK.md).

---

## 0. What changed, and why it matters

The original design made the admin dashboard **LAN-only and not internet-routable**. That wasn't a
convenience — it *was* the primary security control for the admin surface (DEPLOYMENT.md §2:
"local-only = enforced by NETWORK, not app logic").

**New requirement:** PIC Pabrik (and other PICs) work from different locations and need admin access.

**Consequence:** we lose network isolation. Every protection it silently provided must now be
replaced by edge + application controls. From here on, treat the admin panel as an
**internet-facing, high-value target**: it can create accounts, change shipment state, and read
client PII.

> **Core principle of this plan: "remote" must not mean "public."**
> Solve the geography problem with a **private overlay / identity-gated tunnel**, not by
> port-forwarding the admin panel to the open internet.

---

## 1. Recommended topology

Two surfaces, two different exposure models:

| Surface | Who uses it | Exposure | How |
|---|---|---|---|
| **Client app + client API** | MPL clients (the public) | Public HTTPS behind CDN/WAF | Cloudflare proxy → tunnel → NAS |
| **Admin app + admin API** | MPL staff + remote PICs | **Private — not publicly routable** | Tailscale (preferred) *or* Cloudflare Access |
| **Postgres** | the API only | **Never exposed** | Docker internal network, never published to host |

### ✅ CHOSEN — Option B (see below). Option A kept as a future migration path.

**LAN fallback (required, decided 2026-09-17):** keep the admin panel reachable over the **local
network** for on-site staff, firewalled to the LAN and **never port-forwarded**. Rationale: with
"fullscale B," an **ISP outage locks out even on-site staff** — the tunnel dies and nobody reaches
the panel even though the NAS is in the same room. The LAN path costs nothing and adds no public
exposure. ⚠️ Design implication: serve admin under **one HTTPS hostname that resolves from both the
LAN and the tunnel** (split-DNS or an internal cert), otherwise the Phase-2 cookie auth gets messy
(`Secure` cookies need HTTPS; `SameSite` differs across origins). Decide this *before* Phase 2.

### Option A — Tailscale overlay *(not chosen; revisit only if Access proves unworkable)*
- Install Tailscale on the NAS and on each PIC's device; bind the admin app to the tailnet only.
- **Zero inbound ports.** WireGuard-encrypted, device-level identity, per-device ACLs.
- Effectively recreates "LAN-only" across locations → **keeps the original security model intact**.
- Tailscale ACLs restrict PIC devices to just the admin app port.
- Free tier covers well beyond this team's device count.

### Option B — Cloudflare Tunnel + Cloudflare Access ✅ **CHOSEN**
- `cloudflared` runs on the NAS and dials **outbound** → still no port forwarding, origin IP hidden.
- **Cloudflare Access sits in front of the app**: SSO / email-OTP required before the app even
  loads → two independent auth layers (edge identity + app login).
- Bonus: WAF, DDoS absorption, bot mitigation, and an access audit log.
- Works from any browser with no client install.

### Option C — direct port-forward + reverse proxy ❌ *not recommended*
Only if A and B are both impossible. Then at minimum: expose **443 only**, Caddy/nginx with TLS,
fail2ban/CrowdSec, per-site IP allowlists, geo-blocking, aggressive rate limits — and accept a
materially higher risk of compromise.

---

## 2. Self-hosted stack shape

- **Docker Compose**: `postgres`, `api`, `web` (static), `caddy` (or `cloudflared`).
- **Reverse proxy: Caddy** — automatic Let's Encrypt certs, simplest for self-hosting.
- **Separate hostnames**: `app.<domain>` (client) and `admin.<domain>` (admin) — never one origin.
- **Postgres stays internal**: attached to the Docker network only, *not* published to the host.
- Pin image versions (no `:latest`); persistent named volumes with documented backup paths.

**Recommendation: keep the client web app on a cloud static host** (Vercel / Netlify / Cloudflare
Pages) rather than the NAS. It's the highest-traffic, most-exposed surface, and moving it off the
NAS shrinks the NAS attack surface to just API + admin.

**Why Postgres on the NAS (not managed cloud):** if the internet drops, on-site staff keep working;
no egress cost; simpler. Trade-off: resilience and backups become your responsibility → §3 Layer 5.

### 2.1 Hardware — **DECIDED 2026-09-17: mini PC + Linux**

| Spec | Requirement |
|---|---|
| CPU | x86_64, Intel **N100 / N305** class or better |
| RAM | **16 GB** (cheap on this platform; 8 GB is the floor) |
| OS | Debian/Ubuntu LTS + Docker + Compose |
| Storage | **2 × 1 TB NVMe in RAID 1** (`mdadm` / ZFS mirror) → **~1 TB usable** |
| Power | **UPS required** — power loss mid-write can corrupt Postgres (`nut` / `apcupsd`) |

**Capacity verdict: ~1 TB usable covers 30+ years.** Per §2.2, the 14-day image purge makes image
storage a **flat ~51 GB that never grows**, so the only component that accumulates is Postgres at
~4.5 GB/yr → ~136 GB at year 1, ~154 GB at year 5, ~266 GB at year 30.
*(An earlier revision of this section claimed "≈5.8 years of headroom" from ~145 GB/year of images —
that predated the 14-day retention decision and is superseded.)*

⚠️ **RAID 1 is redundancy, not backup.** A mirror replicates deletion and corruption *instantly* to
both disks. Offsite backups remain mandatory (§3 Layer 5).

**Object storage is now optional, not required.** With §2.3 in place the local disk covers capacity,
so B2/R2 is no longer needed to make the numbers work. It is still **recommended as the offsite
backup target**, and remains an easy future migration for photos (the `StorageAdapter` is already
pluggable to S3/Supabase). B2 ≈ $6/TB/mo with free egress when served through Cloudflare —
*verify current pricing before committing.*

*Synology "+" remains a valid alternative if you'd rather have RAID/hot-swap + a backup GUI; if you
go that route, note only x86 models support Container Manager (the "j"/ARM models cannot run Docker
at all). **Deployment is identical either way** — cloudflared + Docker Compose — so this choice does
not lock in the architecture.*

### 2.2 Storage sizing — 130k shipments/year, 30-year horizon

Basis: **650k shipments** total (~356/day).

**Database ≈ 35 KB/shipment** — `Shipment` row + ~8 `ShipmentEvent`s + `PlantCheck`/LKU unit rows
(~25/shipment) + notifications + audit-log rows + indexes/overhead.
→ **~4.5 GB/year → ~23 GB at 5 years.** Budget a **60 GB** DB volume. Trivial for Postgres.

**Files — sized against the decisions in §2.3 + §2.4** (WebP full-size, no resize, **14-day**
retention with an off-server archive; **all images purged at 14 days**):

| Tier | Per photo | Per shipment (4) | Per day | Retained | Steady-state |
|---|---|---|---|---|---|
| **Full-size WebP** (no downscale) | ~2.5 MB | ~10 MB | ~3.6 GB | **14 days** | **~50 GB** |
| **Thumbnails (400 px)** | ~30 KB | ~120 KB | ~43 MB | **14 days** | **~0.6 GB** |

📌 **All image storage is now a flat ~51 GB that never grows.** Every image is purged at 14 days
(client requirement), so nothing accumulates. That's what makes skipping the resize affordable —
unbounded full-res growth would be ~1.3 TB/yr, but a fixed window makes it a constant. The trade-off
is that the **off-server admin archive is the only long-term copy** (§2.4).

**Totals — mini PC, ~1 TB RAID 1 usable:**

| Component | Year 1 | Year 5 | Year 30 |
|---|---|---|---|
| OS + Docker | 30 GB | 30 GB | 30 GB |
| Postgres rows (~4.5 GB/yr, kept forever) | 5 GB | 23 GB | 135 GB |
| Logs (rotated) + local `pg_dump` history | 50 GB | 50 GB | 50 GB |
| **All images** — flat 14-day window (full-size + thumbs) | 51 GB | 51 GB | 51 GB |
| **Total** | **~136 GB** | **~154 GB** | **~266 GB** |

**Conclusion: storage is a solved problem.** With every image purged at 14 days, the only component
that grows at all is Postgres (~4.5 GB/yr). ~1 TB covers **well beyond 30 years** — no further
storage decision is needed for the foreseeable future.

Files stay on the **filesystem, not in Postgres `bytea`** ✅ (already true). The storage adapter is
pluggable to S3/Supabase, so photos can later move to object storage and decouple growth from NAS capacity.

---

### 2.3 Image pipeline — ✅ **IMPLEMENTED 2026-09-18** (`lib/upload.ts`)

> Built as **two profiles**, because the two kinds of image have opposite requirements:
>
> | Profile | Processing | Why |
> |---|---|---|
> | **`evidence`** | full resolution, WebP q82, **+ 400px thumbnail** q70 | zooming into a scratch is the point; affordable because these are purged at 14 days |
> | **`avatar`** | downscaled to **512px**, WebP q82, no thumbnail | ⚠️ avatars are **permanent** (not covered by the purge), so storing a 4 MB phone photo to render a 128px circle would be forever-bloat. At 512px it already *is* a thumbnail. |
>
> Verified at 12MP against the §2.2 assumptions: full-size **2.41 MB** (assumed 2.5), **3.36 GB/day**
> (assumed 3.6), **47 GB** for the 14-day window (assumed ~51). The sizing holds.
>
> ✅ **HEIC/HEIF confirmed working** — this sharp build (libvips 8.18.6) reports `heif input=yes`, and
> both `image/heic` and `image/heif` round-trip to WebP. So the open "does any PIC use an iPhone?"
> question is **moot**: iPhone uploads work either way.
>
> Also done: `.rotate()` (verified — a 1800×1200 JPEG tagged orientation=6 stores as 341×512
> portrait, so phone photos are not saved sideways) · `MAX_BYTES` 5 MB → **25 MB** · EXIF/GPS stripped
> by re-encoding · corrupt input returns **400**, not 500 · `deleteUpload` removes both tiers.
>
> The original spec below is kept as the record of what was decided.

### 2.3 (original spec) — WebP + thumbnail on upload 🔴 **required**

> **Revised 2026-09-17: the resize was dropped.** Originals stay at **full resolution** — being able
> to zoom into a scratch is the whole point of defect evidence, and 14-day retention (§2.4) plus an
> off-server archive makes local storage a non-issue. **WebP conversion + a thumbnail are still
> required**, both via `sharp`.

The single choke point already exists: **`apps/api/src/lib/upload.ts` → `saveUpload()`**. Every upload
flows through it, and today it has only **2 call sites (both avatars)** — the high-volume shipment
photos (handover proof, POD, plant-check, defect evidence) **aren't built yet**. Do this *before*
those features land so they inherit the pipeline automatically, instead of needing a retrofit + backfill.

`sharp` is already a dependency in `apps/web` (v0.35.4) and `apps/web/scripts/convert-to-webp.mjs` is
a working precedent. Add it to `apps/api` and produce **two** outputs inside `saveUpload`:

```js
// 1. full-size — format conversion only, NO downscale (evidence fidelity)
sharp(file.buffer).rotate().webp({ quality: 82 }).toBuffer()

// 2. thumbnail — list/report performance inside the 14-day window (§2.4)
sharp(file.buffer).rotate()
  .resize({ width: 400, fit: "inside", withoutEnlargement: true })
  .webp({ quality: 70 }).toBuffer()
```

Override the stored extension/mime to `webp` for both. Both tiers share the same 14-day retention
(§2.4), so the thumbnail exists purely to keep lists and reports fast — never fetch a 2.5 MB original
just to render a table row.

⚠️ **Bandwidth consequence of skipping the resize:** full-res WebP is ~2.5 MB vs ~250 KB resized —
**10× more** on every upload *and* every view. Since the office uplink is the throughput ceiling
(§6), **always render thumbnails in lists and reports**, and fetch the full-size only on explicit
click. *(Optional middle ground if field uploads prove slow: cap at ~2560 px — still plenty for
zooming into damage, roughly half the bytes.)*

**Gotchas — each of these bites in production:**
1. 🔴 **`.rotate()` is mandatory.** Processing strips EXIF; without auto-orient every phone photo saves **sideways**.
2. 🔴 **Raise `MAX_BYTES` to ~25 MB.** It is `5 MB` today, which **rejects most raw phone photos** — and multer's limit applies *before* sharp runs, so with no downscale the original must be accepted as-is. A driver's upload failing silently is the worst possible failure here. Keep a hard cap for DoS.
3. ⚠️ **Add HEIC/HEIF** to `IMAGE_MIMES` if any PIC uses an iPhone — iOS shoots HEIC by default, so those uploads are **rejected today**. (sharp decodes HEIF depending on the libvips build — verify.)
4. **Keep PDFs out of this path** — Surat Jalan documents must pass through untouched.
5. **EXIF/GPS trade-off** — stripping is a privacy win (phone photos embed GPS + device info). If you want location/timestamp as delivery *evidence*, extract it into DB columns **before** stripping.
6. **WhatsApp / OpenWA** — WebP isn't ideal for normal WhatsApp image messages; that path may need a JPEG variant.

CPU: sharp is libvips-backed (~100–300 ms/image). At ~356 shipments/day an N100 is comfortable; cap
concurrency only if bulk uploads are ever allowed.

### 2.4 Data retention — **revised 2026-09-17**

**Decided policy:**

| Data | Policy | Why |
|---|---|---|
| **Shipment rows + events + plant-check/LKU** | **Keep — no deletion** | Only ~4.5 GB/yr. Deleting at 2 yrs would save ~14 GB on a 1 TB disk (noise) while permanently capping the **condition-analytics reporting** (`ShipmentConditionChart`, `ServiceLineSummary`) to a 2-year window. |
| **Full-size images** | **14 days**, then purge per-day | Admins archive originals **off-server on upload**, so the server copy is only a working window. Keeps full-res on disk flat at ~50 GB. |
| **Thumbnails (400 px)** | **14 days** — purged with the originals | **Client requirement: *all* images deleted after 2 weeks.** Thumbnails are still generated, but only as a performance measure inside the window (§2.3). |
| **Audit log** | **Never auto-delete** | It is the forensic / compliance trail. |

**Off-server archive — manual, by design (decided 2026-09-17).** Admins copy originals to separate
storage at upload time. This is a deliberate manual process; no automation planned.

📌 What this means architecturally: the server copy is a **14-day working buffer**, not the record of
truth — **the admin archive is the record**. Anything asked after day 14 (e.g. an invoice dispute on
30/60/90-day terms) is answered from the archive, not from the app. Accepted.

⚠️ **Two consequences to handle in code:**
1. **No image of any kind survives past 14 days**, so the **graph detail report cannot show images
   for older periods.** It must degrade gracefully ("image no longer available") rather than render
   broken thumbnails.
2. The **analytics rollup table (DEV-PLAN.md) is now the *only* permanent record** of this data —
   there is no surviving visual record at all. That raises its importance rather than lowering it.

🔴 **Legal check before deleting anything:** Indonesian tax rules commonly require bookkeeping and
supporting documents be retained **~10 years**, and shipment records may qualify. **Confirm with your
accountant.** A policy that deletes records you are legally required to keep is a far worse problem
than a full disk.

**Requirements for the 14-day image purge job:**
- [x] ✅ **Stubbed 2026-09-18 in `lib/retention.ts`** — policy and safety rails built and tested; the
  category allowlist is **empty**, so it currently purges nothing. Deliberately not scheduled.
  🔴 **The trap it guards against:** keys are `<category>/<entityId>/<uuid>.webp`, and `avatars/` is
  permanent profile data, not evidence — so the instinctive "walk the uploads root, delete anything
  older than 14 days" would **delete every profile picture every 14 days**. The sweep is therefore
  allowlist-driven, and `avatars` sits in `PROTECTED_CATEGORIES`, which is refused *even if someone
  adds it to the allowlist* (verified: a 90-day-old avatar survived a real, non-dry-run sweep with
  `avatars` forced into the allowlist). `dryRun` defaults to **true**.
  **Left to do when the photo features land:** fill in the real categories, and clear the DB
  references for purged keys (there's a TODO at the exact spot — it can't be written until those
  photo columns exist).
- **Delete both tiers** (full-size + `*.thumb.webp`) — retention is uniform, and `thumbKeyFor()` in
  `lib/upload.ts` derives one key from the other.
- **Clear the DB reference** (`serahTerimaUrl`, etc.) so the UI renders an explicit "no longer
  available" state instead of a broken image.
- **Dry-run first, and keep it idempotent.** RAID 1 mirrors a bad delete to both disks instantly, so
  run it in report-only mode until the file set it selects looks correct.
- ⏭️ **Purge-window edge case — deferred to the last-mile phase.** "14 days from upload" means a
  shipment still in progress after 14 days loses its *earlier* photos (plant-check photos vanish
  before the gudang comparison step), with **no thumbnail fallback** now that all tiers are purged.
  This only becomes material once the journey extends to the client's door and shipments routinely
  exceed two weeks — so the decision is queued with that work, where the real end-to-end lead time
  will be known. See **[DEV-PLAN.md](DEV-PLAN.md) → "Last-mile leg: Gudang MPL → client's door"**.
  **Interim behaviour: purge strictly by upload date, as specified.**

**Still applies if row deletion is ever considered (not planned):**
- **FK-safe delete order** — shipments cascade into `ShipmentEvent`, `PlantCheck`/LKU/KSU and
  notifications; we already hit ordering pain during smoke-test cleanup.
- Prefer **archive-then-delete** (compressed export to cold storage) over hard deletion.

---

## 3. Security plan — layered

### Layer 1 — Edge / network
- **No inbound ports** (tunnel or Tailscale). If forwarding is unavoidable: 443 only, default-deny everything else.
- Cloudflare proxy in front of the public surface: hides origin IP, absorbs DDoS, WAF, bot mitigation.
- **Never expose** the NAS admin UI (DSM/QTS), SSH, SMB/AFP/FTP, or Postgres to the internet.
- Put the NAS on its **own VLAN**; firewall default-deny, restrict egress where practical.
- **Disable UPnP on the router** — prevents a service from silently auto-exposing itself.
- DDNS only if you go with Option C; tunnels remove the need entirely.

### Layer 2 — Transport
- TLS 1.2+ (prefer 1.3), auto-renewing certs, HTTP→HTTPS redirect everywhere.
- HSTS (add `preload` only once you're confident); `Secure` on all cookies.

### Layer 3 — Identity & session 🔴 **the biggest gap today**
- 🔴 **The auth rehaul is now MANDATORY, not deferred** (DEPLOYMENT.md §3). Today the admin JWT
  lives in `localStorage` → **one XSS = silent 7-day admin takeover**. That was tolerable on a LAN;
  it is not acceptable for an internet-reachable admin panel. Move to **httpOnly + Secure +
  SameSite cookies + CSRF tokens**; prefer **server-side sessions** for instant revocation.
- 🔴 **2FA/MFA on every admin account** (new requirement). TOTP at minimum. With Option B,
  Cloudflare Access supplies a second factor in front of the app as well.
- Strong password policy (length + common-password ban); keep bcrypt with a sane cost.
- **Failed-login lockout / throttle** per account *and* per IP.
- Short admin session lifetime + idle timeout; rotate on privilege change; **server-side revocation**
  when a role changes or an account is removed.
- **No shared accounts** — one per PIC, or the audit log is worthless.
- **Disable open client sign-up** (invite-only via magic link) — decision already flagged in SECURITY-MAGICLINK.md.

**Cloudflare Access policy model (the outer gate):**
- The allowlist can be **explicit email addresses** (a whitelisted personal Gmail works fine), a
  **whole email domain** (e.g. `@mpl.co.id`), or IdP groups — plus optional conditions (country, IP,
  require MFA).
- Flow: user opens `admin.<domain>` → Access challenges them → verified email checked against the
  allowlist → forwarded to the app → **then** they still log in to MPL with their own account.
  Anyone not on the allowlist **never reaches the app** — they cannot probe endpoints or try passwords.
- Offboarding: remove from the allowlist → locked out at the edge instantly, regardless of app state.
- 📌 **Access identity ≠ app identity.** Two lists to maintain (Cloudflare allowlist + MPL admin
  accounts) — keep them aligned to the same person/email or the audit trail loses meaning.
- **Branding:** the Access login page supports org name / logo / colors (MPL-branded). The **OTP
  email itself comes from Cloudflare** and isn't meaningfully brandable on the standard plan.
  Accepted for now — the MPL-branded factor users actually notice is the app's own login + TOTP 2FA.
  Upgrade path if a fully branded login is wanted later: **Google Workspace SSO** — *not* a
  self-hosted IdP, which would create a circular dependency (IdP or tunnel outage → nobody can log
  in to anything).

### Layer 4 — Application
- 🟠 **Zod validation + field size caps** on every endpoint, especially public auth/registration.
- [x] ✅ **Per-route rate limits — DONE 2026-09-18** (except Redis). Fixed two concrete gaps:
  **`/api/files` was mounted before the limiter and therefore completely unlimited** — an
  unauthenticated unbounded storage-IO surface; it now has its own looser bucket (3000/15min) so
  image loads still don't eat the API budget. And a **strict 15/15min limiter** now covers the
  unauthenticated token routes — which turned out to be worse than documented: `GET|POST
  /api/users/magic-link/:token[/register]` and `/reset-password/:token` live under `/api/users`, so
  the `/api/auth` limiter **never covered them at all** and they had only the general 1500/15min
  against a token check. Scoped by regex so the admin-authenticated `POST /api/users/magic-link`
  stays out of it. Verified: the token route 429s at exactly 15 while `/api/shipments` keeps its own
  bucket.
  ⏭️ **Still open: Redis store** (`rate-limit-redis`) — in-memory counters would multiply by replica
  count, so this is required before any second instance.
  💡 `API_MAX` (1500/15min, raised *because* of the 8s polling) can likely come down now that
  ShipmentsSection polls a 54-byte fingerprint — once the other four sections do the same.
- [x] ✅ **`trust proxy` — DONE 2026-09-18.** Configurable via `TRUST_PROXY_HOPS` (default 0 = no
  proxy, correct for dev) rather than a hardcoded `1`, because the count depends on the deployment:
  cloudflared alone = 1, Caddy in front of cloudflared = 2. ⚠️ It must be **exact** — too low and the
  limiter keys on the proxy IP so everyone shares one bucket; too high (or a blind `true`) and a
  caller can forge `X-Forwarded-For` for a fresh bucket per request. Documented in `.env.example`.
- [x] ✅ **CORS origin allowlist — DONE 2026-09-18.** Was single-origin (`CLIENT_URL`), which would
  have locked out the admin panel once it moved to its own hostname. Now an exact-match allowlist from
  `CLIENT_URL` + `ADMIN_URL` + `CORS_ORIGINS`. A rejected origin gets **no CORS header rather than a
  500**, and a request with no `Origin` (curl / server-to-server) is allowed since CORS has nothing to
  protect there. Verified against 6 origins including a blocked one.
- helmet + **CSP** including the API origin in `connect-src` and `img-src`.
- RBAC ✅ done · SUPERADMIN bypass ✅ done · audit log ✅ done — keep the audit log append-only.
- [x] ✅ **IDOR / access-control sweep — DONE 2026-09-18.** All 27 routes taking a path param audited.
  **Per-record ownership was already sound** — the client-reachable paths (`notifications/:id/read`
  scopes by `userId` in the WHERE; `tracking/:shipmentId` and `shipments/:id` both reject a
  mismatched `clientId`) were all correct. **The real gap was role-level, not record-level:** the
  sidebar hides client management from KEPALA_ARMADA / PIC_PABRIK / PIC_GUDANG / SUPPORT, but the API
  guarded verify / reject / edit / **delete** client and issue-password-reset with only `adminOnly` —
  so a PIC_PABRIK token could **delete a client account**. Tightened to `clientManagerOnly`
  (SUPERADMIN + OPERATIONS), matching the guard already used for *creating* a client. The two GETs
  stay `adminOnly` on purpose: KEPALA_ARMADA needs the client list for the shipment create-form
  picker and Beranda shows a Total Klien KPI. Also hardened `requireRole` to assert
  `type === "admin"` — it previously checked only `role` and was safe only by accident (see §3.8).
- [x] 🟠 **Turnstile — backend DONE 2026-09-18, frontend handoff outstanding.** The problem was worse
  than "no `siteverify` call": the widget was wired to the wrong places entirely — decorative on
  `HomePage` (no props, token discarded), button-gating only in the client `DeactivateModal`, and
  **absent from every login / registration / reset form**. So no attackable endpoint even received a
  token. `lib/turnstile.ts` now verifies properly and is applied to the 5 public endpoints; a token
  that *is* sent is always validated (bad → 403). ⚠️ **A missing token is still allowed through until
  `TURNSTILE_ENFORCE=true`** — deliberate, since failing closed today would break client registration
  and password reset. **Not real protection until the client forms send tokens and that flag is
  flipped** — see DEV-PLAN.md → "Client-side handoff".
- [x] ✅ **Pagination — DONE 2026-09-18** (`GET /api/shipments`, 25/page, server-side filters + the
  role-priority ordering). `/users` and `/fleet/*` were measured and deliberately left unpaginated —
  see DEV-PLAN.md. **Still open:** indexes on the columns actually filtered/sorted (`status`,
  `createdAt`, `clientId`, `driverId`, plus `originLocation`/`pickupDate` for the new ORDER BY).
  `Shipment` currently has only `@@index([linkGroupId])` and `@@index([status, completionDate])`.
- [x] ✅ **Server-side WebP + thumbnail on upload — DONE 2026-09-18.** See **§2.3** for what shipped and the measured numbers.
- File uploads: enforce type + size limits, store outside the web root, never serve executable.
- **Error hygiene** — never return stack traces or DB errors to clients.
- **Secrets**: env files with tight permissions, never in git; **rotate `JWT_SECRET`, CSRF secret and
  DB password at launch** (dev values must not survive into production).

### Layer 5 — Data
- Postgres: unique strong password, **least-privilege app role** (not superuser), no public bind.
- **Encryption at rest** (encrypted NAS volume / shared folder).
- PII minimization; never log emails, tokens, or password material.
- **Backups — 3-2-1**: 3 copies, 2 media, 1 offsite. Automated nightly `pg_dump`, **encrypted**,
  with a documented retention policy — and a **tested restore drill** (an untested backup is not a backup).

### Layer 6 — Host hardening
- **Patch discipline** on NAS OS + Docker images on a schedule. Synology/QNAP have a real
  ransomware track record; this is not optional for an internet-connected NAS.
- Disable the default `admin` account; use a unique admin name **with 2FA on the NAS itself**.
- SSH: key-only, no root login — or disabled entirely.
- Disable every unused service (SMB/AFP/FTP/Telnet/media/UPnP).
- Containers: don't run as root, least-privilege service accounts, read-only filesystems where possible.

### Layer 7 — Monitoring & response
- **fail2ban / CrowdSec** at the proxy for brute-force and scanner traffic.
- **External uptime monitoring** + alerting (so you learn before your clients do).
- Centralized logs with request IDs (pino → file/Loki), 30–90 day retention.
- **Sentry** for application errors.
- A written **incident plan**: who to call, how to revoke all sessions, how to rotate secrets, how to restore from backup.

---

### 3.8 Audit results — 2026-09-17

Point-in-time verification against the actual codebase, recorded so these don't get re-audited.

**✅ Verified already in place — no action needed**
| Control | Evidence |
|---|---|
| Password hashing | bcrypt cost 10 throughout *(optional: raise to 12 — cheap at this login volume)* |
| SQL injection | **Zero** raw SQL in app code — Prisma parameterizes everything |
| Secrets in git | **No real `.env` ever committed** to history |
| Public config hygiene | All `VITE_*` vars are legitimately public (API base URL, app name, contact email, Turnstile **site** key, WhatsApp link). **Rule: never put a secret in a `VITE_` var** — it is baked into the client bundle. |
| `passwordHash` exposure | Only ever written, or scope-selected for comparison — never returned to a client |
| XSS | React escapes by default. One `dangerouslySetInnerHTML` in `HeroSection.jsx` holds **static** JSON-LD SEO data — low risk, but it **must never receive user input** |
| Upload hardening | memory storage · 5 MB cap · mime allowlist · **UUID filenames** (no path traversal / overwrite) |
| Mass assignment | Creates/updates pick explicit fields instead of spreading `req.body` (e.g. `PATCH /users/me` accepts only fullName/companyName/phoneNumber) |

**❌ Explicitly NOT applicable — don't spend time on these**
| Item | Why |
|---|---|
| "Use a public DB key" | A **Supabase/Firebase `anon`-key** pattern. The browser never talks to Postgres here — DB credentials stay **fully private**. Applying this would be actively harmful. |
| "Enable row-level security (RLS)" | RLS matters when clients query the DB **directly**. Our API is the only DB client, so authorization belongs in the API layer. **Useful substitutes:** least-privilege DB role (Layer 5) + the IDOR audit (Layer 4). |

**✅ Verified in the access-control sweep — 2026-09-18**
| Checked | Result |
|---|---|
| Per-record ownership on client-reachable routes | **Already correct.** `notifications/:id/read` scopes by `userId`; `tracking/:shipmentId` and `shipments/:id` both 403 a mismatched `clientId`; the shipments list and `/version` scope non-admins by `clientId`. |
| `adminNotifications/:id/read` (no scoping) | **Not a vulnerability** — `AdminNotification` has no `adminId`; it is a shared feed by design (the GET is unscoped too). ⚠️ *Product* note: `isRead` is therefore global, so one admin marking an alert read hides it from everyone. |
| `/api/files` public, no auth | **By design and documented in the route**, with a warning not to serve sensitive files through it. Only avatars today. 🔴 **This blocks the image pipeline** — POD / plant-check / Surat Jalan would become readable by URL. The two tasks are coupled. |
| Path traversal on `/api/files` | **Safe** — `normalize()` + strip leading `..` + `join()`. Attacked with 12 payloads (`../.env`, url- and double-encoded, interior `..`, absolute, backslash, Windows drive, null byte): all 404. |
| `requireRole` | 🔧 **Fixed.** Asserted only `role`, never `type === "admin"`. Not exploitable today (client tokens carry role `"user"`), but safe only by accident — and `requirePermission` had always checked the type. |
| Client-management authorization | 🔧 **Fixed.** See Layer 4 — `adminOnly` let pipeline roles delete client accounts. |

**Resolved since:**
- [x] **`P2025` → 404 (fixed 2026-09-18).** `PATCH /api/users/:id`, `/:id/verify` and `/:id/reject`
  returned **500** for a nonexistent id, because Prisma's "record not found" fell into a blanket
  `catch`. Now 404 via `lib/prismaErrors.ts`. (`DELETE` and `/:id/set-main-pic` already had their own
  existence checks; the guard is redundant there, which is fine.)
- [x] **PIC_PABRIK plant scoping — DECIDED 2026-09-18: do NOT restrict.** The user's call: *"they
  will work more dynamically more than you think."* So a PIC bound to Plant A acting on a Plant B
  shipment is **intended behaviour**, and `Admin.pickupPlantId` stays what its schema comment already
  says — a soft default for the Lokasi Plant filter, not an authorization boundary. Don't "fix" this
  later thinking it's an oversight.

---

## 4. Impact on existing plans
| Doc | Change |
|---|---|
| DEPLOYMENT.md §1–2 (topology, LAN-only) | **Superseded** by this doc |
| DEPLOYMENT.md §3 (auth rehaul) | **Deferred → 🔴 BLOCKING** |
| DEPLOYMENT.md §5 (rate-limit hardening) | Still required; now covers the admin surface too |
| SECURITY-MAGICLINK.md Phase A | Still required |
| **New in this plan** | Admin 2FA · host hardening · backup + restore drill · Access policy model · LAN fallback |
| **Promoted to 🔴 launch blockers by the 130k/yr scale** | **Pagination** on list endpoints · **server-side image compression** on upload (§3 Layer 4) |
| Tier-2/3 items now on the critical path | Zod validation · Redis-backed rate limits · pino logging · pagination |

---

## 5. Phased rollout (no code in this phase)

> **Scope note:** Phases 0–5 below are **infra & security** phases. They are *not* the same as the
> "grand scheme" first-deployment milestone — app-level pre-launch work (pagination, FK indexes, the
> image pipeline, the **analytics rollup table**) is tracked in
> **[DEV-PLAN.md](DEV-PLAN.md) → "Performance & scale checklist"** and the rollup design section.
> Both must land before going live; they're just tracked in the doc where they belong.

- **Phase 0 — Decisions + procurement** (§7): buy the mini PC + UPS; create the Cloudflare account
  (2FA on, 2 admins); **migrate DNS from Domainesia to Cloudflare** (export *all* records first —
  MX/SPF/DKIM/DMARC — then diff, set the landing page to DNS-only, flip nameservers in a quiet
  window, verify mail send *and* receive).
- **Phase 1 — Infra skeleton:** Debian/Ubuntu + Docker Compose (api / db / proxy), `cloudflared`
  tunnel, Cloudflare Access policy on `admin.`, **LAN fallback path** (firewalled, not
  port-forwarded) on a single HTTPS hostname, Postgres isolated on NVMe, **object-storage bucket for
  uploads**, automated backups **with a restore test**.
- **Phase 2 — 🔴 Identity hardening (BLOCKS admin exposure):** cookie auth + CSRF, admin 2FA,
  login lockout, password policy, server-side session revocation.
- **Phase 3 — App hardening:** Zod, Redis-backed rate limits, `trust proxy`, CORS allowlist, CSP,
  pagination + FK indexes, IDOR sweep, Turnstile server-side verification, the **analytics rollup
  table** (DEV-PLAN.md), error hygiene, production secret rotation.
- **Phase 4 — Monitoring:** fail2ban/CrowdSec, Sentry, uptime checks, log pipeline, incident doc.
- **Phase 5 — Pre-launch verification:** `/security-review`, `npm audit`, `npm run security:scan`,
  `deploy-preflight`, restore drill, **external port scan of the NAS**, and confirm the NAS admin UI
  is unreachable from the internet.

> **Hard rule: do not expose the admin panel publicly until Phase 2 is done.**
> Interim path that unblocks remote PICs immediately: stand up **Tailscale in Phase 1** — it keeps
> the admin panel private while the identity hardening in Phase 2 proceeds.

---

## 6. Self-hosting risks
- **Dynamic IP / CGNAT** — tunnel or Tailscale removes the need for inbound reachability.
- **Office upload bandwidth** is the throughput ceiling for every remote PIC.
- **ISP terms** may prohibit servers on a residential line — check before committing.
- **Single point of failure** (NAS, power, ISP) → UPS, tested backups, optional cloud DB replica.
- **NAS vendor CVEs** → patch schedule; never expose the NAS management UI.

---

## 7. Decisions

**Decided 2026-09-17**
- [x] Access model: **Option B — Cloudflare Tunnel + Cloudflare Access**, plus a **LAN fallback** for on-site staff
- [x] Hardware: **mini PC + Linux, 2 × 1 TB NVMe RAID 1 (~1 TB usable)** + UPS
- [x] **Image pipeline (§2.3) — ✅ IMPLEMENTED 2026-09-18.** Final shape: **no resize** for evidence (full-res WebP q82 + 400 px thumbnail), 512 px for avatars. *(Supersedes the original "resize 1600 px + q75 + 320 px thumb" decision — the resize was dropped once 14-day retention made full resolution affordable.)*
- [x] **Retention (§2.4): keep shipment data forever; purge ALL images — including thumbnails — at 14 days** (client requirement), with admins archiving originals off-server. *(Supersedes the earlier "~5 yrs locally, no deletion cron" line.)*
- [x] Object storage is **optional** — not needed for capacity; recommended only as the offsite backup target
- [x] Registrar/DNS: currently **Domainesia** → migrate the zone to Cloudflare (landing page can stay hosted at Domainesia)
- [x] Access login: **Cloudflare email OTP** to start with an MPL-branded Access page; Google Workspace SSO is the upgrade path
- [x] Scale basis: **130k shipments/year**; storage horizon now **30 years** (§2.2)
- [x] Defaults accepted: `app.` + `admin.` subdomains · client web app on a cloud static host ·
      disable open client sign-up (invite-only) · backups 30 daily + 12 weekly, encrypted ·
      fresh production secrets generated at deploy time

**Still open — needed before Phase 1 work starts**
- [ ] **The actual domain name**, and whether it currently carries email (MX) — drives the DNS migration checklist
- [ ] Full-zone migration to Cloudflare **vs. a separate app-only domain** (zero risk to existing mail/site)
- [ ] **Initial admin allowlist** — explicit emails, or allow a whole domain?
- [ ] Mini-PC purchase (N100/N305-class, 16 GB RAM, 1–2 TB NVMe; 2nd slot for a mirror?)
- [ ] **Offsite backup target**: Backblaze B2 / Cloudflare R2 / external drive *(object storage is no longer needed for capacity — only for offsite)*
- [ ] **Accountant check** on the legal retention period for shipment records (§2.4)
- [x] ~~Does any PIC use an **iPhone**?~~ **Moot** — HEIC/HEIF support is implemented and verified working, so iPhone uploads work regardless.
- [ ] Offsite/DB backup target + retention confirmation
- [ ] SMTP provider for magic-link / notification email
- [ ] **OpenWA (WhatsApp gateway) host** — same box, or its own?
- [ ] Static LAN IP for the mini PC + office upload bandwidth
- [ ] Rough client count (tunes rate limits)
