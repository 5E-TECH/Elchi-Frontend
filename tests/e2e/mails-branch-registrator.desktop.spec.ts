import { test } from "@playwright/test";
import { runBranchRegistratorDesktop, runHqRegistratorKeepsToday } from "./support/mailsBranchRegistrator";

/** «Yangi pochtalar» faqat HQ xodimlariga (anKpzwxk, Elchi-Backend #620): filial registratorida «Bugungi» yo'q, 403 yo'q. */
test.describe("Pochta — HQ bo'lmagan registrator", () => {
  test.describe.configure({ timeout: 120_000 });

  test("⭐ REGIONAL registrator 1440 (kunduzgi): «Bugungi» yo'q, post/new so'ralmaydi, 403 xabari yo'q", async ({ page }) => {
    await runBranchRegistratorDesktop(page, "light");
  });

  test("REGIONAL registrator 1440 (tungi)", async ({ page }) => {
    await runBranchRegistratorDesktop(page, "dark");
  });

  test("HQ registratori: «Bugungi» va post/new o'zgarmagan", async ({ page }) => {
    await runHqRegistratorKeepsToday(page);
  });
});
