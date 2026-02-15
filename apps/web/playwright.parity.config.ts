import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const viewportWidth = Number(process.env.PARITY_WEB_VIEWPORT_WIDTH ?? "430");
const viewportHeight = Number(process.env.PARITY_WEB_VIEWPORT_HEIGHT ?? "932");
const webPort = Number(process.env.PARITY_WEB_PORT ?? "3000");

export default defineConfig({
  testDir: path.join(currentDir, "tests"),
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: "line",
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    viewport: { width: viewportWidth, height: viewportHeight },
    deviceScaleFactor: 1,
  },
});
