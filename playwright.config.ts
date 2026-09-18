import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/start-browser-server.mjs",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: "development",
      STARTUP_CHECKS_MODE: "browser-test",
      APP_ORIGIN: "https://browser-test.local",
      BETTER_AUTH_URL: "https://browser-test.local",
      SITE_URL: "https://browser-test.local",
      BETTER_AUTH_SECRET: "browser-test-secret-that-is-at-least-32-characters-long",
      DATABASE_URL: "/tmp/munich-bike-rental-browser-test.db",
      // Keep local .env.local integrations out of the browser fixture. CI has
      // no Nevlo credentials, and browser tests must not depend on a developer
      // token or make an external API request during startup.
      NEVLO_CLIENT_ID: "",
      NEVLO_ACCESS_TOKEN: "",
      NEVLO_REFRESH_TOKEN: "",
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
