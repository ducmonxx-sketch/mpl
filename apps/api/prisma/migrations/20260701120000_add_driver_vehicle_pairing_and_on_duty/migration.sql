-- AlterEnum: add ON_DUTY to DriverStatus
ALTER TYPE "DriverStatus" ADD VALUE 'ON_DUTY';

-- AlterTable: add primaryDriverId to vehicles (1:1 driver↔vehicle pairing)
ALTER TABLE "vehicles" ADD COLUMN "primaryDriverId" TEXT;

-- CreateIndex: enforce 1:1 — a driver can only be primary on one vehicle
CREATE UNIQUE INDEX "vehicles_primaryDriverId_key" ON "vehicles"("primaryDriverId");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_primaryDriverId_fkey" FOREIGN KEY ("primaryDriverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
