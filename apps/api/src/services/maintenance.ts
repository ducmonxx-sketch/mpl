// src/services/maintenance.ts
//
// Phase 2e housekeeping. Four tables accumulate rows that are dead but never removed:
// sessions, email OTPs, trusted devices and login attempts. Each prune helper already
// existed; nothing was calling them, so the rows just grew forever.
//
// Daily is ample — none of these grow quickly at this scale, and the retention windows are
// deliberately longer than the functional lifetime so there's an audit trail (e.g. login
// attempts are kept 30 days even though the lockout window is 15 minutes).

import { pruneExpiredSessions } from "../lib/session"
import { pruneEmailOtps } from "../lib/emailOtp"
import { pruneTrustedDevices } from "../lib/trustedDevice"
import { pruneLoginAttempts } from "../lib/loginGuard"

const DAY_MS = 24 * 60 * 60 * 1000

export async function runMaintenance(): Promise<void> {
  const jobs: [string, () => Promise<number>][] = [
    ["sessions", pruneExpiredSessions],
    ["emailOtps", pruneEmailOtps],
    ["trustedDevices", pruneTrustedDevices],
    ["loginAttempts", pruneLoginAttempts],
  ]
  const out: string[] = []
  for (const [name, fn] of jobs) {
    try {
      out.push(`${name}=${await fn()}`)
    } catch (err) {
      // One failing prune must not stop the others, and must never take the process down.
      console.error(`[maintenance] ${name} failed:`, err)
      out.push(`${name}=ERR`)
    }
  }
  console.log(`[maintenance] pruned ${out.join(" ")}`)
}

export function startMaintenanceScheduler(): void {
  // Deliberately not on boot: a restart loop would otherwise hammer the DB with deletes.
  setTimeout(() => {
    runMaintenance().catch((e) => console.error("[maintenance]", e))
    setInterval(() => runMaintenance().catch((e) => console.error("[maintenance]", e)), DAY_MS)
  }, 60_000)
}
