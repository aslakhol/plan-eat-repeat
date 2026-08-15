import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const webPort = 3000;
const baseURL = process.env.CAPTURE_BASE_URL ?? `http://127.0.0.1:${webPort}`;
const viewportWidth = Number(process.env.CAPTURE_VIEWPORT_WIDTH ?? 430);
const viewportHeight = Number(process.env.CAPTURE_VIEWPORT_HEIGHT ?? 932);

export default defineConfig({
  testDir: path.join(currentDir, "tests"),
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: "line",
  use: {
    baseURL,
    viewport: { width: viewportWidth, height: viewportHeight },
    deviceScaleFactor: 1,
  },
});
