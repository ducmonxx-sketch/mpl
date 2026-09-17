-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isMainPic" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: designate the earliest-created account as the main PIC for every
-- existing companyName group (same "company anchor" convention used elsewhere
-- for inheriting phone/city/address/npwp), and every account with no company
-- (trivially the sole "PIC" of itself).
WITH anchors AS (
  SELECT DISTINCT ON (COALESCE("companyName", id)) id
  FROM "users"
  ORDER BY COALESCE("companyName", id), "createdAt" ASC
)
UPDATE "users"
SET "isMainPic" = true
WHERE id IN (SELECT id FROM anchors);
