import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcrypt"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ── Date helpers ─────────────────────────────────────────────
const now = new Date()
const daysFromNow = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000)
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000)

async function main() {
  // ── Admin (login account) ──────────────────────────────────
  const admin = await prisma.admin.upsert({
    where: { email: "admin@mpl.com" },
    update: {},
    create: {
      fullName: "Super Admin",
      email: "admin@mpl.com",
      passwordHash: await bcrypt.hash("admin1234", 10),
      role: "SUPERADMIN",
    },
  })
  console.log("✅ Admin:", admin.email)

  // ── Whitelist client (login account) ───────────────────────
  await prisma.user.upsert({
    where: { email: "client@mpl.com" },
    update: {},
    create: {
      fullName: "Whitelist Client",
      companyName: "MPL Whitelist Corp",
      email: "client@mpl.com",
      passwordHash: await bcrypt.hash("client1234", 10),
      phoneNumber: "1234567890",
      city: "Jakarta Pusat",
      address: "Jl. Sudirman No. 1, DKI Jakarta",
      npwp: "01.234.567.8-901.000",
      verificationStatus: "VERIFIED",
      verifiedByAdminId: admin.id,
      settings: { create: {} },
    },
  })
  console.log("✅ Whitelist client: client@mpl.com")

  // ── 5 Clients (users) ──────────────────────────────────────
  const clientPassword = await bcrypt.hash("client1234", 10)
  const clientSeed = [
    { fullName: "Andi Wijaya",     companyName: "PT Maju Jaya Logistik", email: "majujaya@client.com",   phoneNumber: "081234500001", city: "Jakarta Barat", address: "Jl. Daan Mogot No. 12, Jakarta Barat",  npwp: "02.111.222.3-456.000" },
    { fullName: "Siti Rahayu",     companyName: "CV Sentosa Abadi",      email: "sentosa@client.com",    phoneNumber: "081234500002", city: "Surabaya",      address: "Jl. Ahmad Yani No. 88, Surabaya",       npwp: "03.222.333.4-567.000" },
    { fullName: "Bambang Sutrisno", companyName: "PT Bahari Nusantara",   email: "bahari@client.com",     phoneNumber: "081234500003", city: "Makassar",      address: "Jl. Pelabuhan No. 5, Makassar",         npwp: "04.333.444.5-678.000" },
    { fullName: "Dewi Lestari",    companyName: "PT Cahaya Timur",       email: "cahayatimur@client.com", phoneNumber: "081234500004", city: "Medan",         address: "Jl. Gatot Subroto No. 21, Medan",       npwp: "05.444.555.6-789.000" },
    { fullName: "Hendra Gunawan",  companyName: "UD Berkah Mandiri",     email: "berkah@client.com",     phoneNumber: "081234500005", city: "Bandung",       address: "Jl. Asia Afrika No. 17, Bandung",       npwp: "06.555.666.7-890.000" },
  ]
  const clients = []
  for (const c of clientSeed) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        ...c,
        passwordHash: clientPassword,
        verificationStatus: "VERIFIED",
        verifiedByAdminId: admin.id,
        settings: { create: {} },
      },
    })
    clients.push(user)
  }
  console.log(`✅ ${clients.length} clients`)

  // ── 5 Drivers ──────────────────────────────────────────────
  // A couple of licenses expire within 30 days to exercise the expiry alert.
  const driverSeed = [
    { id: "seed-driver-1", fullName: "Budi Santoso",    phoneNumber: "082100000001", status: "ACTIVE",      licenseNumber: "SIM-B2-0001", licenseType: "B2", licenseExpiry: daysFromNow(400) },
    { id: "seed-driver-2", fullName: "Agus Setiawan",   phoneNumber: "082100000002", status: "ACTIVE",      licenseNumber: "SIM-B1-0002", licenseType: "B1", licenseExpiry: daysFromNow(20) },
    { id: "seed-driver-3", fullName: "Eko Prasetyo",    phoneNumber: "082100000003", status: "ACTIVE",      licenseNumber: "SIM-B2-0003", licenseType: "B2", licenseExpiry: daysFromNow(200) },
    { id: "seed-driver-4", fullName: "Dedi Kurniawan",  phoneNumber: "082100000004", status: "UNAVAILABLE", licenseNumber: "SIM-A-0004",  licenseType: "A",  licenseExpiry: daysFromNow(700) },
    { id: "seed-driver-5", fullName: "Rudi Hartono",    phoneNumber: "082100000005", status: "ACTIVE",      licenseNumber: "SIM-B2-0005", licenseType: "B2", licenseExpiry: daysFromNow(15) },
  ] as const
  const drivers = []
  for (const d of driverSeed) {
    const driver = await prisma.driver.upsert({
      where: { id: d.id },
      update: {},
      create: { ...d, lastUpdatedByAdminId: admin.id },
    })
    drivers.push(driver)
  }
  console.log(`✅ ${drivers.length} drivers`)

  // ── 5 Vehicles (armada) ────────────────────────────────────
  // A couple of STNK/KIR dates expire within 30 days to exercise the expiry alert.
  const vehicleSeed = [
    { type: "Truk Box",     licensePlate: "B 1234 XYZ", status: "AVAILABLE",   stnkExpiry: daysFromNow(300), kirExpiry: daysFromNow(90) },
    { type: "Truk Engkel",  licensePlate: "B 5678 ABC", status: "IN_USE",      stnkExpiry: daysFromNow(25),  kirExpiry: daysFromNow(180) },
    { type: "Pickup",       licensePlate: "B 9012 DEF", status: "AVAILABLE",   stnkExpiry: daysFromNow(500), kirExpiry: daysFromNow(20) },
    { type: "Tronton",      licensePlate: "B 3456 GHI", status: "MAINTENANCE", stnkExpiry: daysFromNow(120), kirExpiry: daysFromNow(120) },
    { type: "CDD",          licensePlate: "B 7890 JKL", status: "IN_USE",      stnkExpiry: daysFromNow(400), kirExpiry: daysFromNow(400) },
  ] as const
  const vehicles = []
  for (const v of vehicleSeed) {
    const vehicle = await prisma.vehicle.upsert({
      where: { licensePlate: v.licensePlate },
      update: {},
      create: { ...v, lastUpdatedByAdminId: admin.id },
    })
    vehicles.push(vehicle)
  }
  console.log(`✅ ${vehicles.length} vehicles`)

  // ── 5 Shipments (pengiriman) across 3 distinct clients ──────
  // Uses clients[0], clients[1], clients[2]. Invoices intentionally NOT seeded —
  // generate them from these shipments via the Invoices section.
  const shipmentSeed = [
    {
      id: "#MPL-00001-JKT", clientId: clients[0].id, driverId: drivers[0].id, vehicleId: vehicles[0].id,
      packageType: "Elektronik", weightKg: 1200.5, units: 40, serviceLevel: "Darat",
      originLocation: "Jakarta Barat", destinationLocation: "Bandung",
      price: 5000000, status: "DELIVERED", currentProgressPercent: 100,
      pickupDate: daysAgo(10), estimatedArrival: daysAgo(7), completionDate: daysAgo(7),
      specialNotes: "Barang elektronik, harap hati-hati.",
    },
    {
      id: "#MPL-00002-JKT", clientId: clients[0].id, driverId: drivers[2].id, vehicleId: vehicles[1].id,
      packageType: "Tekstil", weightKg: 850, units: 120, serviceLevel: "Darat",
      originLocation: "Jakarta Pusat", destinationLocation: "Surabaya",
      price: 7500000, status: "TRANSIT", currentProgressPercent: 60,
      pickupDate: daysAgo(2), estimatedArrival: daysFromNow(2),
      specialNotes: null,
    },
    {
      id: "#MPL-00003-JKT", clientId: clients[1].id, driverId: null, vehicleId: null,
      packageType: "Makanan Kemasan", weightKg: 430.25, units: 60, serviceLevel: "Laut",
      originLocation: "Surabaya", destinationLocation: "Makassar",
      price: 3200000, status: "PENDING", currentProgressPercent: 0,
      pickupDate: daysFromNow(3), estimatedArrival: daysFromNow(8),
      specialNotes: "Menunggu penugasan driver.",
    },
    {
      id: "#MPL-00004-JKT", clientId: clients[1].id, driverId: drivers[4].id, vehicleId: vehicles[4].id,
      packageType: "Mesin Industri", weightKg: 5400, units: 5, serviceLevel: "Laut",
      originLocation: "Surabaya", destinationLocation: "Medan",
      price: 9800000, status: "TRANSIT", currentProgressPercent: 40,
      pickupDate: daysAgo(1), estimatedArrival: daysFromNow(6),
      specialNotes: "Muatan berat, perlu alat angkat.",
    },
    {
      id: "#MPL-00005-JKT", clientId: clients[2].id, driverId: drivers[2].id, vehicleId: vehicles[0].id,
      packageType: "Dokumen & ATK", weightKg: 75.75, units: 15, serviceLevel: "Udara",
      originLocation: "Makassar", destinationLocation: "Jakarta Pusat",
      price: 4100000, status: "DELIVERED", currentProgressPercent: 100,
      pickupDate: daysAgo(5), estimatedArrival: daysAgo(4), completionDate: daysAgo(4),
      specialNotes: null,
    },
  ] as const

  for (const s of shipmentSeed) {
    await prisma.shipment.upsert({
      where: { id: s.id },
      update: {},
      create: { ...s, createdByAdminId: admin.id },
    })
  }
  const distinctClients = new Set(shipmentSeed.map((s) => s.clientId)).size
  console.log(`✅ ${shipmentSeed.length} shipments across ${distinctClients} clients`)

  // ── Minimal tracking events for assigned shipments ─────────
  // Gives the tracking timeline real data; pending shipment left empty.
  const eventSeed = [
    { shipmentId: "#MPL-00001-JKT", stepName: "Barang Diambil",       location: "Jakarta Barat", status: "DONE", eventTimestamp: daysAgo(10), driverNotes: "Pickup selesai." },
    { shipmentId: "#MPL-00001-JKT", stepName: "Dalam Perjalanan",     location: "Cikampek",      status: "DONE", eventTimestamp: daysAgo(8),  driverNotes: null },
    { shipmentId: "#MPL-00001-JKT", stepName: "Terkirim",             location: "Bandung",       status: "DONE", eventTimestamp: daysAgo(7),  driverNotes: "Diterima oleh penerima." },
    { shipmentId: "#MPL-00002-JKT", stepName: "Barang Diambil",       location: "Jakarta Pusat", status: "DONE",   eventTimestamp: daysAgo(2), driverNotes: "Pickup selesai." },
    { shipmentId: "#MPL-00002-JKT", stepName: "Dalam Perjalanan",     location: "Semarang",      status: "ACTIVE", eventTimestamp: daysAgo(1), driverNotes: "Sedang menuju Surabaya." },
    { shipmentId: "#MPL-00004-JKT", stepName: "Barang Diambil",       location: "Surabaya",      status: "DONE",   eventTimestamp: daysAgo(1), driverNotes: "Muatan berat diangkut." },
    { shipmentId: "#MPL-00005-JKT", stepName: "Terkirim",             location: "Jakarta Pusat", status: "DONE",   eventTimestamp: daysAgo(4), driverNotes: "Dokumen diterima." },
  ] as const

  // Events have no natural unique key — only create them if the shipment has none yet.
  for (const s of shipmentSeed) {
    const existing = await prisma.shipmentEvent.count({ where: { shipmentId: s.id } })
    if (existing > 0) continue
    const events = eventSeed.filter((e) => e.shipmentId === s.id)
    for (const e of events) {
      await prisma.shipmentEvent.create({ data: { ...e, createdByAdminId: admin.id } })
    }
  }
  console.log(`✅ tracking events seeded`)

  console.log("\n🌱 Seed complete. Invoices left blank — generate them from shipments.")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
