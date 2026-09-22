/*
  Warnings:

  - You are about to drop the column `totpEnabledAt` on the `admins` table. All the data in the column will be lost.
  - You are about to drop the column `totpLastUsedStep` on the `admins` table. All the data in the column will be lost.
  - You are about to drop the column `totpSecret` on the `admins` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "admins" DROP COLUMN "totpEnabledAt",
DROP COLUMN "totpLastUsedStep",
DROP COLUMN "totpSecret";

-- CreateTable
CREATE TABLE "email_otps" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "email_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_otps_adminId_createdAt_idx" ON "email_otps"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "email_otps_expiresAt_idx" ON "email_otps"("expiresAt");

-- AddForeignKey
ALTER TABLE "email_otps" ADD CONSTRAINT "email_otps_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
