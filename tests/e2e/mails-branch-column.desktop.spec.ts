import { test } from "@playwright/test";
import { runBranchColumnTable, runManagerKeepsCourier } from "./support/mailsBranchColumn";

/** «Pochta» jadvali: «Kuryer» o'rnida «Filial» (Bahodir, 2026-11-04) — 1440 / 768, kunduzgi va tungi. */
test.describe("Pochta jadvali — «Filial» ustuni", () => {
  test.describe.configure({ timeout: 120_000 });

  test("⭐ superadmin 1440 (kunduzgi): «Eski» va «Rad etilgan» — «Filial», kuryer yo'q", async ({
    page,
  }) => {
    await runBranchColumnTable(page, "light", 1440);
  });

  test("superadmin 1440 (tungi)", async ({ page }) => {
    await runBranchColumnTable(page, "dark", 1440);
  });

  test("superadmin 768: filial viloyat ostida", async ({ page }) => {
    await runBranchColumnTable(page, "light", 768);
  });

  test("HQ menejeri: «Kuryer» qoladi, filial nomlari so'ralmaydi", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await runManagerKeepsCourier(page);
  });
});
