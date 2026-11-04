import { test } from "@playwright/test";
import { runReceiveRemovesTodayMail } from "./support/mailReceiveToday";

/** «Bugungi»: qabul qilingan pochta orqaga qaytganda ro'yxatda qolmaydi (Bahodir, 2026-11-04) — 390px. */
test.describe("Pochta qabuli → «Bugungi» yangilanadi — 390px", () => {
  test.describe.configure({ timeout: 120_000 });

  test("⭐ filial menejeri: pochtani qabul qilib qaytsa — «Bugungi»da yo'q", async ({ page }) => {
    await runReceiveRemovesTodayMail(page, "manager");
  });

  test("kuryer: pochtani qabul qilib qaytsa — «Bugungi»da yo'q", async ({ page }) => {
    await runReceiveRemovesTodayMail(page, "courier");
  });
});
