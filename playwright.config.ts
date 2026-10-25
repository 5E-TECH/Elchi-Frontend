import { defineConfig, devices } from "@playwright/test";

/** Brauzer kanali (masalan `PLAYWRIGHT_CHANNEL=chrome`) — o'rnatilgan Chromium bo'lmasa. */
const channel = process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {};

/**
 * Prod API hosti e2e brauzerida DNS'da topilmaydi: `route.fulfill` bilan soxtalangan so'rovlar tarmoqqa chiqmaydi,
 * ushlanmagan narsa (masalan jonli kanal WebSocket'i — `context.route` uni ushlamaydi) esa prod'ga YETMAYDI.
 */
const blockProdApi = { args: ["--host-resolver-rules=MAP api.elchipochta.uz ~NOTFOUND"] };

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  // CI (GitHub Actions, 2 yadro): 2 ishchi; tasodifiy tarmoq/taymer tebranishi uchun bitta qayta urinish
  // (`trace: on-first-retry` shu qayta urinishda iz yozadi). Lokalda qayta urinish yo'q — yiqilish darhol ko'rinadi.
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: "http://127.0.0.1:4194",
    trace: "on-first-retry",
    launchOptions: blockProdApi,
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4194",
    url: "http://127.0.0.1:4194",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      // `*.preview.spec.ts` — PROD build ustida, alohida konfiguratsiya (playwright.preview.config.ts).
      testIgnore: /\.(mobile|preview)\.spec\.ts$/,
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
    // Safari (WebKit, iPhone 12) — faqat `PLAYWRIGHT_WEBKIT=1` bilan: CI faqat Chromium o'rnatadi.
    // Bosish maydoni (aA5njZNo), `100dvh` balandligi (HcUjGTxT), kamera xatosi (kkDkrAIz) va bosh ekran manifesti
    // (QgqO0CdZ) testlari ikkala dvigatelda o'tishi kerak.
    ...(process.env.PLAYWRIGHT_WEBKIT
      ? [
          {
            name: "webkit-iphone",
            testMatch: /(tap-targets|viewport-height|scanner-camera-errors|ios-homescreen)\.mobile\.spec\.ts$/,
            // `--host-resolver-rules` — Chromium bayrog'i; WebKit'da soxtalanmagan so'rov `route.abort` bilan to'xtaydi.
            use: { ...devices["iPhone 12"], launchOptions: {} },
          },
        ]
      : []),
  ],
});
