# Client Credentials Delivery — Decision Record

How a newly created **client** account receives its login password.

Status: **Option A implemented** · Option B planned (email and/or WhatsApp)
Last updated: 2026-06-08

---

## Context

Admins create client accounts from the **Tambah Klien** modal (Manajemen Klien page).
The form collects company/contact details only — **Nama Perusahaan, PIC, telepon,
email, kota, alamat, NPWP**. There is deliberately **no password field**: the admin
is registering a corporate client, not setting that client's login.

So the password must be produced by the backend, not typed by the admin.

The relevant endpoint is [`POST /api/users`](../src/routes/users.ts).

---

## Decision

### ✅ Option A — auto-generate + return once (CURRENT)

`POST /api/users` requires only `fullName` + `email`. If no password is supplied:

1. A ~12-char temporary password is generated (`randomBytes(9).toString("base64url")`).
2. It is hashed with bcrypt and stored; the account is auto-verified (an admin vouches for it).
3. The plaintext password is returned **once** in the API response as `temporaryPassword`.

The admin then shares it with the client manually.

> ⚠️ Frontend follow-up (not done): the create-client handler currently ignores the
> response and shows a generic success toast. To use Option A end-to-end it should read
> `res.temporaryPassword` and display it to the admin (ties into the `credentialsCopied`
> UI already sketched in `UsersSection`).

### 🔜 Option B — deliver the credentials automatically (PLANNED)

Instead of returning the password to the admin, send it directly to the client via
**email and/or WhatsApp**. The account-creation logic is unchanged — it's one extra
`await send...()` call plus dropping `temporaryPassword` from the response. The hook
point is marked with a `TODO (Option B)` comment in `src/routes/users.ts`.

---

## Delivery channels considered

### Email (Resend) — recommended first step
- Free tier ~3,000 emails/mo (100/day); paid above.
- ToS-clean, reliable, we already collect the client's email.
- Requires verifying the sending domain (`mahkotaputralogistik.id`) via SPF/DKIM DNS
  records in Cloudflare — one-time ~10 min setup.

```ts
// src/lib/mailer.ts (sketch)
import { Resend } from "resend"
const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendCredentials(to: string, fullName: string, tempPassword: string) {
  await resend.emails.send({
    from: process.env.MAIL_FROM!,
    to,
    subject: "Akun MPL Logistik Anda telah dibuat",
    html: `<p>Halo ${fullName},</p>
           <p>Login: <b>${to}</b><br/>Password sementara: <b>${tempPassword}</b></p>
           <p>Harap segera ganti password setelah login pertama.</p>`,
  })
}
```

### WhatsApp (Fonnte) — strong complement
- Indonesian WhatsApp gateway. Connect our own number via QR (like WhatsApp Web),
  get a token, POST messages to `https://api.fonnte.com/send`.
- Has a limited free tier; stable use is a small monthly fee (cheap).
- **Caveat:** unofficial gateway (drives a real number via the WhatsApp Web protocol) —
  automated sends carry a **number-ban risk** if volume looks spammy. Fine for
  low-volume transactional messages to our own clients.
- **Phone format:** the form stores local format (`087887820101`); Fonnte needs
  international without `+` (`6287887820101`). Normalize `0…` → `62…` before sending.

```ts
// src/lib/whatsapp.ts (sketch)
export async function sendCredentialsWA(phone: string, fullName: string, tempPassword: string) {
  await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: { Authorization: process.env.FONNTE_TOKEN! },
    body: new URLSearchParams({
      target: phone, // already normalized to 62...
      message: `Halo ${fullName}, akun MPL Anda dibuat.\nPassword sementara: ${tempPassword}\nHarap ganti setelah login.`,
    }),
  })
}
```

### Official WhatsApp Cloud API (Meta) — not chosen
- Most reliable and ToS-safe, but per-message pricing and Meta Business verification.
- Overkill until we scale or need guaranteed compliance.

---

## Cost summary

| Option | Cost | Notes |
|---|---|---|
| Resend (email) | Free tier ~3k/mo, then paid | Cheapest reliable path; needs domain verification (free) |
| Nodemailer + existing mailbox | Free | Daily limits, spam-prone, not transactional-grade |
| Fonnte (WhatsApp, unofficial) | Limited free tier; cheap monthly paid | Uses our own number; ban risk; best delivery for ID clients |
| Meta WhatsApp Cloud API | Per-message + business verification | Only option that clearly costs per-message at volume |

**Genuinely free:** Resend free tier, or Nodemailer via an existing mailbox.

---

## Recommended sequencing

1. **Email via Resend** — free, reliable, ToS-clean. Lowest risk.
2. **Add Fonnte WhatsApp** as a complement (ID clients check WhatsApp more than email),
   accepting the small cost + ban risk.
3. Optionally send **both** (email always; WhatsApp if a phone number exists) — same
   call site, two helpers.

---

## Open decisions for when Option B is built

- **Email/WA fails but account was created:** don't 500 the request. Wrap the send in
  try/catch; on failure still return success but fall back to returning
  `temporaryPassword` so the admin can share it manually (flag e.g. `delivered: false`).
- **Force password change on first login:** emailing a temp password implies a reset.
  Needs a `mustChangePassword` flag on `User` + a reset flow. Optional next piece.
- **Env vars (server-side, no `VITE_` prefix):** `RESEND_API_KEY`, `MAIL_FROM`,
  `FONNTE_TOKEN`.
