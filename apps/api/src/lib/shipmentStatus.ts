// src/lib/shipmentStatus.ts
//
// Shared driver/vehicle guard + status-mirror used by every route that moves a shipment's
// status (/status, /plant-check, /handover). One implementation so the departure guard and
// the fleet (driver+vehicle) mirror stay consistent — and so the linked-shipment exceptions
// live in exactly one place.

import prisma from "./prisma"

// Statuses in which a shipment still "occupies" its driver + vehicle (not terminal).
const OCCUPYING = ["STANDBY", "DITUGASKAN", "AT_PLANT", "TRANSIT", "DITERIMA", "DITURUNKAN"]

// Departure guard: only ONE shipment per driver may be in TRANSIT at a time.
// Returns the id of a conflicting (different) TRANSIT shipment, or null if clear.
// Linked shipments (same linkGroupId) may co-transit — a sibling is NOT a conflict.
export async function findTransitConflict(driverId: string, shipmentId: string, linkGroupId?: string | null): Promise<string | null> {
  const conflict = await prisma.shipment.findFirst({
    where:  {
      driverId, status: "TRANSIT", id: { not: shipmentId },
      ...(linkGroupId ? { linkGroupId: { not: linkGroupId } } : {}),
    },
    select: { id: true },
  })
  return conflict?.id ?? null
}

// Free a driver + vehicle IF no remaining shipment still occupies them (group-aware).
// Call AFTER deleting a shipment so the deleted row isn't counted.
export async function releaseFleetIfUnused(driverId?: string | null, vehicleId?: string | null): Promise<void> {
  if (driverId) {
    const other = await prisma.shipment.findFirst({ where: { driverId, status: { in: OCCUPYING as any } }, select: { id: true } })
    if (!other) await prisma.driver.updateMany({ where: { id: driverId, status: { in: ["STANDBY", "ON_DUTY"] } }, data: { status: "ACTIVE" } })
  }
  if (vehicleId) {
    const other = await prisma.shipment.findFirst({ where: { vehicleId, status: { in: OCCUPYING as any } }, select: { id: true } })
    if (!other) await prisma.vehicle.updateMany({ where: { id: vehicleId, status: { in: ["STANDBY", "IN_USE"] } }, data: { status: "AVAILABLE" } })
  }
}

type MirrorRule = { driverFrom: string[]; driverTo: string; vehFrom: string[]; vehTo: string }
const RULES: Record<string, MirrorRule> = {
  STANDBY: { driverFrom: ["ACTIVE"],             driverTo: "STANDBY", vehFrom: ["AVAILABLE"],            vehTo: "STANDBY"   },
  ENGAGE:  { driverFrom: ["ACTIVE", "STANDBY"],  driverTo: "ON_DUTY", vehFrom: ["AVAILABLE", "STANDBY"], vehTo: "IN_USE"    },
  RELEASE: { driverFrom: ["ON_DUTY", "STANDBY"], driverTo: "ACTIVE",  vehFrom: ["IN_USE", "STANDBY"],    vehTo: "AVAILABLE" },
}

function ruleFor(status: string): MirrorRule | null {
  if (status === "STANDBY") return RULES.STANDBY
  if (status === "DITUGASKAN" || status === "AT_PLANT" || status === "TRANSIT") return RULES.ENGAGE
  if (status === "DELIVERED" || status === "CANCELLED") return RULES.RELEASE
  return null  // DITERIMA/DITURUNKAN/PENDING/FAILED: no fleet change (driver stays engaged through the gudang leg)
}

// Mirror a shipment's new status onto its driver + vehicle (1:1), status-filtered so
// UNAVAILABLE drivers / MAINTENANCE vehicles are never overridden. RELEASE is group-aware:
// the driver/vehicle is only freed when NO other occupying shipment still uses them
// (so finishing one linked shipment doesn't free a truck still out on its sibling).
export async function mirrorFleetStatus(
  status: string,
  driverId: string | null | undefined,
  vehicleId: string | null | undefined,
  shipmentId: string,
): Promise<void> {
  const rule = ruleFor(status)
  if (!rule) return

  let dId = driverId
  let vId = vehicleId
  if (rule === RULES.RELEASE) {
    if (dId) {
      const other = await prisma.shipment.findFirst({ where: { driverId: dId, status: { in: OCCUPYING as any }, id: { not: shipmentId } }, select: { id: true } })
      if (other) dId = null
    }
    if (vId) {
      const other = await prisma.shipment.findFirst({ where: { vehicleId: vId, status: { in: OCCUPYING as any }, id: { not: shipmentId } }, select: { id: true } })
      if (other) vId = null
    }
  }

  if (dId) await prisma.driver.updateMany({ where: { id: dId, status: { in: rule.driverFrom as any } }, data: { status: rule.driverTo as any } })
  if (vId) await prisma.vehicle.updateMany({ where: { id: vId, status: { in: rule.vehFrom as any } }, data: { status: rule.vehTo as any } })
}
