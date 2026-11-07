import { test } from "@playwright/test";
import { runMailScanReceive } from "./support/mailScanReceive";

/**
 * Pochta tafsiloti: USB skan = darhol qabul (2026-11-07, BeePost kabi) — 1440px. Belgi qo'yilmaydi: har skan faqat shu
 * buyurtmani `PATCH post/receive/:id {order_ids: [id], scan: true}` bilan qabul qiladi va qator ro'yxatdan chiqadi.
 */
test.describe("Pochta tafsiloti — skan = darhol qabul — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ kuryer: o'z pochtasida USB skan — buyurtma qabul qilinadi va yo'qoladi; oxirgisidan keyin «Bugungi»", async ({
    page,
  }) => {
    await runMailScanReceive(page, "courier");
  });

  test("filial menejeri: o'z filialiga o'tkazma pochtasida USB skan — xuddi shunday", async ({ page }) => {
    await runMailScanReceive(page, "manager");
  });
});
