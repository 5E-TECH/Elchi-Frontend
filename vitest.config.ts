import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Testlar doim Toshkent vaqtida yuradi (ilova foydalanuvchilari va «Visual» sahnalari ham shu mintaqada). Aks holda
// mahalliy kompyuterda (UTC+5) o'tgan test GitHub runner'ida (UTC) yiqiladi — 2026-10-22 dagi deploy #139/#140
// shunday to'xtagan edi. Fork ishchilari muhitni shu jarayondan oladi; qo'riqchi — `src/test/timezone.test.ts`.
process.env.TZ = "Asia/Tashkent";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    // Playwright e2e (tests/e2e) — `npm run test:e2e` bilan, vitest emas.
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
    css: true,
    // jsdom + Ant Design/Highcharts suites are memory-heavy. The default
    // thread pool heavily contended on this project and looked hung with no
    // progress. A small fork pool is slower per worker but deterministic.
    pool: "forks",
    maxWorkers: 2,
    testTimeout: 10_000,
    hookTimeout: 10_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
    },
  },
});
