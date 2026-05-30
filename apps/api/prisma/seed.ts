import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcrypt"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const admin = await prisma.admin.upsert({
    where: { email: "admin@mpl.com" },
    update: {},
    create: {
      fullName: "Super Admin",
      email: "admin@mpl.com",
      passwordHash: await bcrypt.hash("admin1234", 10),
      role: "SUPERADMIN",
    }
  })
  console.log("✅ Admin created:", admin.email)

  const client = await prisma.user.upsert({
    where: { email: "client@mpl.com" },
    update: {},
    create: {
      fullName: "Whitelist Client",
      companyName: "MPL Whitelist Corp",
      email: "client@mpl.com",
      passwordHash: await bcrypt.hash("client1234", 10),
      phoneNumber: "1234567890",
      verificationStatus: "VERIFIED",
    }
  })
  console.log("✅ Client created:", client.email)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())