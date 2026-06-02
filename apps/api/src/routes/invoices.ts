// src/routes/invoices.ts
//
//   GET    /api/invoices              → list invoices (admin: all, client: own)
//   GET    /api/invoices/:id          → single invoice with shipment + client
//   POST   /api/invoices              → admin creates invoice from a shipment
//   PATCH  /api/invoices/:id/send     → DRAFT → SENT, notifies client
//   PATCH  /api/invoices/:id/paid     → SENT/OVERDUE → PAID, records paidAt
//   PATCH  /api/invoices/:id/cancel   → DRAFT/SENT → CANCELLED

import { Router, Response } from "express"
import prisma from "../lib/prisma"
import { authenticate, adminOnly, AuthRequest } from "../middleware/auth"

const router = Router()

// ── Helper: generate invoice number ──────────────────────────
const generateInvoiceNumber = async (): Promise<string> => {
  const count = await prisma.invoice.count()
  const number = String(count + 1).padStart(5, "0")
  return `INV-${number}`
}

// ── Helper: auto-mark overdue invoices ────────────────────────
// Silently flips SENT invoices past their dueDate to OVERDUE in the DB.
const markOverdueIfNeeded = async (invoiceId: string) => {
  await prisma.invoice.updateMany({
    where: {
      id:      invoiceId,
      status:  "SENT",
      dueDate: { lt: new Date() },
    },
    data: { status: "OVERDUE" },
  })
}

// ── GET /api/invoices ─────────────────────────────────────────
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin  = req.user?.type === "admin"
    const { status } = req.query

    // Flip any overdue invoices before returning the list
    await prisma.invoice.updateMany({
      where: {
        status:  "SENT",
        dueDate: { lt: new Date() },
        ...(!isAdmin && { clientId: req.user!.id }),
      },
      data: { status: "OVERDUE" },
    })

    const invoices = await prisma.invoice.findMany({
      where: {
        ...(!isAdmin && { clientId: req.user!.id }),
        ...(status && { status: status as any }),
      },
      include: {
        shipment: {
          select: {
            id:                  true,
            originLocation:      true,
            destinationLocation: true,
            status:              true,
          },
        },
        client: {
          select: { fullName: true, companyName: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    res.json({ invoices })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch invoices." })
  }
})

// ── GET /api/invoices/:id ─────────────────────────────────────
router.get("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await markOverdueIfNeeded(req.params.id)

    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        shipment: {
          select: {
            id:                  true,
            packageType:         true,
            weightKg:            true,
            serviceLevel:        true,
            originLocation:      true,
            destinationLocation: true,
            status:              true,
            completionDate:      true,
          },
        },
        client: {
          select: {
            fullName:    true,
            companyName: true,
            email:       true,
            phoneNumber: true,
          },
        },
        createdByAdmin: {
          select: { fullName: true },
        },
      },
    })

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found." })
    }

    if (req.user?.type === "user" && invoice.clientId !== req.user.id) {
      return res.status(403).json({ message: "Access denied." })
    }

    res.json({ invoice })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch invoice." })
  }
})

// ── POST /api/invoices ────────────────────────────────────────
router.post("/", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { shipmentId, subtotal, taxRate = 11, dueDate, notes } = req.body

    if (!shipmentId || !subtotal || !dueDate) {
      return res.status(400).json({ message: "shipmentId, subtotal, and dueDate are required." })
    }

    const shipment = await prisma.shipment.findUnique({
      where:   { id: shipmentId },
      include: { invoice: true },
    })

    if (!shipment) {
      return res.status(404).json({ message: "Shipment not found." })
    }

    if (shipment.invoice) {
      return res.status(400).json({ message: "An invoice already exists for this shipment." })
    }

    const sub         = parseFloat(subtotal)
    const rate        = parseFloat(taxRate)
    const taxAmount   = parseFloat(((sub * rate) / 100).toFixed(2))
    const totalAmount = parseFloat((sub + taxAmount).toFixed(2))
    const invoiceNumber = await generateInvoiceNumber()

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        subtotal:        sub,
        taxRate:         rate,
        taxAmount,
        totalAmount,
        dueDate:         new Date(dueDate),
        notes:           notes ?? null,
        shipmentId,
        clientId:        shipment.clientId,
        createdByAdminId: req.user!.id,
      },
    })

    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "CREATE_INVOICE",
        targetTable:    "invoices",
        targetRecordId: invoice.id,
        changesSummary: `Created invoice ${invoiceNumber} for shipment ${shipmentId}`,
      },
    })

    res.status(201).json({ message: "Invoice created.", invoice })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to create invoice." })
  }
})

// ── PATCH /api/invoices/:id/send ──────────────────────────────
router.patch("/:id/send", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.invoice.findUnique({ where: { id: req.params.id } })

    if (!existing) {
      return res.status(404).json({ message: "Invoice not found." })
    }

    if (existing.status !== "DRAFT") {
      return res.status(400).json({ message: `Cannot send an invoice with status ${existing.status}.` })
    }

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data:  { status: "SENT" },
    })

    await Promise.all([
      prisma.adminAuditLog.create({
        data: {
          adminId:        req.user!.id,
          actionType:     "SEND_INVOICE",
          targetTable:    "invoices",
          targetRecordId: invoice.id,
          changesSummary: `Sent invoice ${invoice.invoiceNumber} to client`,
        },
      }),
      prisma.notification.create({
        data: {
          userId:        invoice.clientId,
          title:         "Invoice Baru",
          message:       `Invoice ${invoice.invoiceNumber} telah diterbitkan. Total: Rp ${invoice.totalAmount.toLocaleString("id-ID")}. Jatuh tempo: ${new Date(invoice.dueDate).toLocaleDateString("id-ID")}.`,
          sentByAdminId: req.user!.id,
        },
      }),
    ])

    res.json({ message: "Invoice sent.", invoice })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to send invoice." })
  }
})

// ── PATCH /api/invoices/:id/paid ──────────────────────────────
router.patch("/:id/paid", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.invoice.findUnique({ where: { id: req.params.id } })

    if (!existing) {
      return res.status(404).json({ message: "Invoice not found." })
    }

    if (!["SENT", "OVERDUE"].includes(existing.status)) {
      return res.status(400).json({ message: `Cannot mark invoice as paid when status is ${existing.status}.` })
    }

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data:  { status: "PAID", paidAt: new Date() },
    })

    await Promise.all([
      prisma.adminAuditLog.create({
        data: {
          adminId:        req.user!.id,
          actionType:     "MARK_INVOICE_PAID",
          targetTable:    "invoices",
          targetRecordId: invoice.id,
          changesSummary: `Marked invoice ${invoice.invoiceNumber} as paid`,
        },
      }),
      prisma.notification.create({
        data: {
          userId:        invoice.clientId,
          title:         "Pembayaran Dikonfirmasi",
          message:       `Pembayaran untuk invoice ${invoice.invoiceNumber} telah dikonfirmasi. Terima kasih!`,
          sentByAdminId: req.user!.id,
        },
      }),
    ])

    res.json({ message: "Invoice marked as paid.", invoice })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to mark invoice as paid." })
  }
})

// ── PATCH /api/invoices/:id/cancel ────────────────────────────
router.patch("/:id/cancel", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.invoice.findUnique({ where: { id: req.params.id } })

    if (!existing) {
      return res.status(404).json({ message: "Invoice not found." })
    }

    if (!["DRAFT", "SENT"].includes(existing.status)) {
      return res.status(400).json({ message: `Cannot cancel an invoice with status ${existing.status}.` })
    }

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data:  { status: "CANCELLED" },
    })

    await prisma.adminAuditLog.create({
      data: {
        adminId:        req.user!.id,
        actionType:     "CANCEL_INVOICE",
        targetTable:    "invoices",
        targetRecordId: invoice.id,
        changesSummary: `Cancelled invoice ${invoice.invoiceNumber}`,
      },
    })

    res.json({ message: "Invoice cancelled.", invoice })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to cancel invoice." })
  }
})

export default router
