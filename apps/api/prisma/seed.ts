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
  // ════════════════════════════════════════════════════════════
  // ADMINS — SUPERADMIN (login) + a normal OPERATIONS admin (RBAC testing)
  // ════════════════════════════════════════════════════════════
  const admin = await prisma.admin.upsert({
    where: { email: "admin@mpl.com" },
    update: { role: "SUPERADMIN", passwordHash: await bcrypt.hash("admin1234", 10) },
    create: {
      fullName: "Super Admin",
      email: "admin@mpl.com",
      passwordHash: await bcrypt.hash("admin1234", 10),
      role: "SUPERADMIN",
    },
  })
  await prisma.admin.upsert({
    where: { email: "ops@mpl.com" },
    update: { role: "OPERATIONS", passwordHash: await bcrypt.hash("ops1234", 10) },
    create: {
      fullName: "Ops Admin",
      email: "ops@mpl.com",
      passwordHash: await bcrypt.hash("ops1234", 10),
      role: "OPERATIONS",
    },
  })
  console.log("✅ Admins: admin@mpl.com (SUPERADMIN), ops@mpl.com (OPERATIONS)")

  // ════════════════════════════════════════════════════════════
  // CLIENTS (10): 8 tracked-in-shipments (idx 0–7) + 2 idle (idx 8–9).
  //   idx 0 = the whitelist login client (client@mpl.com)
  //   idx 6 = special: 1 active + 2 failed shipments
  //   idx 7 = special: 1 failed shipment
  // ════════════════════════════════════════════════════════════
  const clientPassword = await bcrypt.hash("client1234", 10)
  const clientSeed = [
    { fullName: "Whitelist Client", companyName: "MPL Whitelist Corp",     email: "client@mpl.com",         phoneNumber: "081200000001", city: "Jakarta Pusat",  address: "Jl. Sudirman No. 1, DKI Jakarta",       npwp: "01.234.567.8-901.000" },
    { fullName: "Andi Wijaya",      companyName: "PT Maju Jaya Logistik",  email: "majujaya@client.com",    phoneNumber: "081234500001", city: "Jakarta Barat",  address: "Jl. Daan Mogot No. 12, Jakarta Barat",  npwp: "02.111.222.3-456.000" },
    { fullName: "Siti Rahayu",      companyName: "CV Sentosa Abadi",       email: "sentosa@client.com",     phoneNumber: "081234500002", city: "Surabaya",       address: "Jl. Ahmad Yani No. 88, Surabaya",       npwp: "03.222.333.4-567.000" },
    { fullName: "Bambang Sutrisno", companyName: "PT Bahari Nusantara",    email: "bahari@client.com",      phoneNumber: "081234500003", city: "Makassar",       address: "Jl. Pelabuhan No. 5, Makassar",         npwp: "04.333.444.5-678.000" },
    { fullName: "Dewi Lestari",     companyName: "PT Cahaya Timur",        email: "cahayatimur@client.com", phoneNumber: "081234500004", city: "Medan",          address: "Jl. Gatot Subroto No. 21, Medan",       npwp: "05.444.555.6-789.000" },
    { fullName: "Hendra Gunawan",   companyName: "UD Berkah Mandiri",      email: "berkah@client.com",      phoneNumber: "081234500005", city: "Bandung",        address: "Jl. Asia Afrika No. 17, Bandung",       npwp: "06.555.666.7-890.000" },
    { fullName: "Rina Marlina",     companyName: "PT Sinar Gagal Jaya",    email: "sinargagal@client.com",  phoneNumber: "081234500006", city: "Semarang",       address: "Jl. Pandanaran No. 9, Semarang",        npwp: "07.666.777.8-901.000" },
    { fullName: "Yusuf Hidayat",    companyName: "CV Gagal Sekali",        email: "gagalsekali@client.com", phoneNumber: "081234500007", city: "Yogyakarta",     address: "Jl. Malioboro No. 3, Yogyakarta",       npwp: "08.777.888.9-012.000" },
    { fullName: "Maya Putri",       companyName: "PT Diam Diam Saja",      email: "idle1@client.com",       phoneNumber: "081234500008", city: "Denpasar",       address: "Jl. Sunset Road No. 1, Denpasar",       npwp: "09.888.999.0-123.000" },
    { fullName: "Doni Saputra",     companyName: "UD Belum Kirim",         email: "idle2@client.com",       phoneNumber: "081234500009", city: "Balikpapan",     address: "Jl. Jenderal Sudirman No. 7, Balikpapan", npwp: "10.999.000.1-234.000" },
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
  console.log(`✅ ${clients.length} clients (8 tracked, 2 idle)`)

  // ════════════════════════════════════════════════════════════
  // DRIVERS (8): 4 active (valid SIM) · 2 inactive · 2 active w/ EXPIRED SIM
  // ════════════════════════════════════════════════════════════
  const driverSeed = [
    { id: "seed-driver-1", fullName: "Budi Santoso",   phoneNumber: "082100000001", status: "ACTIVE",      licenseNumber: "SIM-B2-0001", licenseType: "B2", licenseExpiry: daysFromNow(400) },
    { id: "seed-driver-2", fullName: "Agus Setiawan",  phoneNumber: "082100000002", status: "ACTIVE",      licenseNumber: "SIM-B1-0002", licenseType: "B1", licenseExpiry: daysFromNow(250) },
    { id: "seed-driver-3", fullName: "Eko Prasetyo",   phoneNumber: "082100000003", status: "ACTIVE",      licenseNumber: "SIM-B2-0003", licenseType: "B2", licenseExpiry: daysFromNow(180) },
    { id: "seed-driver-4", fullName: "Joko Widodo",    phoneNumber: "082100000004", status: "ACTIVE",      licenseNumber: "SIM-A-0004",  licenseType: "A",  licenseExpiry: daysFromNow(600) },
    { id: "seed-driver-5", fullName: "Dedi Kurniawan", phoneNumber: "082100000005", status: "UNAVAILABLE", licenseNumber: "SIM-B1-0005", licenseType: "B1", licenseExpiry: daysFromNow(120) },
    { id: "seed-driver-6", fullName: "Rudi Hartono",   phoneNumber: "082100000006", status: "UNAVAILABLE", licenseNumber: "SIM-B2-0006", licenseType: "B2", licenseExpiry: daysFromNow(90) },
    { id: "seed-driver-7", fullName: "Slamet Riyadi",  phoneNumber: "082100000007", status: "ACTIVE",      licenseNumber: "SIM-B2-0007", licenseType: "B2", licenseExpiry: daysAgo(30) },
    { id: "seed-driver-8", fullName: "Wawan Setiawan", phoneNumber: "082100000008", status: "ACTIVE",      licenseNumber: "SIM-B1-0008", licenseType: "B1", licenseExpiry: daysAgo(10) },
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
  console.log(`✅ ${drivers.length} drivers (4 active, 2 inactive, 2 active w/ expired SIM)`)

  // ════════════════════════════════════════════════════════════
  // VEHICLES (9): 2 clean + every unique combo of overdue (STNK / KIR / Service)
  //   V1–V2 clean · V3 stnk · V4 kir · V5 service · V6 stnk+kir
  //   V7 stnk+service · V8 kir+service · V9 all three overdue
  // ════════════════════════════════════════════════════════════
  const FUT = daysFromNow(300)   // comfortably valid
  const PAST = daysAgo(40)       // overdue
  const vehicleSeed = [
    { id: "seed-vehicle-1", type: "Truk Box",    licensePlate: "B 1001 AA", status: "AVAILABLE",   chassisNumber: "MHFAB1001AA00001", engineNumber: "4D56-0001", stnkExpiry: FUT,  kirExpiry: FUT,  serviceDate: FUT },
    { id: "seed-vehicle-2", type: "Truk Engkel", licensePlate: "B 1002 BB", status: "AVAILABLE",   chassisNumber: "MHFAB1002BB00002", engineNumber: "4D56-0002", stnkExpiry: FUT,  kirExpiry: FUT,  serviceDate: FUT },
    { id: "seed-vehicle-3", type: "Pickup",      licensePlate: "B 1003 CC", status: "IN_USE",      chassisNumber: "MHFAB1003CC00003", engineNumber: "4D56-0003", stnkExpiry: PAST, kirExpiry: FUT,  serviceDate: FUT },
    { id: "seed-vehicle-4", type: "Tronton",     licensePlate: "B 1004 DD", status: "IN_USE",      chassisNumber: "MHFAB1004DD00004", engineNumber: "4D56-0004", stnkExpiry: FUT,  kirExpiry: PAST, serviceDate: FUT },
    { id: "seed-vehicle-5", type: "CDD",         licensePlate: "B 1005 EE", status: "MAINTENANCE", chassisNumber: "MHFAB1005EE00005", engineNumber: "4D56-0005", stnkExpiry: FUT,  kirExpiry: FUT,  serviceDate: PAST },
    { id: "seed-vehicle-6", type: "Truk Box",    licensePlate: "B 1006 FF", status: "IN_USE",      chassisNumber: "MHFAB1006FF00006", engineNumber: "4D56-0006", stnkExpiry: PAST, kirExpiry: PAST, serviceDate: FUT },
    { id: "seed-vehicle-7", type: "Truk Engkel", licensePlate: "B 1007 GG", status: "AVAILABLE",   chassisNumber: "MHFAB1007GG00007", engineNumber: "4D56-0007", stnkExpiry: PAST, kirExpiry: FUT,  serviceDate: PAST },
    { id: "seed-vehicle-8", type: "Pickup",      licensePlate: "B 1008 HH", status: "MAINTENANCE", chassisNumber: "MHFAB1008HH00008", engineNumber: "4D56-0008", stnkExpiry: FUT,  kirExpiry: PAST, serviceDate: PAST },
    { id: "seed-vehicle-9", type: "Tronton",     licensePlate: "B 1009 II", status: "MAINTENANCE", chassisNumber: "MHFAB1009II00009", engineNumber: "4D56-0009", stnkExpiry: PAST, kirExpiry: PAST, serviceDate: PAST },
  ] as const
  const vehicles = []
  for (const v of vehicleSeed) {
    const vehicle = await prisma.vehicle.upsert({
      where: { id: v.id },
      update: {},
      create: { ...v, lastUpdatedByAdminId: admin.id },
    })
    vehicles.push(vehicle)
  }
  console.log(`✅ ${vehicles.length} vehicles (2 clean + 6 single/double overdue + 1 triple overdue)`)

  // ════════════════════════════════════════════════════════════
  // SHIPMENTS (13): 2 DELIVERED · 4 PENDING · 4 TRANSIT · 3 FAILED
  // Failed mapping: client[6] = 1 active + 2 failed · client[7] = 1 failed.
  // PENDING shipments are unassigned (no driver/vehicle).
  // ════════════════════════════════════════════════════════════
  const shipmentSeed = [
    // client[0] (whitelist login): 1 delivered + 1 pending
    { id: "#MPL-00001-JKT", clientIdx: 0, driverIdx: 0,    vehicleIdx: 0,    packageType: "Elektronik",      weightKg: 1200.5, units: 40,  serviceLevel: "Darat", originLocation: "Jakarta Barat",  destinationLocation: "Bandung",      price: 5000000, status: "DELIVERED", currentProgressPercent: 100, pickupDate: daysAgo(10), estimatedArrival: daysAgo(7),  completionDate: daysAgo(7),  specialNotes: "Barang elektronik, harap hati-hati." },
    { id: "#MPL-00002-JKT", clientIdx: 0, driverIdx: null, vehicleIdx: null, packageType: "Dokumen & ATK",   weightKg: 25,     units: 10,  serviceLevel: "Udara", originLocation: "Jakarta Pusat",  destinationLocation: "Surabaya",     price: 1500000, status: "PENDING",   currentProgressPercent: 0,   pickupDate: daysFromNow(2), estimatedArrival: daysFromNow(4), completionDate: null, specialNotes: "Menunggu penjadwalan." },
    // client[1]: 2 transit
    { id: "#MPL-00003-JKT", clientIdx: 1, driverIdx: 1,    vehicleIdx: 1,    packageType: "Tekstil",         weightKg: 850,    units: 120, serviceLevel: "Darat", originLocation: "Jakarta Pusat",  destinationLocation: "Surabaya",     price: 7500000, status: "TRANSIT",   currentProgressPercent: 60,  pickupDate: daysAgo(2),  estimatedArrival: daysFromNow(2), completionDate: null, specialNotes: null },
    { id: "#MPL-00004-JKT", clientIdx: 1, driverIdx: 2,    vehicleIdx: 2,    packageType: "Bahan Bangunan",  weightKg: 3200,   units: 80,  serviceLevel: "Darat", originLocation: "Jakarta Utara",  destinationLocation: "Semarang",     price: 6200000, status: "TRANSIT",   currentProgressPercent: 35,  pickupDate: daysAgo(1),  estimatedArrival: daysFromNow(3), completionDate: null, specialNotes: "Muatan berat." },
    // client[2]: 1 delivered + 1 pending
    { id: "#MPL-00005-JKT", clientIdx: 2, driverIdx: 3,    vehicleIdx: 3,    packageType: "Makanan Kemasan", weightKg: 430.25, units: 60,  serviceLevel: "Laut",  originLocation: "Surabaya",       destinationLocation: "Makassar",     price: 3200000, status: "DELIVERED", currentProgressPercent: 100, pickupDate: daysAgo(8),  estimatedArrival: daysAgo(5),  completionDate: daysAgo(5),  specialNotes: null },
    { id: "#MPL-00006-JKT", clientIdx: 2, driverIdx: null, vehicleIdx: null, packageType: "Furnitur",        weightKg: 600,    units: 15,  serviceLevel: "Laut",  originLocation: "Surabaya",       destinationLocation: "Banjarmasin", price: 4100000, status: "PENDING",   currentProgressPercent: 0,   pickupDate: daysFromNow(3), estimatedArrival: daysFromNow(9), completionDate: null, specialNotes: "Menunggu armada laut." },
    // client[3]: 1 transit
    { id: "#MPL-00007-JKT", clientIdx: 3, driverIdx: 6,    vehicleIdx: 4,    packageType: "Mesin Industri",  weightKg: 5400,   units: 5,   serviceLevel: "Laut",  originLocation: "Makassar",       destinationLocation: "Medan",        price: 9800000, status: "TRANSIT",   currentProgressPercent: 45,  pickupDate: daysAgo(3),  estimatedArrival: daysFromNow(6), completionDate: null, specialNotes: "Perlu alat angkat." },
    // client[4]: 1 pending
    { id: "#MPL-00008-JKT", clientIdx: 4, driverIdx: null, vehicleIdx: null, packageType: "Elektronik",      weightKg: 320,    units: 25,  serviceLevel: "Udara", originLocation: "Medan",          destinationLocation: "Jakarta Pusat", price: 5600000, status: "PENDING",  currentProgressPercent: 0,   pickupDate: daysFromNow(1), estimatedArrival: daysFromNow(2), completionDate: null, specialNotes: null },
    // client[5]: 1 pending
    { id: "#MPL-00009-JKT", clientIdx: 5, driverIdx: null, vehicleIdx: null, packageType: "Pakaian Jadi",    weightKg: 180,    units: 200, serviceLevel: "Darat", originLocation: "Bandung",        destinationLocation: "Jakarta Barat", price: 2400000, status: "PENDING",  currentProgressPercent: 0,   pickupDate: daysFromNow(2), estimatedArrival: daysFromNow(3), completionDate: null, specialNotes: null },
    // client[6] (special): 1 active (transit) + 2 failed
    { id: "#MPL-00010-JKT", clientIdx: 6, driverIdx: 7,    vehicleIdx: 5,    packageType: "Suku Cadang",     weightKg: 900,    units: 50,  serviceLevel: "Darat", originLocation: "Semarang",       destinationLocation: "Surabaya",     price: 4300000, status: "TRANSIT",   currentProgressPercent: 50,  pickupDate: daysAgo(1),  estimatedArrival: daysFromNow(2), completionDate: null, specialNotes: null },
    { id: "#MPL-00011-JKT", clientIdx: 6, driverIdx: 0,    vehicleIdx: 6,    packageType: "Kaca Lembaran",   weightKg: 700,    units: 30,  serviceLevel: "Darat", originLocation: "Semarang",       destinationLocation: "Yogyakarta",   price: 3100000, status: "FAILED",    currentProgressPercent: 70,  pickupDate: daysAgo(6),  estimatedArrival: daysAgo(4),  completionDate: null, specialNotes: "Gagal: barang rusak di perjalanan." },
    { id: "#MPL-00012-JKT", clientIdx: 6, driverIdx: 1,    vehicleIdx: 7,    packageType: "Bahan Kimia",     weightKg: 1100,   units: 20,  serviceLevel: "Darat", originLocation: "Semarang",       destinationLocation: "Solo",         price: 5200000, status: "FAILED",    currentProgressPercent: 40,  pickupDate: daysAgo(9),  estimatedArrival: daysAgo(7),  completionDate: null, specialNotes: "Gagal: alamat tidak ditemukan." },
    // client[7] (special): 1 failed
    { id: "#MPL-00013-JKT", clientIdx: 7, driverIdx: 2,    vehicleIdx: 8,    packageType: "Perabot Kantor",  weightKg: 540,    units: 35,  serviceLevel: "Darat", originLocation: "Yogyakarta",     destinationLocation: "Semarang",     price: 2900000, status: "FAILED",    currentProgressPercent: 20,  pickupDate: daysAgo(5),  estimatedArrival: daysAgo(3),  completionDate: null, specialNotes: "Gagal: penerima menolak." },
  ] as const

  for (const s of shipmentSeed) {
    const { clientIdx, driverIdx, vehicleIdx, ...rest } = s
    await prisma.shipment.upsert({
      where: { id: s.id },
      update: {},
      create: {
        ...rest,
        clientId:         clients[clientIdx].id,
        driverId:         driverIdx  !== null ? drivers[driverIdx].id   : null,
        vehicleId:        vehicleIdx !== null ? vehicles[vehicleIdx].id : null,
        createdByAdminId: admin.id,
      },
    })
  }
  const counts = shipmentSeed.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1
    return acc
  }, {})
  console.log(`✅ ${shipmentSeed.length} shipments`, counts)

  // ── Minimal tracking events for assigned (non-pending) shipments ──
  const eventSeed = [
    { shipmentId: "#MPL-00001-JKT", stepName: "Barang Diambil",   location: "Jakarta Barat", status: "DONE",     eventTimestamp: daysAgo(10), driverNotes: "Pickup selesai." },
    { shipmentId: "#MPL-00001-JKT", stepName: "Dalam Perjalanan", location: "Cikampek",      status: "DONE",     eventTimestamp: daysAgo(8),  driverNotes: null },
    { shipmentId: "#MPL-00001-JKT", stepName: "Terkirim",         location: "Bandung",       status: "DONE",     eventTimestamp: daysAgo(7),  driverNotes: "Diterima penerima." },
    { shipmentId: "#MPL-00003-JKT", stepName: "Barang Diambil",   location: "Jakarta Pusat", status: "DONE",     eventTimestamp: daysAgo(2),  driverNotes: "Pickup selesai." },
    { shipmentId: "#MPL-00003-JKT", stepName: "Dalam Perjalanan", location: "Semarang",      status: "ACTIVE",   eventTimestamp: daysAgo(1),  driverNotes: "Menuju Surabaya." },
    { shipmentId: "#MPL-00005-JKT", stepName: "Terkirim",         location: "Makassar",      status: "DONE",     eventTimestamp: daysAgo(5),  driverNotes: "Dokumen diterima." },
    { shipmentId: "#MPL-00007-JKT", stepName: "Barang Diambil",   location: "Makassar",      status: "DONE",     eventTimestamp: daysAgo(3),  driverNotes: "Muatan berat diangkut." },
    { shipmentId: "#MPL-00010-JKT", stepName: "Dalam Perjalanan", location: "Semarang",      status: "ACTIVE",   eventTimestamp: daysAgo(1),  driverNotes: null },
    { shipmentId: "#MPL-00011-JKT", stepName: "Gagal Kirim",      location: "Yogyakarta",    status: "DONE",     eventTimestamp: daysAgo(4),  driverNotes: "Barang rusak — dikembalikan." },
  ] as const

  for (const s of shipmentSeed) {
    const existing = await prisma.shipmentEvent.count({ where: { shipmentId: s.id } })
    if (existing > 0) continue
    for (const e of eventSeed.filter((ev) => ev.shipmentId === s.id)) {
      await prisma.shipmentEvent.create({ data: { ...e, createdByAdminId: admin.id } })
    }
  }
  console.log("✅ tracking events seeded")

  console.log("\n🌱 Seed complete. Invoices left blank — generate them from shipments.")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
