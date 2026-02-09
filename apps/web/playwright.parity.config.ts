import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const viewportWidth = Number(process.env.PARITY_WEB_VIEWPORT_WIDTH ?? "430");
const viewportHeight = Number(process.env.PARITY_WEB_VIEWPORT_HEIGHT ?? "932");

export default defineConfig({
  testDir: path.join(currentDir, "tests"),
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: "line",
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: viewportWidth, height: viewportHeight },
    deviceScaleFactor: 1,
  },
  webServer: {
    command: "pnpm exec next dev -H localhost -p 3100",
    cwd: currentDir,
    url: "http://localhost:3100/parity/plan",
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      PARITY_BYPASS_AUTH: process.env.PARITY_BYPASS_AUTH ?? "true",
      NEXT_PUBLIC_PARITY_BYPASS_TOKEN:
        process.env.NEXT_PUBLIC_PARITY_BYPASS_TOKEN ?? "parity-capture",
    },
  },
});
