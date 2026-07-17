-- AlterTable
ALTER TABLE "admins" ADD COLUMN     "pickupPlantId" TEXT;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_pickupPlantId_fkey" FOREIGN KEY ("pickupPlantId") REFERENCES "pickup_plants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
