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
  // DRIVERS (12) — liveish fleet. Statuses are SYNCED to their ongoing shipment below:
  //   1–2  STANDBY   (reserved to a Standby trip)
  //   3–6  ON_DUTY   (Ditugaskan / Di Pabrik / Dalam Perjalanan / Diterima)
  //   7–9  ACTIVE    (available, paired 1:1 to a spare armada — free for new/linked trips)
  //   10–12 ACTIVE   (substitute drivers, unpaired)
  // Driver 7 has a SIM near expiry (~20d) to exercise the compliance flag.
  // Drivers 1–9 pair 1:1 to vehicles 1–9; 10–12 stay spare.
  // ════════════════════════════════════════════════════════════
  const driverSeed = [
    { id: "seed-driver-1",  fullName: "Budi Santoso",    phoneNumber: "082100000001", status: "STANDBY", licenseNumber: "SIM-B2-0001", licenseType: "B2", licenseExpiry: daysFromNow(400) },
    { id: "seed-driver-2",  fullName: "Agus Setiawan",   phoneNumber: "082100000002", status: "STANDBY", licenseNumber: "SIM-B1-0002", licenseType: "B1", licenseExpiry: daysFromNow(250) },
    { id: "seed-driver-3",  fullName: "Eko Prasetyo",    phoneNumber: "082100000003", status: "ON_DUTY", licenseNumber: "SIM-B2-0003", licenseType: "B2", licenseExpiry: daysFromNow(180) },
    { id: "seed-driver-4",  fullName: "Joko Susilo",     phoneNumber: "082100000004", status: "ON_DUTY", licenseNumber: "SIM-B2-0004", licenseType: "B2", licenseExpiry: daysFromNow(320) },
    { id: "seed-driver-5",  fullName: "Rudi Hartono",    phoneNumber: "082100000005", status: "ON_DUTY", licenseNumber: "SIM-B1-0005", licenseType: "B1", licenseExpiry: daysFromNow(210) },
    { id: "seed-driver-6",  fullName: "Slamet Riyadi",   phoneNumber: "082100000006", status: "ON_DUTY", licenseNumber: "SIM-B2-0006", licenseType: "B2", licenseExpiry: daysFromNow(150) },
    { id: "seed-driver-7",  fullName: "Dedi Kurniawan",  phoneNumber: "082100000007", status: "ACTIVE",  licenseNumber: "SIM-B1-0007", licenseType: "B1", licenseExpiry: daysFromNow(20)  }, // SIM near expiry
    { id: "seed-driver-8",  fullName: "Hendra Wijaya",   phoneNumber: "082100000008", status: "ACTIVE",  licenseNumber: "SIM-B2-0008", licenseType: "B2", licenseExpiry: daysFromNow(500) },
    { id: "seed-driver-9",  fullName: "Fajar Nugroho",   phoneNumber: "082100000009", status: "ACTIVE",  licenseNumber: "SIM-A-0009",  licenseType: "A",  licenseExpiry: daysFromNow(600) },
    { id: "seed-driver-10", fullName: "Bayu Pratama",    phoneNumber: "082100000010", status: "ACTIVE",  licenseNumber: "SIM-B1-0010", licenseType: "B1", licenseExpiry: daysFromNow(365) },
    { id: "seed-driver-11", fullName: "Gilang Ramadhan", phoneNumber: "082100000011", status: "ACTIVE",  licenseNumber: "SIM-B2-0011", licenseType: "B2", licenseExpiry: daysFromNow(280) },
    { id: "seed-driver-12", fullName: "Irfan Maulana",   phoneNumber: "082100000012", status: "ACTIVE",  licenseNumber: "SIM-B1-0012", licenseType: "B1", licenseExpiry: daysFromNow(440) },
  ] as const
  const drivers = []
  for (const d of driverSeed) {
    const driver = await prisma.driver.upsert({
      where: { id: d.id },
      update: { fullName: d.fullName, status: d.status, licenseNumber: d.licenseNumber, licenseType: d.licenseType, licenseExpiry: d.licenseExpiry },
      create: { ...d, lastUpdatedByAdminId: admin.id },
    })
    drivers.push(driver)
  }
  console.log(`✅ ${drivers.length} drivers (2 Standby, 4 On Duty, 3 available paired, 3 substitute spare)`)

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
  const plants: { id: string; name: string; code: string | null; manufacturer: string }[] = []
  for (const p of plantSeed) {
    const plant = await prisma.pickupPlant.upsert({
      where: { name: p.name },
      update: {},
      create: p,
    })
    plants.push(plant)
  }
  console.log(`✅ ${plantSeed.length} pickup plants`)

  // ── PIC Pabrik accounts bound to a plant (default Lokasi Plant filter; soft/changeable) ──
  const pabrikPassword = await bcrypt.hash("admin1234", 10)
  for (let i = 0; i < 3; i++) {
    const plant = plants[i]
    await prisma.admin.upsert({
      where:  { email: `pabrik${i + 1}@mpl.com` },
      update: { role: "PIC_PABRIK", passwordHash: pabrikPassword, pickupPlantId: plant.id },
      create: {
        fullName:      `PIC Pabrik ${plant.name}`,
        email:         `pabrik${i + 1}@mpl.com`,
        passwordHash:  pabrikPassword,
        role:          "PIC_PABRIK",
        pickupPlantId: plant.id,
      },
    })
  }
  console.log(`✅ 3 PIC Pabrik accounts bound to: ${plants.slice(0, 3).map(p => p.name).join(', ')}`)

  // ════════════════════════════════════════════════════════════
  // VEHICLES (9) — statuses SYNCED to the paired driver's ongoing shipment:
  //   1–2  STANDBY   · 3–6  IN_USE   · 7–9  AVAILABLE
  // Vehicle 7 (STNK ~15d) and vehicle 8 (KIR ~25d) are near expiry (mixed doc types).
  // Each vehicle pairs 1:1 with drivers 1–9.
  // ════════════════════════════════════════════════════════════
  const FUT   = daysFromNow(300)   // comfortably valid
  const NEAR_STNK = daysFromNow(15)
  const NEAR_KIR  = daysFromNow(25)
  const vehicleSeed = [
    { id: "seed-vehicle-1", type: "Truk Box",    brand: "Hino",       modelName: "Dutro",  color: "Putih",  licensePlate: "B 1001 AA", status: "STANDBY",   chassisNumber: "MHFAB1001AA00001", engineNumber: "4D56-0001", stnkExpiry: FUT,       kirExpiry: FUT,      serviceDate: FUT },
    { id: "seed-vehicle-2", type: "Truk Engkel", brand: "Isuzu",      modelName: "Elf",    color: "Kuning", licensePlate: "B 1002 BB", status: "STANDBY",   chassisNumber: "MHFAB1002BB00002", engineNumber: "4D56-0002", stnkExpiry: FUT,       kirExpiry: FUT,      serviceDate: FUT },
    { id: "seed-vehicle-3", type: "Pickup",      brand: "Mitsubishi", modelName: "L300",   color: "Hitam",  licensePlate: "B 1003 CC", status: "IN_USE",    chassisNumber: "MHFAB1003CC00003", engineNumber: "4D56-0003", stnkExpiry: FUT,       kirExpiry: FUT,      serviceDate: FUT },
    { id: "seed-vehicle-4", type: "Truk Box",    brand: "Toyota",     modelName: "Dyna",   color: "Silver", licensePlate: "B 1004 DD", status: "IN_USE",    chassisNumber: "MHFAB1004DD00004", engineNumber: "4D56-0004", stnkExpiry: FUT,       kirExpiry: FUT,      serviceDate: FUT },
    { id: "seed-vehicle-5", type: "Truk Engkel", brand: "Fuso",       modelName: "Canter", color: "Merah",  licensePlate: "B 1005 EE", status: "IN_USE",    chassisNumber: "MHFAB1005EE00005", engineNumber: "4D56-0005", stnkExpiry: FUT,       kirExpiry: FUT,      serviceDate: FUT },
    { id: "seed-vehicle-6", type: "Truk Box",    brand: "Hino",       modelName: "Ranger", color: "Putih",  licensePlate: "B 1006 FF", status: "IN_USE",    chassisNumber: "MHFAB1006FF00006", engineNumber: "4D56-0006", stnkExpiry: FUT,       kirExpiry: FUT,      serviceDate: FUT },
    { id: "seed-vehicle-7", type: "Pickup",      brand: "Mitsubishi", modelName: "L300",   color: "Hitam",  licensePlate: "B 1007 GG", status: "AVAILABLE", chassisNumber: "MHFAB1007GG00007", engineNumber: "4D56-0007", stnkExpiry: NEAR_STNK, kirExpiry: FUT,      serviceDate: FUT }, // STNK near expiry
    { id: "seed-vehicle-8", type: "Truk Engkel", brand: "Isuzu",      modelName: "Elf",    color: "Kuning", licensePlate: "B 1008 HH", status: "AVAILABLE", chassisNumber: "MHFAB1008HH00008", engineNumber: "4D56-0008", stnkExpiry: FUT,       kirExpiry: NEAR_KIR, serviceDate: FUT }, // KIR near expiry
    { id: "seed-vehicle-9", type: "Truk Box",    brand: "Toyota",     modelName: "Dyna",   color: "Silver", licensePlate: "B 1009 II", status: "AVAILABLE", chassisNumber: "MHFAB1009II00009", engineNumber: "4D56-0009", stnkExpiry: FUT,       kirExpiry: FUT,      serviceDate: FUT },
  ] as const
  const vehicles = []
  for (const v of vehicleSeed) {
    const vehicle = await prisma.vehicle.upsert({
      where: { id: v.id },
      update: { brand: v.brand, modelName: v.modelName, color: v.color, status: v.status, stnkExpiry: v.stnkExpiry, kirExpiry: v.kirExpiry, serviceDate: v.serviceDate },
      create: { ...v, lastUpdatedByAdminId: admin.id },
    })
    vehicles.push(vehicle)
  }
  console.log(`✅ ${vehicles.length} vehicles (2 Standby, 4 In Use, 3 Available; 2 near doc expiry)`)

  // ── Pair each vehicle 1:1 with a driver (drivers[0..8] → vehicles[0..8]; drivers 10–12 spare) ──
  for (let i = 0; i < vehicles.length; i++) {
    await prisma.vehicle.update({
      where: { id: vehicles[i].id },
      data:  { primaryDriverId: drivers[i].id },
    })
  }
  console.log(`✅ paired ${vehicles.length} vehicles to drivers (${drivers.length - vehicles.length} substitute drivers spare)`)

  // ════════════════════════════════════════════════════════════
  // MOCK SHIPMENTS — all UNIT type (Asal from the pickup-plant list, Tujuan "Gudang MPL").
  // Two sets:
  //  • 6 ONGOING — one per engaged driver, fleet-SYNCED (driver/vehicle statuses above match):
  //      driver1→STANDBY, driver2→STANDBY, driver3→DITUGASKAN, driver4→AT_PLANT,
  //      driver5→TRANSIT, driver6→DITERIMA.
  //  • 10 SELESAI (DELIVERED) — completed history; terminal, so they hold no fleet.
  //    Spread across all 12 drivers (a driver's past trip; doesn't affect current status).
  // NOTE: Cargo/Container flows are not defined yet — these mocks are Unit only.
  // ════════════════════════════════════════════════════════════
  await prisma.shipment.deleteMany({})  // fresh mock set each seed (events cascade)
  const plantLabel = (p: typeof plants[number]) => `${p.manufacturer} - ${p.name}${p.code ? ` (${p.code})` : ""}`

  // di = index into drivers[] / vehicles[] (the paired 1:1 sets). Ongoing rows drive the fleet sync.
  const ongoing = [
    { status: "STANDBY",    di: 0 },
    { status: "STANDBY",    di: 1 },
    { status: "DITUGASKAN", di: 2 },
    { status: "AT_PLANT",   di: 3 },
    { status: "TRANSIT",    di: 4 },
    { status: "DITERIMA",   di: 5 },
  ]
  // 10 completed history rows, cycling drivers 1–9 (paired sets, have a vehicle to reference).
  const history = Array.from({ length: 10 }, (_, k) => ({ status: "DELIVERED", di: k % vehicles.length }))
  const shipmentSpecs = [...ongoing, ...history]

  for (let i = 0; i < shipmentSpecs.length; i++) {
    const { status, di } = shipmentSpecs[i]
    const plant = plants[i % plants.length]
    const isDone = status === "DELIVERED"
    // Ongoing rows MUST be today/future — the field-layout "Selesai" tab is a past-pickup-date
    // view, so a past date would drop an in-progress shipment into Selesai. History = past.
    const pickupOffset = isDone ? -(10 + i * 3) : i
    await prisma.shipment.create({
      data: {
        id:                  `#MPL-${String(i + 1).padStart(5, "0")}-JKT`,
        packageType:         "Kendaraan",
        weightKg:            500,
        units:               10,
        serviceLevel:        "Darat",
        shippingCategory:    "Unit",
        originLocation:      plantLabel(plant),
        destinationLocation: "Gudang MPL",
        status:              status,
        pickupDate:          daysFromNow(pickupOffset),
        pickupPlantId:       plant.id,
        clientId:            clients[i % clients.length].id,
        driverId:            drivers[di].id,
        vehicleId:           vehicles[di].id,
        createdByAdminId:    admin.id,
      },
    })
  }
  console.log(`✅ ${shipmentSpecs.length} mock UNIT shipments (6 ongoing fleet-synced: 2 Standby/1 Ditugaskan/1 Di Pabrik/1 Dalam Perjalanan/1 Diterima + 10 Selesai)`)

  console.log("\n🌱 Seed complete.")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
