// prisma/seed-condition-demo.ts
//
// One-off DEMO DATA generator for the Laporan / condition-analytics chart.
// Creates one DELIVERED shipment per day, per service line (Unit/Cargo/Container),
// from January 1st through today (full YTD) — so the daily-granularity Month/3-Month
// views have a continuous line with no gaps, not just a handful of scattered points.
//
// All demo shipments carry `specialNotes: "[DEMO-CONDITION]"` and ids prefixed
// `#MPL-DEMO-` so they're easy to find and delete later — this is throwaway
// visualization data, not part of the real seed lifecycle (`prisma/seed.ts`).
//
// Re-running clears out the previous demo batch first (by id prefix), so it's safe
// to run again after tweaking the constants below.
//
// Run:  npx tsx prisma/seed-condition-demo.ts
// Undo: DELETE FROM shipments WHERE id LIKE '#MPL-DEMO-%';  (cascades plant_checks)

import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const CATEGORIES = ["Unit", "Cargo", "Container"] as const
const MOTOR_TYPES = ["Honda Beat", "Honda Vario", "Yamaha NMAX", "Suzuki Address"]
const MIN_UNITS = 2
const MAX_UNITS = 6
const DEFECT_RATE = 0.2 // ~20% of units come back defective — visible but minority red slice

const rand = (n: number) => Math.floor(Math.random() * n)
const pick = <T,>(arr: readonly T[]): T => arr[rand(arr.length)]
const dateKey = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`

async function main() {
  const client = await prisma.user.findFirst({ where: { verificationStatus: "VERIFIED" } })
  const admin = await prisma.admin.findFirst({ where: { role: "SUPERADMIN" } })
  if (!client || !admin) {
    throw new Error("Need at least one VERIFIED client and one SUPERADMIN admin already seeded — run `npx prisma db seed` first.")
  }

  const { count: removed } = await prisma.shipment.deleteMany({ where: { id: { startsWith: "#MPL-DEMO-" } } })
  if (removed > 0) console.log(`- removed ${removed} previous demo shipment(s)`)

  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  let created = 0

  for (const day = new Date(start); day <= now; day.setDate(day.getDate() + 1)) {
    for (const category of CATEGORIES) {
      const unitCount = MIN_UNITS + rand(MAX_UNITS - MIN_UNITS + 1)
      const completionDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9 + rand(8), rand(60))
      const id = `#MPL-DEMO-${category.toUpperCase()}-${dateKey(day)}`

      const lkuRows = Array.from({ length: unitCount }, (_, u) => {
        const defective = Math.random() < DEFECT_RATE
        return {
          tipeMotor: pick(MOTOR_TYPES),
          noMesin: `DEMO-M-${id}-${u}`,
          noRangka: `DEMO-R-${id}-${u}`,
          warna: pick(["Merah", "Hitam", "Putih", "Biru"]),
          arrivedDefective: defective,
          arrivalNote: defective ? "Lecet saat bongkar (demo data)" : null,
        }
      })

      await prisma.shipment.create({
        data: {
          id,
          packageType: category,
          weightKg: 80 + rand(120),
          units: unitCount,
          serviceLevel: "Darat",
          originLocation: "Jakarta",
          destinationLocation: pick(["Bandung", "Semarang", "Surabaya", "Yogyakarta"]),
          specialNotes: "[DEMO-CONDITION]",
          status: "DELIVERED",
          currentProgressPercent: 100,
          completionDate,
          createdAt: completionDate,
          shippingCategory: category,
          clientId: client.id,
          createdByAdminId: admin.id,
          lastUpdatedByAdminId: admin.id,
          plantCheck: {
            create: {
              checkedByAdminId: admin.id,
              pengiriman: { create: [{ tipeMotor: category, jumlah: unitCount, satuan: "unit" }] },
              lku: { create: lkuRows },
            },
          },
        },
      })
      created++
    }
  }

  const days = Math.round((now.getTime() - start.getTime()) / 86400000) + 1
  console.log(`✔ Seeded ${created} demo shipments — 1 per day × 3 categories × ${days} days (Jan 1–${now.toDateString()}).`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
