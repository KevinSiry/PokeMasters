import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "apps/web/e2e",
  globalSetup: "./apps/web/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    // Chromium préinstallé ailleurs (ex. environnement cloud) : PW_CHROMIUM_PATH=/chemin/vers/chrome
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      // L'app doit être construite au préalable (npm run build).
      command: "npm run start -w @pokeflex/web",
      url: `http://localhost:${port}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // Serveur temps réel (messagerie).
      command: "npm run start -w @pokeflex/realtime",
      url: "http://localhost:3001/health",
      reuseExistingServer: !process.env.CI,
      env: { CATALOG_AUTO_SYNC: "false" },
      timeout: 60_000,
    },
  ],
});
