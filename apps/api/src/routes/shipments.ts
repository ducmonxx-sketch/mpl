// src/routes/shipments.ts
//
//   GET    /api/shipments            → list shipments (client: own, admin: all)
//   GET    /api/shipments/stats      → dashboard stats by period
//   GET    /api/shipments/:id        → single shipment detail
//   POST   /api/shipments            → create shipment request
//   PATCH  /api/shipments/:id/assign → admin assigns driver & vehicle
//   PATCH  /api/shipments/:id/status → admin updates status & progress

import { Router, Response } from "express"
import prisma from "../lib/prisma"
import { authenticate, adminOnly, AuthRequest } from "../middleware/auth"
import { sendWhatsApp } from "../services/whatsapp"
import { canChangeStatus, isReversal, isValidStatus } from "../lib/statusFlow"

const router = Router()

// ── Helper: generate shipment ID ─────────────────────────────
// Format: #MPL-00001-JKT
const generateShipmentId = async (): Promise<string> => {
  const count = await prisma.shipment.count()
  const number = String(count + 1).padStart(5, "0")
  return `#MPL-${number}-JKT`
}

// ── GET /api/shipments ────────────────────────────────────────
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, from, to } = req.query
    const isAdmin = req.user?.type === "admin"

    const shipments = await prisma.shipment.findMany({
      where: {
        ...(!isAdmin && { clientId: req.user!.id }),
        ...(status && { status: status as any }),
        ...(from || to
          ? {
              createdAt: {
                ...(from && { gte: new Date(from as string) }),
                ...(to   && { lte: new Date(to as string) }),
              },
            }
          : {}),
      },
      include: {
        client:  { select: { fullName: true, companyName: true } },
        driver:  { select: { fullName: true, phoneNumber: true } },
        vehicle: { select: { type: true, licensePlate: true } },
        invoice: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    res.json({ shipments })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch shipments." })
  }
})

// ── GET /api/shipments/stats ──────────────────────────────────
// Dashboard stats — used in the client's Dashboard page
// ?period=daily|weekly|monthly|yearly
router.get("/stats", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { period = "monthly" } = req.query
    const isAdmin = req.user?.type === "admin"
    const now = new Date()

    const startDate = new Date()
    if (period === "daily")   startDate.setDate(now.getDate() - 1)
    if (period === "weekly")  startDate.setDate(now.getDate() - 7)
    if (period === "monthly") startDate.setMonth(now.getMonth() - 1)
    if (period === "yearly")  startDate.setFullYear(now.getFullYear() - 1)

    const where = {
      ...(!isAdmin && { clientId: req.user!.id }),
      createdAt: { gte: startDate },
    }

    // Run all counts in parallel — faster than sequential awaits
    const [total, delivered, transit, failed, pending, cancelled] =
      await Promise.all([
        prisma.shipment.count({ where }),
        prisma.shipment.count({ where: { ...where, status: "DELIVERED"  } }),
        prisma.shipment.count({ where: { ...where, status: "TRANSIT"    } }),
        prisma.shipment.count({ where: { ...where, status: "FAILED"     } }),
        prisma.shipment.count({ where: { ...where, status: "PENDING"    } }),
        prisma.shipment.count({ where: { ...where, status: "CANCELLED"  } }),
      ])

    res.json({ period, total, delivered, transit, failed, pending, cancelled })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch stats." })
  }
})

// ── GET /api/shipments/:id ────────────────────────────────────
router.get("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: req.params.id },
      include: {
        client:  { select: { fullName: true, companyName: true, email: true } },
        driver:  { select: { fullName: true, phoneNumber: true } },
        vehicle: { select: { type: true, licensePlate: true } },
        events:  { orderBy: { eventTimestamp: "asc" } },
      },
    })

    if (!shipment) {
      return res.status(404).json({ message: "Shipment not found." })
    }

    // Clients can only view their own shipments
    if (req.user?.type === "user" && shipment.clientId !== req.user.id) {
      return res.status(403).json({ message: "Access denied." })
    }

    res.json({ shipment })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch shipment." })
  }
})

// ── POST /api/shipments ───────────────────────────────────────
router.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      packageType,
      weightKg,
      units,
      serviceLevel,
      originLocation,
      destinationLocation,
      specialNotes,
      price,
      pickupDate,
      estimatedArrival,
    } = req.body

    const isAdmin  = req.user?.type === "admin"
    const clientId = isAdmin ? req.body.clientId : req.user!.id
    const id       = await generateShipmentId()

    const shipment = await prisma.shipment.create({
      data: {
        id,
        packageType,
        weightKg,
        units:            units != null ? Number(units) : null,
        serviceLevel,
        originLocation,
        destinationLocation,
        specialNotes,
        price:            price != null ? Number(price) : null,
        pickupDate:       pickupDate ? new Date(pickupDate) : null,
        estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : null,
        clientId,
        createdByAdminId: isAdmin ? req.user!.id : null,
      },
    })

    // Notify the client
    await prisma.notification.create({
      data: {
        userId:  clientId,
        title:   "Shipment Request Received",
        message: `Your shipment ${id} has been received and is pending assignment.`,
      },
    })

    res.status(201).json({ message: "Shipment created successfully.", shipment })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to create shipment." })
  }
})

// ── PATCH /api/shipments/:id/assign ──────────────────────────
// Admin assigns driver and vehicle
router.patch("/:id/assign", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { driverId, vehicleId } = req.body

    const shipment = await prisma.shipment.update({
      where: { id: req.params.id },
      data: {
        driverId,
        vehicleId,
        status:               "TRANSIT",
        lastUpdatedByAdminId: req.user!.id,
      },
      include: {
        driver: true,
      }
    })

    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "ASSIGN_DRIVER",
        targetTable:    "shipments",
        targetRecordId: shipment.id,
        changesSummary: `Assigned driver ${driverId} and vehicle ${vehicleId}`,
      },
    })

    await prisma.notification.create({
      data: {
        userId:        shipment.clientId,
        title:         "Driver Assigned",
        message:       `A driver has been assigned to your shipment ${shipment.id}.`,
        sentByAdminId: req.user!.id,
      },
    })

    if (shipment.driver) {
      const activeCount = await prisma.shipment.count({
        where: {
          driverId: shipment.driver.id,
          status: { in: ['PENDING', 'TRANSIT'] }
        }
      })

      if (activeCount > 3) {
         await prisma.adminNotification.create({
           data: {
             title: `High Workload: ${shipment.driver.fullName}`,
             message: `Driver ${shipment.driver.fullName} now has ${activeCount} active shipments.`,
             category: 'assignment',
             linkTo: 'driver',
             linkId: shipment.driver.id,
           }
         })
      }

    }

    res.json({ message: "Driver and vehicle assigned.", shipment })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to assign shipment." })
  }
})

// ── POST /api/shipments/:id/notify-driver ────────────────────
// Admin mengirim notifikasi WhatsApp penugasan ke driver (via OpenWA).
// Dipisah dari route assign agar pengiriman pesan dipicu lewat tombol, bukan otomatis saat assign.
router.post("/:id/notify-driver", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: req.params.id },
      include: { driver: true },
    })

    if (!shipment) {
      return res.status(404).json({ message: "Pengiriman tidak ditemukan." })
    }
    if (!shipment.driver) {
      return res.status(400).json({ message: "Tugaskan driver terlebih dahulu sebelum mengirim notifikasi." })
    }
    if (!shipment.driver.phoneNumber) {
      return res.status(400).json({ message: "Driver belum memiliki nomor telepon." })
    }

    // Kontak admin yang ditampilkan ke driver (hardcoded sementara — bisa dipindah ke env ADMIN_WHATSAPP nanti)
    const ADMIN_PHONE = "087875387552"
    // Alamat placeholder Indonesia — ganti dengan originLocation/destinationLocation asli bila datanya sudah lengkap
    const pickupLocation  = "Mall Kelapa Gading, Jl. Boulevard Raya, Kelapa Gading, Jakarta Utara"
    const dropoffLocation = "Jl. Asia Afrika No. 8, Sumur Bandung, Bandung, Jawa Barat"
    // Link Google Maps dari alamat (di-encode agar aman dipakai sebagai query URL)
    const mapsLink = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
    // Waktu pickup dari tgl pickup shipment (format Indonesia, zona WIB)
    const pickupTime = shipment.pickupDate
      ? new Date(shipment.pickupDate).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Jakarta" })
      : "Belum dijadwalkan"

    const waMessage = `Halo ${shipment.driver.fullName},\n\nAnda ditugaskan untuk pengiriman baru ${shipment.id}.\n\nLokasi Pickup: ${pickupLocation}\nPeta: ${mapsLink(pickupLocation)}\nWaktu Pickup: ${pickupTime}\n\nLokasi Dropoff: ${dropoffLocation}\nPeta: ${mapsLink(dropoffLocation)}\n\nJika ada pertanyaan, mohon hubungi Admin ${ADMIN_PHONE}. Terima kasih dan hati-hati di jalan.`

    const sent = await sendWhatsApp(shipment.driver.phoneNumber, waMessage)
    if (!sent) {
      return res.status(502).json({ message: "Gagal mengirim WhatsApp. Periksa koneksi gateway OpenWA." })
    }

    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "SEND_WHATSAPP_DRIVER",
        targetTable:    "drivers",
        targetRecordId: shipment.driver.id,
        changesSummary: `Sent WhatsApp assignment notification to driver ${shipment.driver.id}`,
      }
    })

    res.json({ message: "Notifikasi WhatsApp terkirim ke driver." })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Gagal mengirim notifikasi WhatsApp." })
  }
})

// ── PATCH /api/shipments/:id/status ──────────────────────────
// Admin updates shipment status and progress percent
router.patch("/:id/status", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id)
    const { status, currentProgressPercent } = req.body

    if (!isValidStatus("shipment", status)) {
      return res.status(400).json({ message: "Status pengiriman tidak valid." })
    }

    const existing = await prisma.shipment.findUnique({
      where:  { id },
      select: { status: true },
    })
    if (!existing) {
      return res.status(404).json({ message: "Pengiriman tidak ditemukan." })
    }

    // Forward moves: any admin. Reversal / off-flow: super-admin only (status:override).
    if (!canChangeStatus(req.user!.role, "shipment", existing.status, status)) {
      return res.status(403).json({
        message: `Hanya Super Admin yang dapat mengubah status dari ${existing.status} ke ${status}.`,
      })
    }
    const reversal = isReversal("shipment", existing.status, status)

    const shipment = await prisma.shipment.update({
      where: { id },
      data: {
        status,
        currentProgressPercent,
        ...(status === "DELIVERED" && { completionDate: new Date() }),
        lastUpdatedByAdminId: req.user!.id,
      },
    })

    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "UPDATE_STATUS",
        targetTable:    "shipments",
        targetRecordId: shipment.id,
        changesSummary: `Status ${existing.status} → ${status}${reversal ? ` (reversal by ${req.user!.role})` : ""}`,
      },
    })

    // Notify client on key status changes
    if (["TRANSIT", "DELIVERED", "FAILED"].includes(status)) {
      await prisma.notification.create({
        data: {
          userId:        shipment.clientId,
          title:         `Shipment ${status}`,
          message:       `Your shipment ${shipment.id} is now ${status}.`,
          sentByAdminId: req.user!.id,
        },
      })
    }

    res.json({ message: "Status updated.", shipment })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to update status." })
  }
})

export default router
