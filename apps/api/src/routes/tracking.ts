// src/routes/tracking.ts
//
//   GET    /api/tracking/:shipmentId          → full timeline for a shipment
//   POST   /api/tracking/:shipmentId/events   → admin adds a checkpoint
//   PATCH  /api/tracking/events/:eventId      → admin updates a checkpoint status

import { Router, Response } from "express"
import prisma from "../lib/prisma"
import { authenticate, adminOnly, AuthRequest } from "../middleware/auth"

const router = Router()

// ── GET /api/tracking/:shipmentId ────────────────────────────
router.get("/:shipmentId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { shipmentId } = req.params

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id:                    true,
        status:                true,
        currentProgressPercent: true,
        clientId:              true,
        originLocation:        true,
        destinationLocation:   true,
        pickupDate:            true,
        completionDate:        true,
        driver:  { select: { fullName: true, phoneNumber: true } },
        vehicle: { select: { type: true, licensePlate: true } },
      },
    })

    if (!shipment) {
      return res.status(404).json({ message: "Shipment not found." })
    }

    // Clients can only view their own shipment
    if (req.user?.type === "user" && shipment.clientId !== req.user.id) {
      return res.status(403).json({ message: "Access denied." })
    }

    const events = await prisma.shipmentEvent.findMany({
      where:   { shipmentId },
      orderBy: { eventTimestamp: "asc" },
    })

    res.json({ shipment, events })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch tracking data." })
  }
})

// ── POST /api/tracking/:shipmentId/events ────────────────────
// Admin adds a new checkpoint to the timeline
router.post("/:shipmentId/events", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { shipmentId } = req.params
    const { stepName, location, status, driverNotes, eventTimestamp } = req.body

    const event = await prisma.shipmentEvent.create({
      data: {
        shipmentId,
        stepName,
        location,
        status:           status ?? "UPCOMING",
        driverNotes,
        eventTimestamp:   new Date(eventTimestamp),
        createdByAdminId: req.user!.id,
      },
    })

    // Auto-recalculate progress based on DONE events
    const allEvents = await prisma.shipmentEvent.findMany({
      where: { shipmentId },
    })
    const doneCount = allEvents.filter((e) => e.status === "DONE").length
    const progress  = allEvents.length > 0
      ? Math.round((doneCount / allEvents.length) * 100)
      : 0

    await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        currentProgressPercent: progress,
        lastUpdatedByAdminId:   req.user!.id,
      },
    })

    // Audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "ADD_SHIPMENT_EVENT",
        targetTable:    "shipment_events",
        targetRecordId: event.id,
        changesSummary: `Added checkpoint: ${stepName} at ${location}`,
      },
    })

    // Notify the client
    const shipment = await prisma.shipment.findUnique({
      where:  { id: shipmentId },
      select: { clientId: true },
    })

    if (shipment) {
      await prisma.notification.create({
        data: {
          userId:        shipment.clientId,
          title:         "Shipment Update",
          message:       `Your shipment has reached: ${stepName} — ${location}`,
          sentByAdminId: req.user!.id,
        },
      })
    }

    res.status(201).json({ message: "Checkpoint added.", event })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to add checkpoint." })
  }
})

// ── PATCH /api/tracking/events/:eventId ──────────────────────
// Admin updates an event: UPCOMING → ACTIVE → DONE
router.patch("/events/:eventId", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { status, driverNotes } = req.body

    const event = await prisma.shipmentEvent.update({
      where: { id: req.params.eventId },
      data: {
        ...(status      && { status }),
        ...(driverNotes && { driverNotes }),
      },
    })

    // Recalculate progress after status change
    const allEvents = await prisma.shipmentEvent.findMany({
      where: { shipmentId: event.shipmentId },
    })
    const doneCount = allEvents.filter((e) => e.status === "DONE").length
    const progress  = Math.round((doneCount / allEvents.length) * 100)

    await prisma.shipment.update({
      where: { id: event.shipmentId },
      data:  { currentProgressPercent: progress },
    })

    res.json({ message: "Checkpoint updated.", event })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to update checkpoint." })
  }
})

export default router
