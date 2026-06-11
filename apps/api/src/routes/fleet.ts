// src/routes/fleet.ts
//
//   GET    /api/fleet/drivers          → list all drivers
//   POST   /api/fleet/drivers          → add a driver
//   PATCH  /api/fleet/drivers/:id      → update driver
//
//   GET    /api/fleet/vehicles         → list all vehicles
//   POST   /api/fleet/vehicles         → add a vehicle
//   PATCH  /api/fleet/vehicles/:id     → update vehicle

import { Router, Response } from "express"
import prisma from "../lib/prisma"
import { authenticate, adminOnly, AuthRequest } from "../middleware/auth"

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
        licenseNumber,
        licenseType,
        licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null,
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
        ...(fullName    && { fullName }),
        ...(phoneNumber && { phoneNumber }),
        ...(status      && { status }),
        ...(licenseNumber && { licenseNumber }),
        ...(licenseType && { licenseType }),
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

    res.json({ message: "Driver updated.", driver })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to update driver." })
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
    const { type, licensePlate, stnkExpiry, kirExpiry } = req.body

    const existing = await prisma.vehicle.findUnique({ where: { licensePlate } })
    if (existing) {
      return res.status(400).json({ message: "License plate already registered." })
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        type,
        licensePlate,
        stnkExpiry: stnkExpiry ? new Date(stnkExpiry) : null,
        kirExpiry: kirExpiry ? new Date(kirExpiry) : null,
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

    res.status(201).json({ message: "Vehicle created.", vehicle })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to create vehicle." })
  }
})

router.patch("/vehicles/:id", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { type, licensePlate, status, stnkExpiry, kirExpiry } = req.body

    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: {
        ...(type         && { type }),
        ...(licensePlate && { licensePlate }),
        ...(status       && { status }),
        ...(stnkExpiry !== undefined && { stnkExpiry: stnkExpiry ? new Date(stnkExpiry) : null }),
        ...(kirExpiry !== undefined && { kirExpiry: kirExpiry ? new Date(kirExpiry) : null }),
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

    res.json({ message: "Vehicle updated.", vehicle })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to update vehicle." })
  }
})

export default router
