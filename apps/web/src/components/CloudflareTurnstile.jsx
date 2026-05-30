import { useEffect, useRef, useCallback } from 'react'
import { env } from '../lib/env.js'

// Cloudflare's official "always passes" test key for local development.
// See: https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const TURNSTILE_TEST_KEY = '1x00000000000000000000AA'

/**
 * Cloudflare Turnstile invisible widget for bot protection.
 *
 * Props:
 *   onVerify(token)  — called when the user passes verification.
 *                       Send this token to your backend for server-side
 *                       validation via the Turnstile siteverify API.
 *   onError()        — optional callback when verification fails.
 */
export default function CloudflareTurnstile({ onVerify, onError }) {
    const containerRef = useRef(null)
    const widgetIdRef = useRef(null)

    // Use test key on localhost so the widget works without
    // adding localhost to the Cloudflare dashboard.
    const isLocalDev = typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    const siteKey = isLocalDev ? TURNSTILE_TEST_KEY : env.VITE_TURNSTILE_SITE_KEY

    // Stable reference so the effect doesn't re-run when props change.
    const onVerifyRef = useRef(onVerify)
    const onErrorRef = useRef(onError)
    onVerifyRef.current = onVerify
    onErrorRef.current = onError

    const renderWidget = useCallback(() => {
        if (containerRef.current && window.turnstile && widgetIdRef.current === null) {
            widgetIdRef.current = window.turnstile.render(containerRef.current, {
                sitekey: siteKey,
                size: 'invisible',
                callback: (token) => {
                    // TODO: Send this token to your backend for server-side
                    // verification using the Turnstile /siteverify endpoint:
                    // https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
                    if (onVerifyRef.current) {
                        onVerifyRef.current(token)
                    }
                },
                'error-callback': () => {
                    console.warn('[Turnstile] Verification error')
                    if (onErrorRef.current) {
                        onErrorRef.current()
                    }
                },
            })
        }
    }, [])

    useEffect(() => {
        // Load the Turnstile script if not already loaded
        if (!document.getElementById('cf-turnstile-script')) {
            const script = document.createElement('script')
            script.id = 'cf-turnstile-script'
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__onTurnstileLoad&render=explicit'
            script.async = true
            script.defer = true
            document.head.appendChild(script)
        }

        // Callback when script loads (uses a namespaced global to avoid collisions)
        window.__onTurnstileLoad = () => {
            renderWidget()
        }

        // If script already loaded, render immediately
        if (window.turnstile) {
            renderWidget()
        }

        return () => {
            if (widgetIdRef.current !== null && window.turnstile) {
                window.turnstile.remove(widgetIdRef.current)
                widgetIdRef.current = null
            }
        }
    }, [renderWidget])

    return (
        <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
            <div ref={containerRef}></div>
        </div>
    )
}
