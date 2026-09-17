-- AlterTable
ALTER TABLE "plant_check_lku" ADD COLUMN     "arrivalNote" TEXT,
ADD COLUMN     "arrivedDefective" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "shipments_status_completionDate_idx" ON "shipments"("status", "completionDate");
