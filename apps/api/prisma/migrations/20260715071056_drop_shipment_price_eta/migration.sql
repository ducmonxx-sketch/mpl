/*
  Warnings:

  - You are about to drop the column `estimatedArrival` on the `shipments` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `shipments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "shipments" DROP COLUMN "estimatedArrival",
DROP COLUMN "price";
