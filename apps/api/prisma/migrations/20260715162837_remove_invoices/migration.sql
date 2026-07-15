/*
  Warnings:

  - You are about to drop the `invoices` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_clientId_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_createdByAdminId_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_shipmentId_fkey";

-- DropTable
DROP TABLE "invoices";

-- DropEnum
DROP TYPE "InvoiceStatus";
