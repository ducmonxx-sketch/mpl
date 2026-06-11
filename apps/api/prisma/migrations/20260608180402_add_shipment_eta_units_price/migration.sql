-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "estimatedArrival" TIMESTAMP(3),
ADD COLUMN     "price" DECIMAL(12,2),
ADD COLUMN     "units" INTEGER;
