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
  await prisma.admin.upsert({
    where: { email: "armada@mpl.com" },
    update: { role: "KEPALA_ARMADA", passwordHash: await bcrypt.hash("armada1234", 10) },
    create: {
      fullName: "Kepala Armada",
      email: "armada@mpl.com",
      passwordHash: await bcrypt.hash("armada1234", 10),
      role: "KEPALA_ARMADA",
    },
  })
  await prisma.admin.upsert({
    where: { email: "pabrik@mpl.com" },
    update: { role: "PIC_PABRIK", passwordHash: await bcrypt.hash("pabrik1234", 10) },
    create: {
      fullName: "PIC Pabrik",
      email: "pabrik@mpl.com",
      passwordHash: await bcrypt.hash("pabrik1234", 10),
      role: "PIC_PABRIK",
    },
  })
  await prisma.admin.upsert({
    where: { email: "gudang@mpl.com" },
    update: { role: "PIC_GUDANG", passwordHash: await bcrypt.hash("gudang1234", 10) },
    create: {
      fullName: "PIC Gudang",
      email: "gudang@mpl.com",
      passwordHash: await bcrypt.hash("gudang1234", 10),
      role: "PIC_GUDANG",
    },
  })
  console.log("✅ Admins: admin@mpl.com (SUPERADMIN), ops@mpl.com (OPERATIONS), armada@mpl.com (KEPALA_ARMADA), pabrik@mpl.com (PIC_PABRIK), gudang@mpl.com (PIC_GUDANG)")

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
  // DRIVERS (5): all ACTIVE w/ valid SIM. Drivers 1–3 are paired 1:1 to the
  // 3 vehicles below; drivers 4–5 are left unpaired (spare).
  // ════════════════════════════════════════════════════════════
  const driverSeed = [
    { id: "seed-driver-1", fullName: "Budi Santoso",   phoneNumber: "082100000001", status: "ACTIVE", licenseNumber: "SIM-B2-0001", licenseType: "B2", licenseExpiry: daysFromNow(400) },
    { id: "seed-driver-2", fullName: "Agus Setiawan",  phoneNumber: "082100000002", status: "ACTIVE", licenseNumber: "SIM-B1-0002", licenseType: "B1", licenseExpiry: daysFromNow(250) },
    { id: "seed-driver-3", fullName: "Eko Prasetyo",   phoneNumber: "082100000003", status: "ACTIVE", licenseNumber: "SIM-B2-0003", licenseType: "B2", licenseExpiry: daysFromNow(180) },
    { id: "seed-driver-4", fullName: "Joko Widodo",    phoneNumber: "082100000004", status: "ACTIVE", licenseNumber: "SIM-A-0004",  licenseType: "A",  licenseExpiry: daysFromNow(600) },
    { id: "seed-driver-5", fullName: "Dedi Kurniawan", phoneNumber: "082100000005", status: "ACTIVE", licenseNumber: "SIM-B1-0005", licenseType: "B1", licenseExpiry: daysFromNow(120) },
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
  console.log(`✅ ${drivers.length} drivers (all ACTIVE; 3 paired, 2 spare)`)

  // ════════════════════════════════════════════════════════════
  // VEHICLE LOOKUPS — brands + colors powering the Armada dropdowns
  // ════════════════════════════════════════════════════════════
  const brandNames = ["Toyota", "Mitsubishi", "Hino", "Isuzu", "Fuso"]
  const colorNames = ["Hitam", "Putih", "Kuning", "Merah", "Silver"]
  for (const name of brandNames) {
    await prisma.vehicleBrand.upsert({ where: { name }, update: {}, create: { name } })
  }
  for (const name of colorNames) {
    await prisma.vehicleColor.upsert({ where: { name }, update: {}, create: { name } })
  }
  console.log(`✅ ${brandNames.length} vehicle brands + ${colorNames.length} colors`)

  // ════════════════════════════════════════════════════════════
  // PICKUP PLANTS
  // ════════════════════════════════════════════════════════════
  const plantSeed = [
    { name: "Cibitung Plant 3", code: "1300", manufacturer: "HONDA" as const },
    { name: "Cibitung Plant 3A Onepack", code: "1350", manufacturer: "HONDA" as const },
    { name: "Dawuan (Karawang) Plant 4", code: "1600", manufacturer: "HONDA" as const },
    { name: "Dawuan (Karawang) Plant 5", code: "1700", manufacturer: "HONDA" as const },
    { name: "Delta Mas Plant 6", code: "1800", manufacturer: "HONDA" as const },
    { name: "Pondok Ungu", code: null, manufacturer: "YAMAHA" as const },
    { name: "Tambun", code: null, manufacturer: "SUZUKI" as const },
  ]
  for (const p of plantSeed) {
    await prisma.pickupPlant.upsert({
      where: { name: p.name },
      update: {},
      create: p,
    })
  }
  console.log(`✅ ${plantSeed.length} pickup plants`)

  // ════════════════════════════════════════════════════════════
  // VEHICLES (3): all clean (AVAILABLE, valid docs). Each paired 1:1 to a driver.
  // ════════════════════════════════════════════════════════════
  const FUT = daysFromNow(300)   // comfortably valid
  const vehicleSeed = [
    { id: "seed-vehicle-1", type: "Truk Box",    brand: "Hino",       modelName: "Dutro", color: "Putih",  licensePlate: "B 1001 AA", status: "AVAILABLE", chassisNumber: "MHFAB1001AA00001", engineNumber: "4D56-0001", stnkExpiry: FUT, kirExpiry: FUT, serviceDate: FUT },
    { id: "seed-vehicle-2", type: "Truk Engkel", brand: "Isuzu",      modelName: "Elf",   color: "Kuning", licensePlate: "B 1002 BB", status: "AVAILABLE", chassisNumber: "MHFAB1002BB00002", engineNumber: "4D56-0002", stnkExpiry: FUT, kirExpiry: FUT, serviceDate: FUT },
    { id: "seed-vehicle-3", type: "Pickup",      brand: "Mitsubishi", modelName: "L300",  color: "Hitam",  licensePlate: "B 1003 CC", status: "AVAILABLE", chassisNumber: "MHFAB1003CC00003", engineNumber: "4D56-0003", stnkExpiry: FUT, kirExpiry: FUT, serviceDate: FUT },
  ] as const
  const vehicles = []
  for (const v of vehicleSeed) {
    const vehicle = await prisma.vehicle.upsert({
      where: { id: v.id },
      update: { brand: v.brand, modelName: v.modelName, color: v.color },  // backfill lookups onto pre-existing rows
      create: { ...v, lastUpdatedByAdminId: admin.id },
    })
    vehicles.push(vehicle)
  }
  console.log(`✅ ${vehicles.length} vehicles (all clean)`)

  // ── Pair each vehicle 1:1 with a driver (drivers[0..2] → vehicles[0..2]) ──
  for (let i = 0; i < vehicles.length; i++) {
    await prisma.vehicle.update({
      where: { id: vehicles[i].id },
      data:  { primaryDriverId: drivers[i].id },
    })
  }
  console.log(`✅ paired ${vehicles.length} vehicles to drivers (${drivers.length - vehicles.length} drivers spare)`)

  // ════════════════════════════════════════════════════════════
  // SHIPMENTS — intentionally NONE. Create them from the dashboard for testing.
  // ════════════════════════════════════════════════════════════

  console.log("\n🌱 Seed complete. No shipments seeded — create them from the dashboard.")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
