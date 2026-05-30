/**
 * env.js — Runtime Environment Variable Validation
 *
 * This module validates all VITE_ environment variables the app needs
 * before React mounts. If any required variable is missing or malformed,
 * it throws an error immediately so the problem is visible at startup
 * rather than silently failing in production.
 *
 * Usage: import './lib/env.js' at the top of main.jsx.
 * The validated env object is also exported for use throughout the app.
 */

// ---------------------------------------------------------------------------
// Schema definition
// ---------------------------------------------------------------------------
// Each entry describes one environment variable.
// Fields:
//   required  — if true, throws when variable is absent or empty
//   default   — fallback value used when the var is optional and absent
//   validate  — optional function(value): returns error string or null
// ---------------------------------------------------------------------------
const schema = {
    // Cloudflare Turnstile site key (public, required for bot protection)
    VITE_TURNSTILE_SITE_KEY: {
        required: true,
        validate: (v) =>
            v.length < 10
                ? 'Must be a valid Turnstile site key (min 10 chars)'
                : null,
    },

    // Backend API base URL (no trailing slash)
    VITE_API_BASE_URL: {
        required: true,
        validate: (v) => {
            try {
                const url = new URL(v)
                if (!['http:', 'https:'].includes(url.protocol)) {
                    return 'Must use http:// or https:// protocol'
                }
                if (v.endsWith('/')) {
                    return 'Must NOT have a trailing slash'
                }
                return null
            } catch {
                return 'Must be a valid absolute URL (e.g. https://api.example.com)'
            }
        },
    },

    // Contact email (optional — falls back to .env.example default)
    VITE_CONTACT_EMAIL: {
        required: false,
        default: 'mahkotaputralogistik@yahoo.com',
        validate: (v) =>
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
                ? null
                : 'Must be a valid email address',
    },

    // WhatsApp link (optional)
    VITE_WHATSAPP_LINK: {
        required: false,
        default: '',
        validate: (v) => {
            if (!v) return null // empty optional is fine
            try {
                new URL(v)
                return null
            } catch {
                return 'Must be a valid URL (e.g. https://wa.link/xxx or https://wa.me/xxxx)'
            }
        },
    },

    // App display name (optional)
    VITE_APP_NAME: {
        required: false,
        default: 'PT Mahkota Putra Logistik',
    },
}

// ---------------------------------------------------------------------------
// Validation runner
// ---------------------------------------------------------------------------
function validateEnv() {
    const errors = []
    const validated = {}

    for (const [key, rules] of Object.entries(schema)) {
        const rawValue = import.meta.env[key]
        const value = typeof rawValue === 'string' ? rawValue.trim() : undefined

        if (!value) {
            if (rules.required) {
                errors.push(`  ✗ ${key}  →  MISSING (required)`)
                continue
            }
            // Use default for optional missing vars
            validated[key] = rules.default ?? ''
            continue
        }

        // Run format validator if present
        if (rules.validate) {
            const errorMsg = rules.validate(value)
            if (errorMsg) {
                errors.push(`  ✗ ${key}  →  INVALID: ${errorMsg}`)
                continue
            }
        }

        validated[key] = value
    }

    if (errors.length > 0) {
        const message = [
            '',
            '╔══════════════════════════════════════════════════════╗',
            '║        Environment Variable Validation Failed        ║',
            '╚══════════════════════════════════════════════════════╝',
            '',
            'The following variables are missing or invalid:',
            ...errors,
            '',
            'Fix: copy apps/web/.env.example → apps/web/.env',
            '     then fill in the missing values.',
            '',
        ].join('\n')

        // In development: surface clearly in the terminal and browser console.
        // In production builds: this will throw and prevent the app from loading.
        console.error(message)
        throw new Error(
            `[env] App cannot start — ${errors.length} environment variable(s) are missing or invalid. See console for details.`
        )
    }

    return validated
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
// `env` is the validated, trimmed env object. Import it instead of
// accessing import.meta.env directly so you get validated values only.
//
// Example:
//   import { env } from './lib/env.js'
//   fetch(env.VITE_API_BASE_URL + '/contact')
// ---------------------------------------------------------------------------
export const env = validateEnv()
