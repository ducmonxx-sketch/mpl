import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteCompression from 'vite-plugin-compression'

// NOTE: These headers are applied by the Vite *development* server only.
// For production, configure equivalent headers at your CDN / hosting layer
// (e.g. Cloudflare Transform Rules, Nginx add_header, etc.).
export default defineConfig({
  plugins: [
    react(),
    // Pre-compress assets with gzip for production builds.
    // Cloudflare and most hosts can serve these directly.
    viteCompression({
      algorithm: 'gzip',
      threshold: 1024,    // Only compress files > 1KB
      ext: '.gz',
    }),
  ],

  build: {
    // Inline assets smaller than 4KB as base64 data URIs
    assetsInlineLimit: 4096,
    // Code splitting: separate vendor chunks for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    // Drop console.log in production (keep warn/error)
    minify: 'esbuild',
    target: 'es2020',
  },

  server: {
    headers: {
      // Force HTTPS for 1 year (browsers cache this; dev traffic is HTTP,
      // but having it here mirrors what production will enforce).
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',

      // Prevent this page from being embedded in an <iframe> on another origin.
      'X-Frame-Options': 'DENY',

      // Stop browsers from MIME-sniffing a response away from the declared type.
      'X-Content-Type-Options': 'nosniff',

      // Only send the origin (no path) as the referrer to cross-origin requests.
      'Referrer-Policy': 'strict-origin-when-cross-origin',

      // Opt out of powerful browser features the app does not use.
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',

      // Content Security Policy — restrict where resources can be loaded from.
      // PRODUCTION NOTE: Replace 'unsafe-inline' in script-src with a
      // nonce-based or 'strict-dynamic' approach. The _headers file in
      // public/ has a stricter production-ready CSP.
      'Content-Security-Policy': [
        "default-src 'self'",
        // React requires inline scripts during dev (HMR).
        // PRODUCTION: remove 'unsafe-inline' and use nonce-based CSP.
        "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
        // Allow inline styles used by Tailwind and component libraries.
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        // Google Fonts glyphs and Material Symbols.
        "font-src 'self' https://fonts.gstatic.com",
        // Images: self + data/blob URIs + the API origin (avatars, proofs served from the backend).
        "img-src 'self' data: blob: http://localhost:3001 https://api.mahkotaputralogistik.id",
        // API calls to the backend.
        "connect-src 'self' https://api.mahkotaputralogistik.id http://localhost:3001",
        // Cloudflare Turnstile widget iframe and Google Maps embeds.
        "frame-src https://challenges.cloudflare.com https://www.google.com https://maps.google.com",
        // No plugins (Flash etc.)
        "object-src 'none'",
        // Disable <base> hijacking.
        "base-uri 'self'",
        // Prevent form submissions to external URLs.
        "form-action 'self'",
      ].join('; '),
    },
  },
})

