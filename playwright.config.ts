import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },
  reporter: "list",
  webServer: {
    command: "node server/index.js",
    url: "http://127.0.0.1:4173/api/health",
    reuseExistingServer: false,
    env: {
      PORT: "4173",
      HOST: "127.0.0.1",
      DATA_DIR: mkdtempSync(join(tmpdir(), "komagene-browser-")),
    },
  },
});
