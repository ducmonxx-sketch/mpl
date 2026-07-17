/*
  Warnings:

  - You are about to drop the column `jumlah` on the `plant_checks` table. All the data in the column will be lost.
  - You are about to drop the column `keterangan` on the `plant_checks` table. All the data in the column will be lost.
  - You are about to drop the column `noShipping` on the `plant_checks` table. All the data in the column will be lost.
  - You are about to drop the column `satuan` on the `plant_checks` table. All the data in the column will be lost.
  - You are about to drop the column `tipeMotor` on the `plant_checks` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "plant_checks" DROP COLUMN "jumlah",
DROP COLUMN "keterangan",
DROP COLUMN "noShipping",
DROP COLUMN "satuan",
DROP COLUMN "tipeMotor";

-- CreateTable
CREATE TABLE "plant_check_pengiriman" (
    "id" TEXT NOT NULL,
    "plantCheckId" TEXT NOT NULL,
    "tipeMotor" TEXT NOT NULL,
    "noShipping" TEXT,
    "jumlah" INTEGER,
    "satuan" TEXT,
    "keterangan" TEXT,

    CONSTRAINT "plant_check_pengiriman_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "plant_check_pengiriman" ADD CONSTRAINT "plant_check_pengiriman_plantCheckId_fkey" FOREIGN KEY ("plantCheckId") REFERENCES "plant_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
