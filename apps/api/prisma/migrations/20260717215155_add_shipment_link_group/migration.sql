-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "linkGroupId" TEXT;

-- CreateIndex
CREATE INDEX "shipments_linkGroupId_idx" ON "shipments"("linkGroupId");
