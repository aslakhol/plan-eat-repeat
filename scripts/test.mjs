import { globSync } from "node:fs";
import { spawnSync } from "node:child_process";

const integration = process.argv.includes("--integration");
const files = globSync("src/**/*.test.{ts,tsx}").filter(
  (file) => file.includes(".integration.test.") === integration,
);
if (files.length === 0) throw new Error("No test files found");

const result = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "--experimental-test-module-mocks",
    "--test",
    ...(integration ? ["--test-concurrency=4"] : []),
    ...files,
  ],
  {
    stdio: "inherit",
    env: integration
      ? process.env
      : { ...process.env, SKIP_ENV_VALIDATION: "1" },
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
