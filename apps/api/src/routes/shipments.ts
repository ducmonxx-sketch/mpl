// src/routes/shipments.ts
//
//   GET    /api/shipments            → list shipments (client: own, admin: all)
//                                      opt-in pagination: ?limit&offset, plus ?search / ?linkGroupId
//   GET    /api/shipments/stats      → dashboard stats by period
//   GET    /api/shipments/:id        → single shipment detail
//   POST   /api/shipments            → create shipment request
//   PATCH  /api/shipments/:id/assign → admin assigns driver & vehicle
//   PATCH  /api/shipments/:id/status → admin updates status & progress

import { Router, Response } from "express"
import { Prisma } from "../generated/prisma/client"
import { ShipmentStatus } from "../generated/prisma/enums"
import prisma from "../lib/prisma"
import { authenticate, adminOnly, AuthRequest } from "../middleware/auth"
import { sendWhatsApp } from "../services/whatsapp"
import { canChangeStatus, isReversal, isValidStatus } from "../lib/statusFlow"
import { findTransitConflict, mirrorFleetStatus, releaseFleetIfUnused } from "../lib/shipmentStatus"

const router = Router()

// Upper bound on `?limit=` for the list route, so a caller can't request the whole table
// back with ?limit=999999 and undo pagination.
const MAX_PAGE_SIZE = 200

// Role-specific status priority for the admin table's default ordering.
//
// ⚠️ MUST mirror STATUS_SORT_RANK in
//    apps/web/src/pages/AdminComponents/ShipmentsSection.jsx.
// The client used to sort the whole list in memory. Once the list is paginated the sort
// decides *which* rows land on page 1, so it has to happen in the query instead.
const STATUS_SORT_RANK: Record<string, Record<string, number>> = {
  KEPALA_ARMADA: { STANDBY: 0, DITUGASKAN: 1, AT_PLANT: 2, TRANSIT: 3, DITERIMA: 4, DITURUNKAN: 5, DELIVERED: 6, CANCELLED: 7, PENDING: 8 },
  PIC_PABRIK:    { DITUGASKAN: 0, AT_PLANT: 1, STANDBY: 2, TRANSIT: 3, DITERIMA: 4, DITURUNKAN: 5, DELIVERED: 6, CANCELLED: 7, PENDING: 8 },
  PIC_GUDANG:    { TRANSIT: 0, DITERIMA: 1, DITURUNKAN: 2, DELIVERED: 3, STANDBY: 4, DITUGASKAN: 5, AT_PLANT: 6, CANCELLED: 7, PENDING: 8 },
  DEFAULT:       { PENDING: 0, STANDBY: 1, DITUGASKAN: 2, AT_PLANT: 3, TRANSIT: 4, DITERIMA: 5, DITURUNKAN: 6, DELIVERED: 7, CANCELLED: 8 },
}
// Mirrors the client's `RANK[status] ?? 99` — FAILED is legacy and unranked.
const UNRANKED_RANK = 99

// Closed statuses — the field roles' "Selesai" view; everything else is "Dalam Proses".
// Canonical definition: the client used to keep its own copy, but the split is applied
// here now (?lifecycle=active|done), so this is the only one.
const TERMINAL_STATUSES = ["DELIVERED", "CANCELLED", "FAILED"]

const VALID_STATUSES: readonly string[] = Object.values(ShipmentStatus)

// The row shape the admin table and the linked-sibling list both render. Shared so the
// ordered-ids path, the default path and the sibling query cannot drift apart.
const LIST_INCLUDE = {
  client:         { select: { fullName: true, companyName: true } },
  driver:         { select: { fullName: true, phoneNumber: true } },
  vehicle:        { select: { type: true, licensePlate: true, primaryDriverId: true } },
  pickupPlant:    { select: { name: true, code: true, manufacturer: true } },
  createdByAdmin: { select: { fullName: true } },
  plantCheck:     { include: { pengiriman: true, lku: true, ksu: true } },
} as const

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
//   ?status=<ShipmentStatus>  · ?from=&to= (createdAt range)
//   ?linkGroupId=<id>         — all members of one linked trip (see note below)
//   ?search=<q>               — case-insensitive match on shipment id or client name/company
//   ?limit=<n>&offset=<n>     — pagination (max 200)
//   ?sort=priority|completion — admin-only orderings for the admin table (see below).
//                               Omitted → createdAt desc, i.e. unchanged for every
//                               existing caller including the client dashboard.
//
// ⚠️ Pagination is OPT-IN: without `limit` the route returns every matching row, exactly as
// before. This is deliberate — `GET /api/shipments` is a SHARED route and 6 of its 11 callers
// are client-facing (ClientDashboardPage, pages/dashboard/*, TrackingSection). Defaulting to a
// page size here would silently truncate the client dashboard and its stats. The admin table
// opts in; migrating the client callers is a client-side follow-up (see DEV-PLAN).
//
// `total` is always returned so a caller can tell whether it received a complete set.
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, from, to, linkGroupId, search, sort, serviceLevel, pickupPlantId, clientName, lifecycle } = req.query
    const isAdmin = req.user?.type === "admin"

    // `status` accepts a comma-separated list because the UI's "Dibatalkan" tab covers two
    // enum values (CANCELLED + the legacy FAILED) — mapStatus collapses both.
    const statusList = typeof status === "string" && status
      ? status.split(",").map((s) => s.trim()).filter(Boolean)
      : []
    // lifecycle=active|done mirrors the field-role "Dalam Proses" / "Selesai" split, which
    // keys off TERMINAL_STATUSES rather than a date.
    const lifecycleMode = lifecycle === "active" || lifecycle === "done" ? lifecycle : ""
    // The client filter is picked from display names (companyName || fullName), so match
    // either column rather than an id.
    const clientNameQ = typeof clientName === "string" ? clientName.trim() : ""

    // Reject unknown status values explicitly. Left unvalidated the two query paths
    // disagreed: Prisma threw (500) while the raw path compared status::text and quietly
    // returned rows as if no filter had been asked for — the worse of the two failures.
    const badStatuses = statusList.filter((s) => !VALID_STATUSES.includes(s))
    if (badStatuses.length > 0) {
      return res.status(400).json({ message: `Unknown status: ${badStatuses.join(", ")}` })
    }

    const statusAnd: any[] = []
    if (statusList.length > 0)        statusAnd.push({ status: { in: statusList } })
    if (lifecycleMode === "done")     statusAnd.push({ status: { in: TERMINAL_STATUSES } })
    else if (lifecycleMode === "active") statusAnd.push({ status: { notIn: TERMINAL_STATUSES } })

    // Pagination is applied only when `limit` is supplied — see the note above.
    const rawLimit = Number(req.query.limit)
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.trunc(rawLimit), MAX_PAGE_SIZE)
      : undefined
    const rawOffset = Number(req.query.offset)
    const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.trunc(rawOffset) : 0

    const q = typeof search === "string" ? search.trim() : ""

    const where = {
      ...(!isAdmin && { clientId: req.user!.id }),
      // status and lifecycle must AND, not overwrite each other: field roles drive the
      // status dropdown AND the Dalam Proses / Selesai view at the same time. Collected
      // into AND[] so neither clobbers the other's `status` key.
      ...(statusAnd.length > 0 && { AND: statusAnd }),
      ...(serviceLevel  && { serviceLevel:  serviceLevel as string }),
      ...(pickupPlantId && { pickupPlantId: pickupPlantId as string }),
      ...(clientNameQ && {
        client: { OR: [{ fullName: clientNameQ }, { companyName: clientNameQ }] },
      }),
      ...(linkGroupId && { linkGroupId: linkGroupId as string }),
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: new Date(from as string) }),
              ...(to   && { lte: new Date(to as string) }),
            },
          }
        : {}),
      // Mirrors the admin table's client-side search (id or client name/company) so moving
      // search server-side does not change which rows match.
      ...(q
        ? {
            OR: [
              { id:     { contains: q, mode: "insensitive" as const } },
              { client: { fullName:    { contains: q, mode: "insensitive" as const } } },
              { client: { companyName: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    }

    // ── Custom-ordered path (?sort=priority | completion) ─────────────────────────────
    // Admin-only. Prisma's `orderBy` cannot express "order by this status priority map"
    // or "order by COALESCE(...)", so the ORDER BY has to be raw. Raw SQL is confined to
    // producing the ordered page of ids plus the matching count — every field/relation
    // selection still goes through Prisma below, so there is one definition of the shape.
    //
    // ⚠️ The conditions here must stay in sync with the `where` object above. They are two
    // spellings of the same filter; if you add one, add it in both.
    const sortMode = typeof sort === "string" ? sort : ""
    if (isAdmin && (sortMode === "priority" || sortMode === "completion")) {
      const conds: Prisma.Sql[] = [Prisma.sql`TRUE`]
      // Defensive: this branch is admin-gated above, but keep the client scope with the
      // filter so removing that gate can never widen what a client sees.
      if (!isAdmin) conds.push(Prisma.sql`s."clientId" = ${req.user!.id}`)
      if (statusList.length > 0) {
        conds.push(Prisma.sql`s."status"::text IN (${Prisma.join(statusList.map((v) => Prisma.sql`${v}`), ", ")})`)
      }
      if (lifecycleMode === "done") {
        conds.push(Prisma.sql`s."status"::text IN (${Prisma.join(TERMINAL_STATUSES.map((v) => Prisma.sql`${v}`), ", ")})`)
      } else if (lifecycleMode === "active") {
        conds.push(Prisma.sql`s."status"::text NOT IN (${Prisma.join(TERMINAL_STATUSES.map((v) => Prisma.sql`${v}`), ", ")})`)
      }
      if (serviceLevel)  conds.push(Prisma.sql`s."serviceLevel" = ${String(serviceLevel)}`)
      if (pickupPlantId) conds.push(Prisma.sql`s."pickupPlantId" = ${String(pickupPlantId)}`)
      if (clientNameQ)   conds.push(Prisma.sql`(u."fullName" = ${clientNameQ} OR u."companyName" = ${clientNameQ})`)
      if (linkGroupId)   conds.push(Prisma.sql`s."linkGroupId" = ${String(linkGroupId)}`)
      if (from)          conds.push(Prisma.sql`s."createdAt" >= ${new Date(String(from))}`)
      if (to)            conds.push(Prisma.sql`s."createdAt" <= ${new Date(String(to))}`)
      if (q) {
        const like = `%${q}%`
        conds.push(Prisma.sql`(s."id" ILIKE ${like} OR u."fullName" ILIKE ${like} OR u."companyName" ILIKE ${like})`)
      }
      const whereSql = Prisma.join(conds, " AND ")

      // "completion" = the Selesai view: most recently closed first. Mirrors the client's
      // closedAt = completionDate || pickupDate || createdAt.
      // "priority"   = status rank → origin → earliest date, mirroring the client sort.
      let orderSql: Prisma.Sql
      if (sortMode === "completion") {
        orderSql = Prisma.sql`COALESCE(s."completionDate", s."pickupDate", s."createdAt") DESC`
      } else {
        const rank = STATUS_SORT_RANK[req.user?.role ?? ""] ?? STATUS_SORT_RANK.DEFAULT
        const whens = Object.entries(rank).map(([st, n]) => Prisma.sql`WHEN ${st} THEN ${n}`)
        orderSql = Prisma.sql`
          CASE s."status"::text ${Prisma.join(whens, " ")} ELSE ${UNRANKED_RANK} END ASC,
          s."originLocation" ASC,
          COALESCE(s."pickupDate", s."createdAt") ASC`
      }

      const pageSize = limit ?? MAX_PAGE_SIZE
      const [idRows, countRows] = await Promise.all([
        prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT s."id"
          FROM "shipments" s
          JOIN "users" u ON u."id" = s."clientId"
          WHERE ${whereSql}
          ORDER BY ${orderSql}
          LIMIT ${pageSize} OFFSET ${offset}
        `),
        prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM "shipments" s
          JOIN "users" u ON u."id" = s."clientId"
          WHERE ${whereSql}
        `),
      ])

      const ids = idRows.map((r) => r.id)
      const rows = await prisma.shipment.findMany({
        where: { id: { in: ids } },
        include: LIST_INCLUDE,
      })
      // findMany does not preserve the `in` order, so re-apply the ordered id sequence.
      const byId = new Map(rows.map((s) => [s.id, s]))
      const ordered = ids.map((id) => byId.get(id)).filter(Boolean)

      return res.json({
        shipments: ordered,
        total: Number(countRows[0]?.count ?? 0),
        limit: pageSize,
        offset,
      })
    }

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { createdAt: "desc" },
        ...(limit !== undefined && { take: limit, skip: offset }),
      }),
      prisma.shipment.count({ where }),
    ])

    res.json({
      shipments,
      total,
      ...(limit !== undefined && { limit, offset }),
    })
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

// ── GET /api/shipments/condition-analytics ────────────────────
// Admin-only. Perfect-vs-defective unit counts for DELIVERED shipments, keyed off
// completionDate. ?range=month|quarter|ytd (default month):
//   - month/quarter: DAILY buckets, first date to last date of the covered month(s).
//   - ytd: MONTHLY buckets, January through the current month.
// ?category=all|Unit|Cargo|Container filters to one of the 3 service lines (default all).
router.get("/condition-analytics", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { range = "month", category = "all" } = req.query
    const now = new Date()
    const monthLabels = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"]

    let startDate: Date, endDate: Date
    const granularity: "day" | "month" = range === "ytd" ? "month" : "day"
    if (range === "ytd") {
      startDate = new Date(now.getFullYear(), 0, 1)
      endDate = now
    } else {
      const monthsBack = range === "quarter" ? 2 : 0
      startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0) // last day of the current month
    }

    const shipments = await prisma.shipment.findMany({
      where: {
        status: "DELIVERED",
        completionDate: { gte: startDate, lte: endDate },
        ...(category !== "all" && { shippingCategory: category as string }),
      },
      select: {
        completionDate: true,
        plantCheck: { select: { lku: { select: { arrivedDefective: true } } } },
      },
    })

    const keyFor = (d: Date) => granularity === "day"
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`

    const bucketMap = new Map<string, { unitsPerfect: number; unitsDefective: number }>()
    for (const s of shipments) {
      if (!s.completionDate) continue
      const key = keyFor(s.completionDate)
      const bucket = bucketMap.get(key) ?? { unitsPerfect: 0, unitsDefective: 0 }
      for (const unit of s.plantCheck?.lku ?? []) {
        if (unit.arrivedDefective) bucket.unitsDefective += 1
        else bucket.unitsPerfect += 1
      }
      bucketMap.set(key, bucket)
    }

    // Days that haven't happened yet get `null`, not 0 — a real 0 means "no defects that
    // day," but a future day has no data at all, and plotting it as 0 makes the line look
    // like it crashes to the floor at today's date instead of simply not having a value yet.
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const buckets: { period: string; label: string; unitsPerfect: number | null; unitsDefective: number | null }[] = []
    const cursor = new Date(startDate)
    while (cursor <= endDate) {
      const key = keyFor(cursor)
      const isFuture = granularity === "day" && cursor > today
      const counts = isFuture
        ? { unitsPerfect: null, unitsDefective: null }
        : (bucketMap.get(key) ?? { unitsPerfect: 0, unitsDefective: 0 })
      const label = granularity === "day"
        ? `${String(cursor.getDate()).padStart(2, "0")} ${monthLabels[cursor.getMonth()]} ${cursor.getFullYear()}`
        : `${monthLabels[cursor.getMonth()]} ${cursor.getFullYear()}`
      buckets.push({ period: key, label, ...counts })
      if (granularity === "day") cursor.setDate(cursor.getDate() + 1)
      else cursor.setMonth(cursor.getMonth() + 1)
    }

    res.json({ range, category, buckets })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch condition analytics." })
  }
})

// ── GET /api/shipments/condition-analytics/detail ──────────────
// Admin-only. Drill-down for a single chart point: which shipments made up that
// bucket's perfect/defective counts. ?period=YYYY-MM-DD (day bucket) or YYYY-MM
// (month bucket, from the YTD view) — same `period` value the chart already carries
// per point. ?category=all|Unit|Cargo|Container, matching /condition-analytics.
router.get("/condition-analytics/detail", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { period, category = "all" } = req.query
    if (typeof period !== "string" || !/^\d{4}-\d{2}(-\d{2})?$/.test(period)) {
      return res.status(400).json({ message: "Parameter period tidak valid." })
    }

    let startDate: Date, endDate: Date
    if (period.length === 7) {
      // Month bucket (YYYY-MM) — whole calendar month.
      const [y, m] = period.split("-").map(Number)
      startDate = new Date(y, m - 1, 1)
      endDate = new Date(y, m, 0, 23, 59, 59, 999)
    } else {
      // Day bucket (YYYY-MM-DD) — that single day.
      const [y, m, d] = period.split("-").map(Number)
      startDate = new Date(y, m - 1, d)
      endDate = new Date(y, m - 1, d, 23, 59, 59, 999)
    }

    const where = {
      status: "DELIVERED" as const,
      completionDate: { gte: startDate, lte: endDate },
      ...(category !== "all" && { shippingCategory: category as string }),
    }

    const [total, shipments] = await Promise.all([
      prisma.shipment.count({ where }),
      prisma.shipment.findMany({
        where,
        take: 200,
        orderBy: { completionDate: "asc" },
        select: {
          id: true,
          destinationLocation: true,
          shippingCategory: true,
          client: { select: { fullName: true, companyName: true } },
          plantCheck: { select: { lku: { select: { tipeMotor: true, noRangka: true, arrivedDefective: true, arrivalNote: true } } } },
        },
      }),
    ])

    const result = shipments.map(s => {
      const units = s.plantCheck?.lku ?? []
      return {
        id: s.id,
        client: s.client?.companyName || s.client?.fullName || "-",
        destination: s.destinationLocation,
        shippingCategory: s.shippingCategory,
        unitsPerfect: units.filter(u => !u.arrivedDefective).length,
        unitsDefective: units.filter(u => u.arrivedDefective).length,
        units,
      }
    })

    res.json({ period, category, total, shipments: result })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch condition analytics detail." })
  }
})

// ── GET /api/shipments/list-meta ──────────────────────────────
// Admin-only. The two things the shipments filter bar needs that are NOT derivable from a
// single page: the full client dropdown, and the per-status tab counts.
//
// ⚠️ Must stay registered ABOVE /:id.
//
// Both were computed from the loaded shipment array, so under pagination the dropdown
// would only list clients that happened to be on the current page and every tab badge
// would count that page instead of the whole set.
//
//   ?clientName= & ?serviceLevel=  — counts honour these (they mirror the UI's "baseSet",
//                                    which excludes the status tab itself so each tab can
//                                    show its own total). The client list ignores them:
//                                    you need every option available to pick from.
router.get("/list-meta", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { clientName, serviceLevel } = req.query
    const clientNameQ = typeof clientName === "string" ? clientName.trim() : ""

    const countWhere = {
      ...(serviceLevel && { serviceLevel: serviceLevel as string }),
      ...(clientNameQ && {
        client: { OR: [{ fullName: clientNameQ }, { companyName: clientNameQ }] },
      }),
    }

    const [clientRows, grouped] = await Promise.all([
      // Only clients that actually have shipments — matches the old behaviour of deriving
      // the list from the shipment rows themselves.
      prisma.user.findMany({
        where: { shipments: { some: {} } },
        select: { fullName: true, companyName: true },
      }),
      prisma.shipment.groupBy({
        by: ["status"],
        where: countWhere,
        _count: { _all: true },
      }),
    ])

    // Display name is companyName || fullName, same as the table renders.
    const clients = Array.from(
      new Set(clientRows.map((c) => c.companyName || c.fullName).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b))

    // Raw enum counts; the caller maps them onto its tab ids (FAILED + CANCELLED both
    // render as "Dibatalkan", so the mapping is the caller's business, not ours).
    const counts: Record<string, number> = {}
    let total = 0
    for (const g of grouped) {
      counts[g.status] = g._count._all
      total += g._count._all
    }

    res.json({ clients, counts, total })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch shipment list metadata." })
  }
})

// ── GET /api/shipments/linkable-trips ─────────────────────────
// Admin-only. One entry per physical STANDBY trip (driver+armada pairing) that a new
// shipment can be linked into via "Hubungkan Pengiriman".
//
// ⚠️ Must stay registered ABOVE /:id, or Express matches "linkable-trips" as an :id.
//
// Previously derived on the client by filtering the full shipment list. That only worked
// while the list was unpaginated — once paginated, a linkable trip sitting on another page
// would silently disappear from the picker. Deduped server-side by driver+vehicle: one
// pairing appearing on several shipments (including an existing link group, which shares a
// single driver+armada) is the same truck, so it is returned once. Any member resolves to
// the same trip on the backend.
router.get("/linkable-trips", authenticate, adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const standby = await prisma.shipment.findMany({
      // STANDBY = created but not yet dispatched, so this set is bounded by how many trips
      // are staged at once, not by history. The cap is a guard, not real pagination.
      where: { status: "STANDBY", driverId: { not: null } },
      select: {
        id:        true,
        driverId:  true,
        vehicleId: true,
        driver:    { select: { fullName: true } },
        vehicle:   { select: { type: true, licensePlate: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    })

    const seen = new Set<string>()
    const trips = standby
      .filter((s) => {
        const key = `${s.driverId}::${s.vehicleId}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((s) => ({
        id:          s.id,
        driverName:  s.driver?.fullName ?? null,
        vehicleName: s.vehicle ? `${s.vehicle.type} • ${s.vehicle.licensePlate}` : null,
      }))

    res.json({ trips })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch linkable trips." })
  }
})

// ── GET /api/shipments/:id ────────────────────────────────────
router.get("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: req.params.id as string },
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

    // Members of the same linked trip, excluding this one. Returned from the server rather
    // than derived on the client from the full list: under pagination a sibling can fall on
    // another page and would silently vanish. The detail panel uses this both for the "Trip
    // yang sama" links AND to choose the delete scope ("Hapus Pengiriman Ini" vs "Hapus
    // Semua Terhubung") — a wrong sibling set would mean a wrong destructive action.
    //
    // Same include shape as the list route: clicking a sibling makes it the selected
    // shipment, so it has to be a fully-populated row. Link groups hold 2–3 shipments, so
    // the extra fields cost nothing.
    const siblings = shipment.linkGroupId
      ? await prisma.shipment.findMany({
          where: { linkGroupId: shipment.linkGroupId, id: { not: shipment.id } },
          include: LIST_INCLUDE,
          orderBy: { createdAt: "asc" },
        })
      : []

    res.json({ shipment, siblings })
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
      if (target.status !== "STANDBY") {
        return res.status(400).json({ message: "Hanya bisa menghubungkan ke pengiriman yang masih Standby." })
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

    // Standby shipment → mirror status onto its driver + armada (Tersedia → Standby). No-op when
    // the pairing is already reserved (a linked sibling reuses the target trip's already-Standby
    // driver+vehicle — the guards below only touch ACTIVE/AVAILABLE).
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
      where:  { id: req.params.id as string },
      select: { status: true },
    })

    const shipment = await prisma.shipment.update({
      where: { id: req.params.id as string },
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
      where: { id: req.params.id as string },
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
// PIC Kepala Gudang completes handover (DITURUNKAN → DELIVERED).
// Body also accepts:
//   lkuUpdates: [{ id, arrivedDefective, arrivalNote }]  — arrival condition per unit,
//   ticked against the shipment's existing PlantCheckLku rows (created earlier by
//   Pengurus Pabrik at plant-check). Feeds the condition-analytics chart.
router.patch("/:id/handover", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id)
    const { serahTerimaUrl, handoverNotes, catatanPlantPengirim, catatanGudangPenerima } = req.body
    const lkuUpdates = Array.isArray(req.body.lkuUpdates) ? req.body.lkuUpdates : []

    const existing = await prisma.shipment.findUnique({
      where:  { id },
      select: { status: true, driverId: true, vehicleId: true, plantCheck: { select: { lku: { select: { id: true } } } } },
    })
    if (!existing) {
      return res.status(404).json({ message: "Pengiriman tidak ditemukan." })
    }

    if (!canChangeStatus(req.user!.role, "shipment", existing.status, "DELIVERED")) {
      return res.status(403).json({
        message: `Hanya Super Admin yang dapat mengubah status dari ${existing.status} ke DELIVERED.`,
      })
    }

    // Ownership check: only accept lkuUpdates ids that actually belong to this shipment's plant check.
    const validLkuIds = new Set((existing.plantCheck?.lku ?? []).map(r => r.id))
    const invalidId = (lkuUpdates as any[]).find(r => !validLkuIds.has(r?.id))
    if (invalidId) {
      return res.status(400).json({ message: "Data unit tidak valid untuk pengiriman ini." })
    }

    const [shipment] = await prisma.$transaction([
      prisma.shipment.update({
        where: { id },
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
      }),
      ...(lkuUpdates as any[]).map(r => prisma.plantCheckLku.update({
        where: { id: r.id },
        data: {
          arrivedDefective: Boolean(r.arrivedDefective),
          arrivalNote:      r.arrivalNote ?? null,
        },
      })),
    ])

    // Free the driver + vehicle via the shared mirror — group-aware, so it won't free them
    // while a linked sibling shipment is still active.
    await mirrorFleetStatus("DELIVERED", existing.driverId, existing.vehicleId, id)

    const defectiveCount = (lkuUpdates as any[]).filter(r => r.arrivedDefective).length
    await prisma.adminAuditLog.create({
      data: {
        adminId: req.user!.id,
        actionType: "UPDATE_STATUS",
        targetTable: "shipments",
        targetRecordId: shipment.id,
        changesSummary: `Completed Handover (${defectiveCount}/${lkuUpdates.length} unit rusak saat tiba). Status -> DELIVERED`,
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
        // Stamp when the shipment reaches a terminal state (Selesai/Dibatalkan) — used to
        // order the "Selesai" view by most-recently-closed.
        ...((status === "DELIVERED" || status === "CANCELLED") && { completionDate: new Date() }),
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
// OPERATIONS admins may only delete a STANDBY shipment; SUPERADMIN may delete any status.
// Field roles (KEPALA_ARMADA, PIC_PABRIK, PIC_GUDANG) and SUPPORT may not delete shipments at all.
// Frees the assigned driver + armada and removes tracking events (cascade).
router.delete("/:id", authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const isSuperAdmin = req.user!.role === "SUPERADMIN"
    if (!isSuperAdmin && req.user!.role !== "OPERATIONS") {
      return res.status(403).json({ message: "Anda tidak memiliki izin untuk menghapus pengiriman." })
    }

    const id = String(req.params.id)
    const scope = String(req.query.scope || "single")  // "single" | "group"
    const existing = await prisma.shipment.findUnique({
      where:  { id },
      select: { status: true, driverId: true, vehicleId: true, linkGroupId: true },
    })
    if (!existing) {
      return res.status(404).json({ message: "Pengiriman tidak ditemukan." })
    }

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
