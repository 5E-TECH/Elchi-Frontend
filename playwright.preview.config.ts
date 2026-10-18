import { defineConfig, devices } from "@playwright/test";

/**
 * PROD BUILD ustida e2e (`vite preview`). Service Worker faqat PROD'da
 * ro'yxatdan o'tadi (`main.tsx`), shuning uchun push oqimi (SW, `push`
 * hodisasi, ikki-xabar to'sig'i) faqat shu yerda haqiqiy holda tekshiriladi.
 * Ishga tushirish: `PLAYWRIGHT_CHANNEL=chrome npx playwright test -c playwright.preview.config.ts`.
 */
const channel = process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {};
/** Prod API hosti DNS'da topilmaydi — soxtalanmagan so'rov yoki WebSocket prod'ga yetmaydi (`playwright.config.ts` dagidek). */
const blockProdApi = { args: ["--host-resolver-rules=MAP api.elchipochta.uz ~NOTFOUND"] };

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /\.preview\.spec\.ts$/,
  timeout: 90_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4175",
    trace: "retain-on-failure",
    launchOptions: blockProdApi,
  },
  webServer: {
    command: "npm run build && npx vite preview --host 127.0.0.1 --port 4175 --strictPort",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
    timeout: 600_000,
  },
  projects: [{ name: "chromium-prod", use: { ...devices["Desktop Chrome"], ...channel } }],
});
