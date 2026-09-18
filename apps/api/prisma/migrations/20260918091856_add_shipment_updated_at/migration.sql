-- Adds Shipment.updatedAt — the change marker used by GET /api/shipments/version (cheap
-- poll fingerprint) and, later, by the analytics rollup's "recompute the last N days" job.
--
-- Hand-written. Prisma generated the single-statement form:
--     ALTER TABLE "shipments" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;
-- which cannot run against a non-empty table and was rejected. Instead: add it nullable,
-- backfill from createdAt (for a pre-existing row "last changed when it was created" is the
-- truthful value), then tighten to NOT NULL so the column matches the Prisma schema exactly
-- and does not report as drift.
--
-- No DEFAULT on purpose: @updatedAt is maintained by Prisma on every write, which is how
-- Prisma expects the column to look. Adding one here would show up as schema drift.

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "shipments" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

ALTER TABLE "shipments" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateIndex
-- Not optional: the version endpoint runs MAX("updatedAt") on every poll, and unindexed
-- that is a full table scan every 8s per logged-in admin.
-- NOTE for the production cutover: plain CREATE INDEX takes a brief write lock. At ~650k
-- rows that is seconds, and it runs before launch, so CONCURRENTLY (which cannot run inside
-- Prisma's migration transaction) is not needed here.
CREATE INDEX "shipments_updatedAt_idx" ON "shipments"("updatedAt");
