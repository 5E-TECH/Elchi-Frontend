import { defineConfig, devices } from "@playwright/test";

/** Brauzer kanali (masalan `PLAYWRIGHT_CHANNEL=chrome`) — o'rnatilgan Chromium bo'lmasa. */
const channel = process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {};

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /\.mobile\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], ...channel },
    },
    {
      // Operatorlar telefonda ishlaydi — 390px (iPhone 12 kengligi), Chromium'da.
      name: "mobile-390",
      testMatch: /\.mobile\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        ...channel,
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
