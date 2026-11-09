import { test } from "@playwright/test";
import { runBranchRegistratorPhone } from "./support/mailsBranchRegistrator";

/** «Yangi pochtalar» faqat HQ xodimlariga (anKpzwxk) — telefon (390): bo'lim tanlagichida «Bugungi» yo'q. */
test.describe("Pochta — HQ bo'lmagan registrator (390px)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("⭐ REGIONAL registrator (kunduzgi): «Bugungi pochtalar» yo'q, post/new so'ralmaydi", async ({ page }) => {
    await runBranchRegistratorPhone(page, "light");
  });

  test("REGIONAL registrator (tungi)", async ({ page }) => {
    await runBranchRegistratorPhone(page, "dark");
  });
});
