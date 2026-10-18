import { existsSync, readdirSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { assertUpdateAllowed } from "./tests/visual/support/policy";
import type { Theme } from "./tests/visual/support/test";

/**
 * Dizayn v2, 5-bosqich — vizual snapshotlar (docs/DESIGN_SYSTEM.md §12.5).
 *
 * Alohida bundle (`npm run visual:build` → `dist-visual`, API = soxta `http://api.visual.test`), `vite preview`
 * :4178 da (asosiy dev server :4173, G2 probe'lari :4176 — to'qnashmaydi). Sahnalar: `tests/visual/scenes/*.visual.ts`.
 *
 * Baseline FAQAT CI'da, Playwright Docker obrazida (`mcr.microsoft.com/playwright:v1.59.1-noble`) yaratiladi va
 * tekshiriladi: boshqa mashinada shrift/rasterlash farq qiladi. Shuning uchun:
 *   - `--update-snapshots` / `-u` faqat `VISUAL_IN_DOCKER=1` bilan (CI «Visual» workflow) — aks holda xato;
 *   - bayroqsiz yugurishda `updateSnapshots: "none"` — yo'q baseline hech qachon lokalda yozilmaydi
 *     (sahna «baseline yo'q» deb neytral o'tadi, `tests/visual/support/test.ts`);
 *   - lokal tekshiruv faqat `VISUAL_DRY=1` bilan: chizish + tekshiruvlar, solishtirish yo'q →
 *     `test-results-visual/dry/<loyiha>/<id>.png`.
 */
const PORT = 4178;
const DIST = "dist-visual";

const argv = process.argv.slice(2);
// `--update-snapshots` / `-u` faqat `VISUAL_IN_DOCKER=1` bilan (CI «Visual» workflow) — aks holda shu yerda xato.
assertUpdateAllowed(argv, process.env);

// Asosiy jarayonda (ishchilarda emas): to'g'ri bundle bormi — prod API'ga murojaat qiladigan oddiy `dist` emas.
if (!process.env.TEST_WORKER_INDEX && !argv.includes("--list")) {
  if (!existsSync(`${DIST}/index.html`)) {
    throw new Error(`Vizual: ${DIST}/ yo'q — avval \`npm run visual:build\` (yoki \`npm run test:visual\`).`);
  }
  const assets = existsSync(`${DIST}/assets`) ? readdirSync(`${DIST}/assets`).filter((file) => file.endsWith(".js")) : [];
  if (!assets.some((file) => readFileSync(`${DIST}/assets/${file}`, "utf8").includes("http://api.visual.test"))) {
    throw new Error(
      `Vizual: ${DIST}/ soxta API bilan yig'ilmagan (VITE_BASE_URL=http://api.visual.test/) — \`npm run visual:build\` ni qayta yuring.`,
    );
  }
}

const desktop = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const phone = {
  ...devices["Desktop Chrome"],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
};

export default defineConfig<{ theme: Theme }>({
  testDir: "./tests/visual",
  testMatch: /\.visual\.ts$/,
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  outputDir: "test-results-visual",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 1,
  // Qayta urinish beqarorlikni yashiradi: beqaror sahna — `test.fixme` + issue.
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  // Bayroqsiz yugurish hech qachon baseline yozmaydi (CI update qadami `--update-snapshots=all` beradi).
  updateSnapshots: "none",
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: "playwright-report-visual", open: "never" }]]
    : [["list"]],
  expect: {
    // Uzun sahifa (6–12 ming px) ikki marta bir xil kadr olinguncha — sukut 5 s CI'da yetmasligi mumkin.
    timeout: 20_000,
    toHaveScreenshot: {
      // Baseline va tekshiruv bitta obrazda — kutilgan farq 0; 64 px kamdan-kam anti-aliasing shovqini uchun.
      // `maxDiffPixelRatio` YO'Q: 1440 × 6000 da 0,1 % ham 8 600 px ni yashiradi. Global qiymat oshirilmaydi.
      maxDiffPixels: 64,
      threshold: 0.2,
      animations: "disabled",
      caret: "hide",
      scale: "css",
      stylePath: "./tests/visual/support/screenshot.css",
    },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    timezoneId: "Asia/Tashkent",
    locale: "uz-UZ",
    // Ilova `motion-reduce:` ni hurmat qiladi (o'tishlar yo'q, varaqa darhol joyida).
    contextOptions: { reducedMotion: "reduce" },
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx vite preview --outDir ${DIST} --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    { name: "desktop-light", use: { ...desktop, colorScheme: "light", theme: "light" } },
    { name: "desktop-dark", use: { ...desktop, colorScheme: "dark", theme: "dark" } },
    { name: "phone-light", use: { ...phone, colorScheme: "light", theme: "light" } },
    { name: "phone-dark", use: { ...phone, colorScheme: "dark", theme: "dark" } },
  ],
});
