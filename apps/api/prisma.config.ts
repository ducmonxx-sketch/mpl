// prisma.config.ts
//
// Prisma 7+ — datasource URL is defined HERE, not in schema.prisma.
// This file replaces the `url = env("DATABASE_URL")` line
// that used to live inside the datasource block in schema.prisma.
//
// Place this file at the ROOT of apps/api/ (same level as package.json)

import "dotenv/config"
import { defineConfig, env } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",  // npx prisma db seed will run this
  },

  datasource: {
    url: env("DATABASE_URL"), // reads from .env automatically
  },
})