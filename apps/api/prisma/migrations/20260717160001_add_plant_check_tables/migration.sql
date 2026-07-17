-- CreateTable
CREATE TABLE "plant_checks" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "tipeMotor" TEXT NOT NULL,
    "noShipping" TEXT NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "satuan" TEXT NOT NULL,
    "keterangan" TEXT,
    "checkedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plant_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_check_lku" (
    "id" TEXT NOT NULL,
    "plantCheckId" TEXT NOT NULL,
    "tipeMotor" TEXT,
    "noMesin" TEXT,
    "noRangka" TEXT,
    "warna" TEXT,
    "itemDefect" TEXT,

    CONSTRAINT "plant_check_lku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_check_ksu" (
    "id" TEXT NOT NULL,
    "plantCheckId" TEXT NOT NULL,
    "tipeMotor" TEXT,
    "helm" TEXT,
    "accu" TEXT,
    "spion" TEXT,
    "toolkit" TEXT,
    "bsBp" TEXT,
    "kKontak" TEXT,
    "fuse" TEXT,
    "platNo" TEXT,
    "sticker" TEXT,

    CONSTRAINT "plant_check_ksu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plant_checks_shipmentId_key" ON "plant_checks"("shipmentId");

-- AddForeignKey
ALTER TABLE "plant_checks" ADD CONSTRAINT "plant_checks_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_check_lku" ADD CONSTRAINT "plant_check_lku_plantCheckId_fkey" FOREIGN KEY ("plantCheckId") REFERENCES "plant_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_check_ksu" ADD CONSTRAINT "plant_check_ksu_plantCheckId_fkey" FOREIGN KEY ("plantCheckId") REFERENCES "plant_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
