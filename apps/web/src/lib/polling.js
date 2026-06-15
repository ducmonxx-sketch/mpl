import { useEffect, useRef } from 'react'

// ============================================================
// Centralized polling cadence (milliseconds).
// Tune the dashboard's auto-refresh here — NOT at the call sites.
// ============================================================
export const POLL_INTERVAL = {
  // Operational data an admin actively watches change (driver/delivery activity).
  LIVE: 10_000,
  // Slow-changing reference data (clients, drivers, vehicles, invoices) — edited
  // occasionally, so refreshing every 30s is plenty and far less wasteful.
  REFERENCE: 30_000,
}

/**
 * Runs `onPoll` on an interval, with two refinements over a bare setInterval:
 *   1. Pauses while the browser tab is hidden (no pointless background requests).
 *   2. Fires once immediately when the tab becomes visible again, so stale data
 *      is refreshed the moment the admin returns.
 *
 * Does NOT fire on mount — keep your initial (non-silent) load as a separate
 * effect so the first paint still shows a loading state.
 *
 * `onPoll` is read via a ref, so passing a fresh closure each render does not
 * tear down and recreate the interval.
 *
 * @param {() => void} onPoll  Callback to run each tick (typically a silent refetch).
 * @param {number}     interval  Delay in ms (use POLL_INTERVAL.*). Falsy disables polling.
 */
export function usePolling(onPoll, interval) {
  const saved = useRef(onPoll)

  useEffect(() => {
    saved.current = onPoll
  }, [onPoll])

  useEffect(() => {
    if (!interval) return

    const tick = () => {
      if (document.visibilityState === 'visible') saved.current()
    }

    const id = setInterval(tick, interval)
    // Refresh immediately when the tab regains focus after being hidden.
    document.addEventListener('visibilitychange', tick)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [interval])
}
