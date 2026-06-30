// src/routes/fleet.ts
//
//   GET    /api/fleet/drivers          → list all drivers
//   POST   /api/fleet/drivers          → add a driver
//   PATCH  /api/fleet/drivers/:id      → update driver
//   DELETE /api/fleet/drivers/:id      → delete driver (unlinks from shipments)
//
//   GET    /api/fleet/vehicles         → list all vehicles
//   POST   /api/fleet/vehicles         → add a vehicle
//   PATCH  /api/fleet/vehicles/:id     → update vehicle
//   DELETE /api/fleet/vehicles/:id     → delete vehicle (unlinks from shipments)

import { Router, Response } from "express"
import prisma from "../lib/prisma"
import { authenticate, adminOnly, AuthRequest } from "../middleware/auth"
import { flagIfExpired } from "../lib/expiry"

const router = Router()

// ════════════════════════════════════
// DRIVERS
// ════════════════════════════════════

router.get("/drivers", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query

    const drivers = await prisma.driver.findMany({
      where:   status ? { status: status as any } : {},
      include: { _count: { select: { shipments: true } } },
      orderBy: { fullName: "asc" },
    })

    res.json({ drivers })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch drivers." })
  }
})

router.post("/drivers", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { fullName, phoneNumber, licenseNumber, licenseType, licenseExpiry } = req.body

    const driver = await prisma.driver.create({
      data: {
        fullName,
        phoneNumber,
        licenseNumber:        licenseNumber ?? null,
        licenseType:          licenseType ?? null,
        licenseExpiry:        licenseExpiry ? new Date(licenseExpiry) : null,
        lastUpdatedByAdminId: req.user!.id,
      },
    })

    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "CREATE_DRIVER",
        targetTable:    "drivers",
        targetRecordId: driver.id,
        changesSummary: `Created driver ${fullName}`,
      },
    })

    await flagIfExpired("driver", driver.id, "SIM/Lisensi", driver.fullName, driver.licenseExpiry)

    res.status(201).json({ message: "Driver created.", driver })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to create driver." })
  }
})

router.patch("/drivers/:id", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { fullName, phoneNumber, status, licenseNumber, licenseType, licenseExpiry } = req.body

    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data: {
        ...(fullName      && { fullName }),
        ...(phoneNumber   && { phoneNumber }),
        ...(status        && { status }),
        ...(licenseNumber !== undefined && { licenseNumber }),
        ...(licenseType   !== undefined && { licenseType }),
        ...(licenseExpiry !== undefined && { licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null }),
        lastUpdatedByAdminId: req.user!.id,
      },
    })

    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "UPDATE_DRIVER",
        targetTable:    "drivers",
        targetRecordId: driver.id,
        changesSummary: `Updated driver ${driver.fullName}`,
      },
    })

    await flagIfExpired("driver", driver.id, "SIM/Lisensi", driver.fullName, driver.licenseExpiry)

    res.json({ message: "Driver updated.", driver })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to update driver." })
  }
})

router.delete("/drivers/:id", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id

    const driver = await prisma.driver.findUnique({
      where:  { id },
      select: { id: true, fullName: true },
    })

    if (!driver) {
      return res.status(404).json({ message: "Driver not found." })
    }

    // Unlink from any shipments (preserve shipment history), then delete
    await prisma.$transaction([
      prisma.shipment.updateMany({ where: { driverId: id }, data: { driverId: null } }),
      prisma.driver.delete({ where: { id } }),
    ])

    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "DELETE_DRIVER",
        targetTable:    "drivers",
        targetRecordId: id,
        changesSummary: `Deleted driver ${driver.fullName}`,
      },
    })

    res.json({ message: "Driver deleted." })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to delete driver." })
  }
})

// ════════════════════════════════════
// VEHICLES
// ════════════════════════════════════

router.get("/vehicles", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query

    const vehicles = await prisma.vehicle.findMany({
      where:   status ? { status: status as any } : {},
      include: { _count: { select: { shipments: true } } },
      orderBy: { type: "asc" },
    })

    res.json({ vehicles })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch vehicles." })
  }
})

router.post("/vehicles", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { type, licensePlate, stnkExpiry, kirExpiry, serviceDate, chassisNumber, engineNumber } = req.body

    const existing = await prisma.vehicle.findUnique({ where: { licensePlate } })
    if (existing) {
      return res.status(400).json({ message: "License plate already registered." })
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        type,
        licensePlate,
        stnkExpiry:           stnkExpiry ? new Date(stnkExpiry) : null,
        kirExpiry:            kirExpiry ? new Date(kirExpiry) : null,
        serviceDate:          serviceDate ? new Date(serviceDate) : null,
        chassisNumber:        chassisNumber || null,
        engineNumber:         engineNumber || null,
        lastUpdatedByAdminId: req.user!.id,
      },
    })

    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "CREATE_VEHICLE",
        targetTable:    "vehicles",
        targetRecordId: vehicle.id,
        changesSummary: `Created vehicle ${type} — ${licensePlate}`,
      },
    })

    await flagIfExpired("vehicle", vehicle.id, "STNK", vehicle.licensePlate, vehicle.stnkExpiry)
    await flagIfExpired("vehicle", vehicle.id, "KIR", vehicle.licensePlate, vehicle.kirExpiry)
    await flagIfExpired("vehicle", vehicle.id, "Jadwal Service", vehicle.licensePlate, vehicle.serviceDate)

    res.status(201).json({ message: "Vehicle created.", vehicle })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to create vehicle." })
  }
})

router.patch("/vehicles/:id", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { type, licensePlate, status, stnkExpiry, kirExpiry, serviceDate, chassisNumber, engineNumber } = req.body

    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: {
        ...(type         && { type }),
        ...(licensePlate && { licensePlate }),
        ...(status       && { status }),
        ...(stnkExpiry    !== undefined && { stnkExpiry: stnkExpiry ? new Date(stnkExpiry) : null }),
        ...(kirExpiry     !== undefined && { kirExpiry: kirExpiry ? new Date(kirExpiry) : null }),
        ...(serviceDate   !== undefined && { serviceDate: serviceDate ? new Date(serviceDate) : null }),
        ...(chassisNumber !== undefined && { chassisNumber: chassisNumber || null }),
        ...(engineNumber  !== undefined && { engineNumber: engineNumber || null }),
        lastUpdatedByAdminId: req.user!.id,
      },
    })

    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "UPDATE_VEHICLE",
        targetTable:    "vehicles",
        targetRecordId: vehicle.id,
        changesSummary: `Updated vehicle ${vehicle.licensePlate}`,
      },
    })

    await flagIfExpired("vehicle", vehicle.id, "STNK", vehicle.licensePlate, vehicle.stnkExpiry)
    await flagIfExpired("vehicle", vehicle.id, "KIR", vehicle.licensePlate, vehicle.kirExpiry)
    await flagIfExpired("vehicle", vehicle.id, "Jadwal Service", vehicle.licensePlate, vehicle.serviceDate)

    res.json({ message: "Vehicle updated.", vehicle })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to update vehicle." })
  }
})

router.delete("/vehicles/:id", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id

    const vehicle = await prisma.vehicle.findUnique({
      where:  { id },
      select: { id: true, licensePlate: true },
    })

    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found." })
    }

    // Unlink from any shipments (preserve shipment history), then delete
    await prisma.$transaction([
      prisma.shipment.updateMany({ where: { vehicleId: id }, data: { vehicleId: null } }),
      prisma.vehicle.delete({ where: { id } }),
    ])

    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "DELETE_VEHICLE",
        targetTable:    "vehicles",
        targetRecordId: id,
        changesSummary: `Deleted vehicle ${vehicle.licensePlate}`,
      },
    })

    res.json({ message: "Vehicle deleted." })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to delete vehicle." })
  }
})

export default router
