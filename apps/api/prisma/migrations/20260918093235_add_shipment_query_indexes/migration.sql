-- Query indexes for shipments. Postgres does not auto-index foreign keys and Prisma does
-- not add them, so clientId / driverId / vehicleId / pickupPlantId were all unindexed.
-- Every index here is justified by a query that runs today; see the comments in
-- schema.prisma for which one.
--
-- NOTE for the production cutover: plain CREATE INDEX takes a write lock for the duration.
-- At ~650k rows that is a few seconds each, which is fine pre-launch. If these ever need to
-- be added to a live database, run them as CREATE INDEX CONCURRENTLY by hand instead —
-- CONCURRENTLY cannot run inside Prisma's migration transaction.

-- CreateIndex
CREATE INDEX "shipments_clientId_createdAt_idx" ON "shipments"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "shipments_driverId_status_createdAt_idx" ON "shipments"("driverId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "shipments_vehicleId_status_createdAt_idx" ON "shipments"("vehicleId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "shipments_pickupPlantId_idx" ON "shipments"("pickupPlantId");

-- CreateIndex
CREATE INDEX "shipments_createdAt_idx" ON "shipments"("createdAt");
