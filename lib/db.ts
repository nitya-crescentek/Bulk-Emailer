import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// The dev server re-evaluates modules on every hot reload; caching on
// globalThis keeps a single connection pool instead of one per reload.
const globalForPrisma = globalThis as unknown as {
  _prisma?: PrismaClient;
};

function create(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it at your Postgres/Supabase database."
    );
  }
  // The app talks to the pooled URL; migrations use DIRECT_URL (see prisma.config.ts).
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma._prisma ?? create();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma._prisma = prisma;
}
