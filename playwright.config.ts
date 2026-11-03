import { defineConfig, devices } from "@playwright/test";

import { assertTestDatabaseUrl } from "./scripts/database-target";

const databaseUrl = assertTestDatabaseUrl(process.env.DATABASE_URL ?? "");
const baseURL = "http://127.0.0.1:3102";

export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: true,
  workers: 3,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "tablet-chromium", use: { viewport: { width: 820, height: 1180 } } },
  ],
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3102",
    url: baseURL,
    reuseExistingServer: false,
    env: { DATABASE_URL: databaseUrl, NODE_ENV: "production", SITE_URL: baseURL, NEXT_TELEMETRY_DISABLED: "1" },
    timeout: 60000,
  },
});
