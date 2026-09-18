// src/lib/retention.ts
//
// ⚠️ STUB — the policy and the safety rails are real and tested; the category list is
// deliberately EMPTY, so running this today deletes nothing. See "To arm this" below.
//
// The 14-day image purge from DEPLOYMENT-NAS.md §2.4. Stubbed now rather than built because
// the categories it must sweep don't exist yet: the shipment-photo features (handover proof,
// POD, plant-check, defect evidence) aren't implemented, so their storage categories would
// have to be invented here and would almost certainly be wrong.
//
// It exists in this shape because the obvious implementation is dangerous. Storage keys are
// `<category>/<entityId>/<uuid>.webp`, and the natural instinct — "walk the uploads root,
// delete anything older than 14 days" — would **delete every profile picture every 14 days**.
// Avatars are permanent profile data; only shipment photos are evidence with a retention
// window. So the sweep is allowlist-driven and physically refuses protected categories.
//
// ── To arm this ───────────────────────────────────────────────────────────────────────────
//   1. Add the real shipment-photo categories to PURGEABLE_CATEGORIES as those features land.
//   2. Run it in dry-run (the default) and read the log until the selected set looks right.
//   3. 🔴 Verify offsite backups first. RAID 1 mirrors a delete to both disks instantly, and
//      the admin off-server archive (§2.4) is the only other copy.
//   4. Clear the DB references for anything purged, or the UI renders broken images. There is
//      a deliberate TODO for that in purgeExpiredImages — it cannot be written until the
//      photo fields exist.
//   5. Only then schedule it (see the note at the bottom) with dryRun: false.

import { getStorage } from "./storage"
import { thumbKeyFor } from "./upload"

/** §2.4: all images — full-size and thumbnails alike — are purged 14 days after upload. */
export const PURGE_AFTER_DAYS = 14

/**
 * Categories the sweep is allowed to touch. **Empty on purpose** — nothing is purged until
 * the shipment-photo features exist and their real category names are added here.
 *
 * Expected additions (names TBC when those features are built), e.g.:
 *   "shipments"  — handover proof / POD
 *   "plant-check"— plant inspection + defect evidence
 */
export const PURGEABLE_CATEGORIES: readonly string[] = []

/**
 * Never purgeable, regardless of what anyone adds to the allowlist above.
 * `avatars` are profile pictures: permanent, not evidence, and not covered by §2.4.
 * This is a second line of defence, not documentation — see assertPurgeable.
 */
export const PROTECTED_CATEGORIES: readonly string[] = ["avatars"]

export class RetentionPolicyError extends Error {}

/**
 * Throws unless `category` is explicitly purgeable. Protected categories are rejected even
 * if they also appear in the allowlist, so a careless edit to PURGEABLE_CATEGORIES cannot
 * put avatars in scope.
 */
export function assertPurgeable(category: string): void {
  const c = category.replace(/^\/+|\/+$/g, "")
  if (!c) throw new RetentionPolicyError("Refusing to purge: empty category.")
  if (c === "." || c === "/" || c.includes("..")) {
    throw new RetentionPolicyError(`Refusing to purge suspicious category: "${category}"`)
  }
  if (PROTECTED_CATEGORIES.includes(c)) {
    throw new RetentionPolicyError(
      `Refusing to purge protected category "${c}" — these are permanent, not evidence.`,
    )
  }
  if (!PURGEABLE_CATEGORIES.includes(c)) {
    throw new RetentionPolicyError(
      `Refusing to purge "${c}": not in PURGEABLE_CATEGORIES. Add it deliberately.`,
    )
  }
}

export interface PurgeResult {
  dryRun: boolean
  cutoff: Date
  /** Keys that are (or would be) deleted. */
  selected: string[]
  deleted: number
  bytesFreed: number
  skippedCategories: string[]
}

/**
 * Sweep expired images out of the purgeable categories.
 *
 * `dryRun` defaults to **true**: it reports what it would remove and deletes nothing. That is
 * the intended way to inspect the selection before arming it, and it means an accidental
 * call is harmless.
 */
export async function purgeExpiredImages(
  opts: { dryRun?: boolean; now?: Date } = {},
): Promise<PurgeResult> {
  const dryRun = opts.dryRun ?? true
  const now = opts.now ?? new Date()
  const cutoff = new Date(now.getTime() - PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000)

  const result: PurgeResult = {
    dryRun,
    cutoff,
    selected: [],
    deleted: 0,
    bytesFreed: 0,
    skippedCategories: [],
  }

  if (PURGEABLE_CATEGORIES.length === 0) {
    console.warn(
      "[retention] no purgeable categories configured — nothing to do. " +
      "This is the stub state; see lib/retention.ts \"To arm this\".",
    )
    return result
  }

  const storage = getStorage()

  for (const category of PURGEABLE_CATEGORIES) {
    try {
      assertPurgeable(category)
    } catch (err) {
      // A bad entry skips that category rather than aborting the whole sweep.
      result.skippedCategories.push(category)
      console.error(`[retention] ${(err as Error).message}`)
      continue
    }

    const objects = await storage.list(category)
    for (const obj of objects) {
      if (obj.modifiedAt >= cutoff) continue

      // Thumbnails are found by the same listing, so they're handled naturally rather than
      // needing thumbKeyFor here — but the helper is the contract if a caller ever needs to
      // derive one key from the other.
      void thumbKeyFor

      result.selected.push(obj.key)
      result.bytesFreed += obj.bytes

      if (!dryRun) {
        await storage.delete(obj.key)
        result.deleted += 1
      }
    }
  }

  // TODO (when the photo features land): clear the DB columns that reference purged keys —
  // e.g. Shipment.serahTerimaUrl and the plant-check photo fields — or the UI will render
  // broken images for anything swept. Cannot be written yet: those fields don't exist.

  console.log(
    `[retention] ${dryRun ? "DRY RUN" : "PURGE"} — cutoff ${cutoff.toISOString()}, ` +
    `${result.selected.length} object(s), ${(result.bytesFreed / 1024 / 1024).toFixed(1)} MB` +
    (dryRun ? " (nothing deleted)" : ` deleted`),
  )
  return result
}

// Not scheduled on purpose. When armed, add to services/alertScheduler.ts (or its own
// service) on a daily timer, mirroring startAlertScheduler:
//
//   setInterval(() => purgeExpiredImages({ dryRun: false }).catch(console.error),
//               24 * 60 * 60 * 1000)
//
// Leave it at dryRun: true for the first few days in production and read the logs.
