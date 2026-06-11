-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditActionType" ADD VALUE 'CREATE_USER';
ALTER TYPE "AuditActionType" ADD VALUE 'UPDATE_USER';
ALTER TYPE "AuditActionType" ADD VALUE 'DELETE_USER';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "npwp" TEXT;
