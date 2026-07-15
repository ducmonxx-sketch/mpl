-- CreateEnum
CREATE TYPE "Manufacturer" AS ENUM ('HONDA', 'YAMAHA', 'SUZUKI');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminRole" ADD VALUE 'KEPALA_ARMADA';
ALTER TYPE "AdminRole" ADD VALUE 'PIC_PABRIK';
ALTER TYPE "AdminRole" ADD VALUE 'PIC_GUDANG';

-- AlterEnum
ALTER TYPE "ShipmentStatus" ADD VALUE 'AT_PLANT';

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "containerType" TEXT,
ADD COLUMN     "dimensions" TEXT,
ADD COLUMN     "handoverNotes" TEXT,
ADD COLUMN     "lkuNumber" TEXT,
ADD COLUMN     "pabrikNotes" TEXT,
ADD COLUMN     "pickupPlantId" TEXT,
ADD COLUMN     "serahTerimaUrl" TEXT,
ADD COLUMN     "shippingCategory" TEXT,
ADD COLUMN     "vehicleCondition" TEXT;

-- CreateTable
CREATE TABLE "pickup_plants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "manufacturer" "Manufacturer" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pickup_plants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pickup_plants_name_key" ON "pickup_plants"("name");

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_pickupPlantId_fkey" FOREIGN KEY ("pickupPlantId") REFERENCES "pickup_plants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
