// src/lib/prismaErrors.ts
//
// Small helpers for turning Prisma's error codes into the right HTTP status.
//
// Why: routes that `update`/`delete` by a caller-supplied `:id` sit inside a blanket
// `catch (err) { res.status(500) }`. Prisma throws P2025 when the id doesn't exist, so a
// simple typo in an id came back as "server error" instead of "not found" — which is both
// confusing for the caller and noise in the logs, since nothing is actually broken.

/**
 * P2025 — "An operation failed because it depends on one or more records that were required
 * but not found." Raised by `update`, `delete`, and their `...OrThrow` siblings when the
 * target row is missing (including from inside a `$transaction`).
 */
export function isRecordNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2025"
  )
}

/**
 * P2002 — unique constraint violation. Useful where a route doesn't pre-check for a clash
 * and would otherwise report a 500 for what is really a 409/400.
 */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2002"
  )
}
