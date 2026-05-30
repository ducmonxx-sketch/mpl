// src/lib/prisma.ts
//
// Prisma 7 client setup.
//
// Key difference from v6:
//   - Prisma 7 uses driver adapters by default
//   - You must pass a pg Pool into PrismaPg adapter
//   - Import PrismaClient from YOUR generated folder, not from node_modules
//
// Why a Pool?
//   A Pool maintains multiple reusable DB connections.
//   Without it, every query would open and close a fresh connection — slow and wasteful.

import { Pool }       from "pg"
import { PrismaPg }   from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client" // ← your local generated client

// Create a connection pool pointing to your PostgreSQL database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// Wrap the pool in Prisma's pg adapter
const adapter = new PrismaPg(pool)

// Create the Prisma client using the adapter
// This is the ONE instance shared across the entire app
const prisma = new PrismaClient({ adapter })

export default prisma
