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
import { findTransitConflict, mirrorFleetStatus, releaseFleetIfUnused } from "../lib/shipmentStatus"

const router = Router()

// ── Helper: generate shipment ID ─────────────────────────────
// Format: #MPL-00001-JKT
const generateShipmentId = async (): Promise<string> => {
  const count = await prisma.shipment.count()
  const number = String(count + 1).padStart(5, "0")
  return `#MPL-${number}-JKT`
}

// ── GET /api/shipments/pickup-plants ──────────────────────────
router.get("/pickup-plants", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const plants = await prisma.pickupPlant.findMany({
      orderBy: [{ manufacturer: 'asc' }, { name: 'asc' }]
    })
    res.json({ plants })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch pickup plants." })
  }
})

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
        client:         { select: { fullName: true, companyName: true } },
        driver:         { select: { fullName: true, phoneNumber: true } },
        vehicle:        { select: { type: true, licensePlate: true, primaryDriverId: true } },
        pickupPlant:    { select: { name: true, code: true, manufacturer: true } },
        createdByAdmin: { select: { fullName: true } },
        plantCheck:     { include: { pengiriman: true, lku: true, ksu: true } },
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
        client:         { select: { fullName: true, companyName: true, email: true } },
        driver:         { select: { fullName: true, phoneNumber: true } },
        vehicle:        { select: { type: true, licensePlate: true, primaryDriverId: true } },
        pickupPlant:    { select: { name: true, code: true, manufacturer: true } },
        createdByAdmin: { select: { fullName: true } },
        plantCheck:     { include: { pengiriman: true, lku: true, ksu: true } },
        events:         { orderBy: { eventTimestamp: "asc" } },
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
      pickupDate,
      shippingCategory,
      dimensions,
      containerType,
      pickupPlantId,
      driverId,
      vehicleId,
    } = req.body

    const isAdmin  = req.user?.type === "admin"
    const clientId = isAdmin ? req.body.clientId : req.user!.id
    const id       = await generateShipmentId()

    // Armada creates a shipment already carrying its driver+vehicle → starts at STANDBY
    // (awaiting driver-availability reconfirm). Everyone else starts at PENDING (Menunggu).
    const initialStatus = req.user?.role === "KEPALA_ARMADA" ? "STANDBY" : "PENDING"

    // Linked create ("Hubungkan Pengiriman"): join an existing pre-departure trip — reuse its
    // driver+vehicle and linkGroupId (mint the group from the target shipment id if it has none).
    let linkGroupId: string | undefined
    let useDriverId = driverId, useVehicleId = vehicleId
    if (req.body.linkToShipmentId) {
      const target = await prisma.shipment.findUnique({
        where:  { id: String(req.body.linkToShipmentId) },
        select: { id: true, driverId: true, vehicleId: true, linkGroupId: true, status: true },
      })
      if (!target) return res.status(400).json({ message: "Pengiriman untuk dihubungkan tidak ditemukan." })
      if (target.status !== "STANDBY" && target.status !== "DITUGASKAN") {
        return res.status(400).json({ message: "Hanya bisa menghubungkan ke pengiriman yang belum berangkat (Standby/Ditugaskan)." })
      }
      useDriverId  = target.driverId
      useVehicleId = target.vehicleId
      linkGroupId  = target.linkGroupId ?? target.id
      if (!target.linkGroupId) await prisma.shipment.update({ where: { id: target.id }, data: { linkGroupId } })
    }

    const shipment = await prisma.shipment.create({
      data: {
        id,
        packageType,
        weightKg:         weightKg != null ? Number(weightKg) : 0,
        units:            units != null ? Number(units) : null,
        serviceLevel,
        originLocation,
        destinationLocation,
        specialNotes,
        pickupDate:       pickupDate ? new Date(pickupDate) : null,
        shippingCategory,
        dimensions,
        containerType,
        pickupPlantId,
        driverId:         useDriverId,
        vehicleId:        useVehicleId,
        linkGroupId,
        status:           initialStatus,
        clientId,
        createdByAdminId: isAdmin ? req.user!.id : null,
      },
    })

    // Standby shipment → mirror status onto its driver + armada (Tersedia → Standby). Idempotent
    // if already reserved (a linked sibling reuses the same, already-STANDBY driver+vehicle).
    if (initialStatus === "STANDBY") {
      if (useDriverId) {
        await prisma.driver.updateMany({
          where: { id: useDriverId, status: "ACTIVE" },
          data:  { status: "STANDBY" },
        })
      }
      if (useVehicleId) {
        await prisma.vehicle.updateMany({
          where: { id: useVehicleId, status: "AVAILABLE" },
          data:  { status: "STANDBY" },
        })
      }
    }

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
// Admin assigns driver and vehicle.
// Only advances status when coming from PENDING (→ DITUGASKAN); other statuses are untouched.
router.patch("/:id/assign", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { driverId, vehicleId, pickupPlantId, pickupDate } = req.body

    const current = await prisma.shipment.findUnique({
      where:  { id: req.params.id },
      select: { status: true },
    })

    const shipment = await prisma.shipment.update({
      where: { id: req.params.id },
      data: {
        driverId,
        vehicleId,
        pickupPlantId,
        ...(pickupDate && { pickupDate: new Date(pickupDate) }),
        ...(current?.status === "PENDING" && { status: "DITUGASKAN" }),
        lastUpdatedByAdminId: req.user!.id,
      },
      include: {
        driver: true,
      }
    })

    // Linked group: mirror this driver+vehicle onto every sibling (one truck, one trip).
    if (shipment.linkGroupId) {
      await prisma.shipment.updateMany({
        where: { linkGroupId: shipment.linkGroupId, id: { not: shipment.id } },
        data:  { driverId, vehicleId, lastUpdatedByAdminId: req.user!.id },
      })
    }

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
          status: { in: ["PENDING", "DITUGASKAN", "TRANSIT"] }
        }
      })

      if (activeCount > 3) {
         await prisma.adminNotification.create({
           data: {
             title: `High Workload: ${shipment.driver.fullName}`,
             message: `Driver ${shipment.driver.fullName} now has ${activeCount} active shipments.`,
             category: "assignment",
             linkTo: "driver",
             linkId: shipment.driver.id,
           }
         })
      }
      // ponytail: auto-WhatsApp-on-assign removed — driver notification is manual via
      // POST /:id/notify-driver (was double-sending with that button). Re-add here if auto-notify is ever wanted.
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
    // Alamat asli dari shipment (origin/destination) — dipakai untuk teks + link Google Maps.
    const pickupLocation  = shipment.originLocation
    const dropoffLocation = shipment.destinationLocation
    // Link Google Maps dari alamat (di-encode agar aman dipakai sebagai query URL)
    const mapsLink = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
    // Waktu pickup dari tgl pickup shipment (format Indonesia, zona WIB)
    const pickupTime = shipment.pickupDate
      ? new Date(shipment.pickupDate).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Jakarta" })
      : "Belum dijadwalkan"

    // Deskripsi produk / detail muatan agar driver tahu barang yang diangkut.
    const cargoDetail = `${shipment.packageType}${shipment.units != null ? ` (${shipment.units} unit)` : ""}`
    const waMessage = `Halo ${shipment.driver.fullName},\n\nAnda ditugaskan untuk pengiriman baru ${shipment.id}.\n\nDetail Muatan: ${cargoDetail}\n\nLokasi Pickup: ${pickupLocation}\nPeta: ${mapsLink(pickupLocation)}\nWaktu Pickup: ${pickupTime}\n\nLokasi Dropoff: ${dropoffLocation}\nPeta: ${mapsLink(dropoffLocation)}\n\nJika ada pertanyaan, mohon hubungi Admin ${ADMIN_PHONE}. Terima kasih dan hati-hati di jalan.`

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

// ── PATCH /api/shipments/:id/plant-check ────────────────────────
// PIC Pengurus Pabrik completes the plant check (AT_PLANT → TRANSIT).
// Body (all optional so the interim stub still advances; the 3-page wizard sends the full set):
//   dataPengiriman: [{ tipeMotor, noShipping, jumlah, satuan, keterangan }]  (page 1, ≥1 row required in UI)
//   lku: [{ tipeMotor, noMesin, noRangka, warna, itemDefect }]             (page 2, optional)
//   ksu: [{ tipeMotor, helm, accu, spion, toolkit, bsBp, kKontak, fuse, platNo, sticker }]  (page 3, required in UI)
// Persisted to plant_checks (+ lku/ksu children). Feeds the Surat Jalan generator.
router.patch("/:id/plant-check", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id)
    const { dataPengiriman = [], lku = [], ksu = [] } = req.body

    // Departure guard (same as /status): block if the driver is already on another transit.
    const cur = await prisma.shipment.findUnique({ where: { id }, select: { driverId: true, linkGroupId: true } })
    if (cur?.driverId) {
      const conflictId = await findTransitConflict(cur.driverId, id, cur.linkGroupId)
      if (conflictId) {
        const driver = await prisma.driver.findUnique({ where: { id: cur.driverId }, select: { fullName: true } })
        return res.status(409).json({ message: `${driver?.fullName ?? "Driver"} sedang bertugas di pengiriman ${conflictId}. Selesaikan pengiriman tersebut terlebih dahulu.` })
      }
    }

    // Persist the structured form when Data Pengiriman rows are provided (idempotent: replace prior check).
    if ((dataPengiriman as any[]).length > 0) {
      await prisma.plantCheck.deleteMany({ where: { shipmentId: id } })  // children cascade
      await prisma.plantCheck.create({
        data: {
          shipmentId:       id,
          checkedByAdminId: req.user!.id,
          pengiriman: { create: (dataPengiriman as any[]).map(r => ({
            tipeMotor: r.tipeMotor, noShipping: r.noShipping ?? null,
            jumlah: r.jumlah != null && r.jumlah !== '' ? Number(r.jumlah) : null,
            satuan: r.satuan ?? null, keterangan: r.keterangan ?? null,
          })) },
          lku: { create: (lku as any[]).map(r => ({
            tipeMotor: r.tipeMotor ?? null, noMesin: r.noMesin ?? null, noRangka: r.noRangka ?? null,
            warna: r.warna ?? null, itemDefect: r.itemDefect ?? null,
          })) },
          ksu: { create: (ksu as any[]).map(r => ({
            tipeMotor: r.tipeMotor ?? null, helm: r.helm ?? null, accu: r.accu ?? null, spion: r.spion ?? null,
            toolkit: r.toolkit ?? null, bsBp: r.bsBp ?? null, kKontak: r.kKontak ?? null, fuse: r.fuse ?? null,
            platNo: r.platNo ?? null, sticker: r.sticker ?? null,
          })) },
        },
      })
    }

    const shipment = await prisma.shipment.update({
      where: { id },
      data:  { status: "TRANSIT", lastUpdatedByAdminId: req.user!.id },
    })
    // Same fleet mirror as /status (was skipped here before — driver/vehicle now engaged on departure).
    await mirrorFleetStatus("TRANSIT", cur?.driverId, shipment.vehicleId, id)

    await prisma.adminAuditLog.create({
      data: {
        adminId: req.user!.id,
        actionType: "UPDATE_STATUS",
        targetTable: "shipments",
        targetRecordId: shipment.id,
        changesSummary: `Completed Plant Check (${(dataPengiriman as any[]).length} unit, ${(lku as any[]).length} LKU, ${(ksu as any[]).length} KSU rows). Status -> TRANSIT`,
      }
    })

    res.json({ message: "Plant check completed.", shipment })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to complete plant check." })
  }
})

// ── PATCH /api/shipments/:id/handover ──────────────────────────
// PIC Kepala Gudang completes handover
router.patch("/:id/handover", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { serahTerimaUrl, handoverNotes, catatanPlantPengirim, catatanGudangPenerima } = req.body
    const existing = await prisma.shipment.findUnique({
      where:  { id: req.params.id },
      select: { driverId: true, vehicleId: true },
    })
    const shipment = await prisma.shipment.update({
      where: { id: req.params.id },
      data: {
        serahTerimaUrl:        serahTerimaUrl ?? undefined,
        handoverNotes:         handoverNotes ?? undefined,
        catatanPlantPengirim:  catatanPlantPengirim ?? null,
        catatanGudangPenerima: catatanGudangPenerima ?? null,
        status: "DELIVERED",
        completionDate: new Date(),
        currentProgressPercent: 100,
        lastUpdatedByAdminId: req.user!.id,
      },
    })

    // Free the driver + vehicle via the shared mirror — group-aware, so it won't free them
    // while a linked sibling shipment is still active.
    await mirrorFleetStatus("DELIVERED", existing?.driverId, existing?.vehicleId, String(req.params.id))

    await prisma.adminAuditLog.create({
      data: {
        adminId: req.user!.id,
        actionType: "UPDATE_STATUS",
        targetTable: "shipments",
        targetRecordId: shipment.id,
        changesSummary: `Completed Handover. Status -> DELIVERED`,
      }
    })

    res.json({ message: "Handover completed.", shipment })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to complete handover." })
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
      select: { status: true, driverId: true, linkGroupId: true },
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

    // "Di Pabrik" (AT_PLANT) = truck physically arrived at the plant. Only PIC Pabrik may set it
    // (the DITUGASKAN→AT_PLANT from-state is already enforced by the forward map). SUPERADMIN keeps override.
    if (status === "AT_PLANT" && req.user!.role !== "PIC_PABRIK" && req.user!.role !== "SUPERADMIN") {
      return res.status(403).json({ message: "Hanya PIC Pabrik yang dapat menandai status Di Pabrik." })
    }

    // Departure guard: only ONE shipment per driver may be in transit at a time (shared helper).
    if (status === "TRANSIT" && existing.driverId) {
      const conflictId = await findTransitConflict(existing.driverId, id, existing.linkGroupId)
      if (conflictId) {
        const driver = await prisma.driver.findUnique({ where: { id: existing.driverId }, select: { fullName: true } })
        return res.status(409).json({
          message: `${driver?.fullName ?? "Driver"} sedang bertugas di pengiriman ${conflictId}. Selesaikan pengiriman tersebut terlebih dahulu.`,
        })
      }
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

    // Mirror the new status onto the driver + vehicle (shared helper; group-aware release).
    await mirrorFleetStatus(status, existing.driverId, shipment.vehicleId, id)

    // Linked group: STANDBY→Ditugaskan cascades to all siblings (they depart together).
    // After Ditugaskan each shipment is handled independently (no further cascade).
    if (status === "DITUGASKAN" && existing.linkGroupId) {
      await prisma.shipment.updateMany({
        where: { linkGroupId: existing.linkGroupId, status: "STANDBY", id: { not: id } },
        data:  { status: "DITUGASKAN", lastUpdatedByAdminId: req.user!.id },
      })
    }

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
    if (["TRANSIT", "DELIVERED", "CANCELLED"].includes(status)) {
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

// ── DELETE /api/shipments/:id ────────────────────────────────
// Regular admins may only delete a STANDBY shipment; SUPERADMIN may delete any status.
// Frees the assigned driver + armada and removes tracking events (cascade).
router.delete("/:id", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id)
    const scope = String(req.query.scope || "single")  // "single" | "group"
    const existing = await prisma.shipment.findUnique({
      where:  { id },
      select: { status: true, driverId: true, vehicleId: true, linkGroupId: true },
    })
    if (!existing) {
      return res.status(404).json({ message: "Pengiriman tidak ditemukan." })
    }

    const isSuperAdmin = req.user!.role === "SUPERADMIN"

    // "Hapus Semua Pengiriman Terhubung" — delete the whole linked group.
    if (scope === "group" && existing.linkGroupId) {
      const members = await prisma.shipment.findMany({
        where:  { linkGroupId: existing.linkGroupId },
        select: { id: true, status: true },
      })
      if (!isSuperAdmin && members.some(m => m.status !== "STANDBY")) {
        return res.status(403).json({ message: "Hanya pengiriman berstatus Standby yang dapat dihapus." })
      }
      await prisma.shipment.deleteMany({ where: { linkGroupId: existing.linkGroupId } })  // ShipmentEvents cascade
      await releaseFleetIfUnused(existing.driverId, existing.vehicleId)
      await prisma.adminAuditLog.create({
        data: {
          adminId: req.user!.id, actionType: "UPDATE_SHIPMENT", targetTable: "shipments",
          targetRecordId: id, changesSummary: `Deleted ${members.length} linked shipments (group)`,
        },
      })
      return res.json({ message: `${members.length} pengiriman terhubung dihapus.` })
    }

    // "Hapus Pengiriman Ini" — single delete.
    if (!isSuperAdmin && existing.status !== "STANDBY") {
      return res.status(403).json({ message: "Hanya pengiriman berstatus Standby yang dapat dihapus." })
    }
    await prisma.shipment.delete({ where: { id } })  // ShipmentEvent cascades

    // A link group of one isn't a group — unlink the lone remaining sibling.
    if (existing.linkGroupId) {
      const remaining = await prisma.shipment.findMany({ where: { linkGroupId: existing.linkGroupId }, select: { id: true } })
      if (remaining.length === 1) await prisma.shipment.update({ where: { id: remaining[0].id }, data: { linkGroupId: null } })
    }
    // Free the pair only if no other shipment still occupies them (group-aware).
    await releaseFleetIfUnused(existing.driverId, existing.vehicleId)

    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "UPDATE_SHIPMENT",
        targetTable:    "shipments",
        targetRecordId: id,
        changesSummary: `Deleted shipment ${id} (was ${existing.status})`,
      },
    })

    res.json({ message: "Pengiriman dihapus." })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to delete shipment." })
  }
})

export default router
