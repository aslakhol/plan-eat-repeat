import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const webPort = 3000;
const viewportWidth = 430;
const viewportHeight = 932;

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
