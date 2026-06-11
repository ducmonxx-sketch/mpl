-- AlterTable
ALTER TABLE "drivers" ADD COLUMN     "licenseExpiry" TIMESTAMP(3),
ADD COLUMN     "licenseNumber" TEXT,
ADD COLUMN     "licenseType" TEXT;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "kirExpiry" TIMESTAMP(3),
ADD COLUMN     "stnkExpiry" TIMESTAMP(3);
