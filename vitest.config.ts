import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
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
