import { spawnSync } from "node:child_process";

const vercelEnvironment =
  process.env.VERCEL_TARGET_ENV ?? process.env.VERCEL_ENV;

if (!process.env.VERCEL) {
  console.log("Skipping database migrations outside Vercel.");
  process.exit(0);
}

if (vercelEnvironment === "preview" || vercelEnvironment === "development") {
  console.log(`Skipping database migrations for ${vercelEnvironment}.`);
  process.exit(0);
}

if (vercelEnvironment !== "production") {
  console.error(
    "Refusing to determine migration behavior without a known Vercel environment.",
  );
  process.exit(1);
}

const migrationDatabaseUrl = process.env.MIGRATION_DATABASE_URL;

if (!migrationDatabaseUrl) {
  console.error(
    "MIGRATION_DATABASE_URL is required for production database migrations.",
  );
  process.exit(1);
}

const migration = spawnSync(
  "pnpm",
  [
    "--filter",
    "@planeatrepeat/db",
    "exec",
    "prisma",
    "migrate",
    "deploy",
  ],
  {
    env: {
      ...process.env,
      DATABASE_URL: migrationDatabaseUrl,
    },
    stdio: "inherit",
  },
);

if (migration.error) {
  console.error("Failed to start Prisma migration:", migration.error.message);
  process.exit(1);
}

process.exit(migration.status ?? 1);
