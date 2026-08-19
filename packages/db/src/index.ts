import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { PrismaClient } from "../generated/prisma/client";
import { Pool } from "pg";

// Re-export Prisma types
export * from "../generated/prisma/client";
export type { PrismaClient };

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// With the pg driver adapter, `pg.Pool` owns connection pooling and ignores the
// `connection_limit` URL parameter. Keep modest per-instance concurrency and
// release idle clients before Vercel suspends a Fluid Compute instance.
const POOL_MAX = 3;
const POOL_IDLE_TIMEOUT_MS = 5_000;

function createPool(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: POOL_MAX,
    idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
  });

  attachDatabasePool(pool);
  return pool;
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
