// src/lib/validate.ts
//
// Request-body validation (DEPLOYMENT-NAS.md §3 Layer 4).
//
// Before this, the public endpoints trusted whatever arrived. `POST /api/auth/register` read
// five fields straight off req.body with no checks at all, and the magic-link registration
// only compared password === confirmPassword — so a 10 MB "email", a one-character password
// or a missing field reached bcrypt and Prisma before anything objected.
//
// Deliberately applied to the **auth and account surface first** rather than all 40
// body-carrying routes at once: those are the unauthenticated, bcrypt-backed,
// account-creating ones, so they carry nearly all of the risk for a fraction of the diff.
//
// Field size caps matter as much as the type checks here: without a max length, a public
// endpoint will happily hash a megabyte-long password.

import type { Response, NextFunction } from "express"
import { z, type ZodType } from "zod"
import type { AuthRequest } from "../middleware/auth"

/**
 * Validate (and normalise) `req.body` against `schema`.
 *
 * On success `req.body` is REPLACED with the parsed result, so handlers receive trimmed,
 * coerced values rather than raw input. Unknown keys are stripped rather than rejected —
 * the routes already pick fields explicitly, so rejecting extras would only break callers
 * that send something harmless.
 */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {})
    if (!result.success) {
      // First error only in `message` (it's what the UI shows); the rest in `errors` for
      // a form to highlight fields. No raw input is echoed back.
      const issues = result.error.issues
      const fields = issues.map((i) => ({
        field: i.path.join(".") || "(body)",
        message: i.message,
      }))
      return res.status(400).json({
        message: fields[0]?.message ?? "Data yang dikirim tidak valid.",
        errors: fields,
      })
    }
    req.body = result.data as Record<string, unknown>
    next()
  }
}

// ── Reusable field schemas ────────────────────────────────────────────────────────────────

/** Caps at 254 — the maximum length of an email address per RFC 5321. */
export const emailField = z
  .string({ message: "Email wajib diisi." })
  .trim()
  .min(1, "Email wajib diisi.")
  .max(254, "Email terlalu panjang.")
  .email("Format email tidak valid.")
  .toLowerCase()

/**
 * Password rules for NEW passwords. 8 is the floor; the 200 cap is the important half —
 * bcrypt on an unbounded string is a free CPU-burn primitive for an attacker.
 *
 * ⚠️ bcrypt silently truncates at 72 bytes, so anything beyond that adds no strength. The
 * cap is about refusing absurd input, not about entropy.
 */
export const newPasswordField = z
  .string({ message: "Password wajib diisi." })
  .min(8, "Password minimal 8 karakter.")
  .max(200, "Password terlalu panjang (maksimal 200 karakter).")

/** For LOGIN, where an existing password may predate the 8-char rule — only cap the length. */
export const loginPasswordField = z
  .string({ message: "Password wajib diisi." })
  .min(1, "Password wajib diisi.")
  .max(200, "Password terlalu panjang.")

const nameField = (label: string, max = 120) =>
  z.string({ message: `${label} wajib diisi.` })
    .trim()
    .min(1, `${label} wajib diisi.`)
    .max(max, `${label} terlalu panjang.`)

/** Optional free text with a cap; "" is normalised to undefined so it isn't stored as blank. */
const optionalText = (max: number) =>
  z.string().trim().max(max, `Maksimal ${max} karakter.`).optional()
    .transform((v) => (v === "" ? undefined : v))

export const phoneField = z
  .string()
  .trim()
  .max(32, "Nomor telepon terlalu panjang.")
  // Permissive on purpose: Indonesian numbers get written 08…, +62…, with spaces or dashes.
  // Validating format strictly here would reject legitimate input for no security gain.
  .regex(/^[0-9+()\-\s]*$/, "Nomor telepon hanya boleh berisi angka dan + ( ) -")
  .optional()
  .transform((v) => (v === "" ? undefined : v))

// ── Route schemas ─────────────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  fullName:    nameField("Nama lengkap"),
  companyName: optionalText(160),
  email:       emailField,
  password:    newPasswordField,
  phoneNumber: phoneField,
})

export const loginSchema = z.object({
  email:    emailField,
  password: loginPasswordField,
})

export const emailOnlySchema = z.object({ email: emailField })

export const changePasswordSchema = z.object({
  currentPassword: loginPasswordField,
  newPassword:     newPasswordField,
})

/** Magic-link registration: the invitee sets their own name + password. */
export const magicLinkRegisterSchema = z
  .object({
    fullName:        nameField("Nama lengkap"),
    email:           emailField.optional(),
    password:        newPasswordField,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Konfirmasi password tidak cocok.",
    path: ["confirmPassword"],
  })

export const resetPasswordSchema = z
  .object({
    password:        newPasswordField,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Konfirmasi password tidak cocok.",
    path: ["confirmPassword"],
  })

/**
 * Admin creates a full client account directly (POST /api/users).
 *
 * ⚠️ This is NOT the same shape as the magic-link invite below, and conflating the two broke
 * the "add company" form: Zod strips unknown keys, so applying the invite schema here
 * silently dropped fullName / password / phoneNumber / city / address / npwp, and the
 * handler's own `if (!fullName || !email)` then returned "fullName and email are required"
 * for a form that had in fact supplied them. Keep these two schemas separate.
 */
export const createUserSchema = z.object({
  fullName:    nameField("Nama lengkap"),
  email:       emailField,
  companyName: optionalText(160),
  // Optional: the route auto-generates a temporary password when none is given. Validated
  // only if actually supplied.
  password:    newPasswordField.optional(),
  phoneNumber: phoneField,
  city:        optionalText(80),
  address:     optionalText(300),
  npwp:        optionalText(40),
})

/**
 * Admin issues a registration invite (POST /api/users/magic-link) — invite fields only.
 *
 * ⚠️ Both constraints here were wrong on the first pass and broke the invite button:
 *   • email is OPTIONAL. The route stores `email || null` precisely so an admin can either
 *     pre-bind the invitee's address or leave the registrant to enter it.
 *   • accountType values are 'client' | 'operations' | 'support' — see
 *     MagicLink.accountType in schema.prisma, a plain String defaulting to "client". The
 *     first version invented MAIN_PIC / ADDITIONAL_PIC, borrowed from User.isMainPic, which
 *     is an unrelated concept. The UI sends 'client', so every invite was rejected.
 * Check schema.prisma before changing either.
 */
export const magicLinkSchema = z.object({
  companyName: nameField("Nama perusahaan", 160),
  email:       emailField.optional(),
  accountType: z.enum(["client", "operations", "support"]).optional(),
})

/** Client edits their own profile. Every field optional — it's a partial update. */
export const updateMeSchema = z.object({
  fullName:    nameField("Nama lengkap").optional(),
  companyName: optionalText(160),
  phoneNumber: phoneField,
})

/** Admin edits their own profile (Profil page). Admin has no phoneNumber column. */
export const updateAdminMeSchema = z.object({
  fullName: nameField("Nama lengkap").optional(),
})

/** Admin edits a client record. */
export const updateClientSchema = z.object({
  fullName:    nameField("Nama lengkap").optional(),
  companyName: optionalText(160),
  email:       emailField.optional(),
  phoneNumber: phoneField,
  city:        optionalText(80),
  address:     optionalText(300),
  npwp:        optionalText(40),
})
