import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { Pool } from "pg";

// Re-export Prisma types
export * from "../generated/prisma/client";
export type { PrismaClient };

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// With the pg driver adapter, `pg.Pool` (not Prisma) owns connection pooling,
// and the `connection_limit` URL param is ignored. Each warm serverless
// instance would otherwise open up to pg's default of 10 connections; a few
// concurrent instances then blow past Supabase's session-mode pooler limit
// (pool_size 15) and throw EMAXCONNSESSION. Cap the pool low and release idle
// sessions quickly so instances share the pooler budget.
const POOL_MAX = Number(process.env.DATABASE_POOL_MAX ?? 3);
const POOL_IDLE_TIMEOUT_MS = 10_000;

function createPool(connectionString: string) {
  return new Pool({
    connectionString,
    max: POOL_MAX,
    idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
  });
}

export function createPrismaClient(connectionString: string) {
  const pool = createPool(connectionString);
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export function getDb(connectionString: string, isDev = false) {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const pool = createPool(connectionString);
  const adapter = new PrismaPg(pool);

  const db = new PrismaClient({
    adapter,
    log: isDev ? ["query", "error", "warn"] : ["error"],
  });

  if (isDev) {
    globalForPrisma.prisma = db;
  }

  return db;
}
