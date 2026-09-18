-- DropIndex
DROP INDEX "shipments_driverId_status_createdAt_idx";

-- DropIndex
DROP INDEX "shipments_vehicleId_status_createdAt_idx";

-- CreateIndex
CREATE INDEX "shipments_driverId_idx" ON "shipments"("driverId");

-- CreateIndex
CREATE INDEX "shipments_vehicleId_idx" ON "shipments"("vehicleId");

-- ── Partial indexes (hand-added: Prisma has no syntax for an index WHERE clause) ──────────
--
-- Fleet's "who is currently driving this?" include runs
--     WHERE driverId = ? AND status IN ('STANDBY','DITUGASKAN','TRANSIT')
--     ORDER BY "createdAt" DESC LIMIT 1
-- once per driver/vehicle, on a list that the dashboard polls every 8s.
--
-- Benchmarked at 200k rows: 63.8ms without these, 0.02ms with them — a 3000x difference.
-- The reason is a planner trap rather than a missing index: given LIMIT 1 with ORDER BY
-- "createdAt" DESC, the planner prefers to walk shipments_createdAt_idx backwards expecting
-- to hit a match quickly. For a driver with no active shipment there is no match, so it walks
-- the whole table ("Rows Removed by Filter: 200000"). A partial index covering exactly the
-- active subset is cheap enough that the planner picks it instead.
--
-- Measured alternatives, for the record:
--   drop shipments_createdAt_idx entirely  → fixes fleet, but the admin list goes 0.03ms →
--                                            39.6ms and a date range 0.03ms → 137.5ms
--   [driverId, status, createdAt] instead  → identical speed, 7.4 MB vs 1.2 MB each
CREATE INDEX "shipments_active_driver_idx"
  ON "shipments" ("driverId", "createdAt")
  WHERE "status" IN ('STANDBY', 'DITUGASKAN', 'TRANSIT');

CREATE INDEX "shipments_active_vehicle_idx"
  ON "shipments" ("vehicleId", "createdAt")
  WHERE "status" IN ('STANDBY', 'DITUGASKAN', 'TRANSIT');
