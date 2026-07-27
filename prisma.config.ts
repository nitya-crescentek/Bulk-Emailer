import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js loads .env.local; the Prisma CLI does not, so load it here too and
// keep a single source of truth. .env.local wins over .env.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations run over a direct connection; Supabase's pooled URL (pgbouncer)
    // cannot run them. Fall back to DATABASE_URL for plain Postgres setups.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
