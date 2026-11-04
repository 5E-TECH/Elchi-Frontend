import { test } from "@playwright/test";
import { runBranchColumnPhone } from "./support/mailsBranchColumn";

/** «Pochta» jadvali telefonda (390): karta izohida kuryer o'rnida filial (Bahodir, 2026-11-04). */
test.describe("Pochta jadvali — «Filial» (390px)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("⭐ superadmin: karta izohida filial (kunduzgi)", async ({ page }) => {
    await runBranchColumnPhone(page, "light");
  });

  test("superadmin: karta izohida filial (tungi)", async ({ page }) => {
    await runBranchColumnPhone(page, "dark");
  });
});
