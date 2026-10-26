import { expect, test } from "@playwright/test";
import { mockOrderDetailApi, openOrderDetail } from "./support/orderDetail";
import { RECEIVE_TRACKING } from "./support/trackingReceive";

/**
 * vbu7Wr3o — buyurtma tarixi, 1440px: pochta qabuli jumlasi («… pochtani qabul qildi — <filial>», «kutilmoqda holatiga
 * qaytardi» emas), «… filiali filialiga» takrorlanmaydi, metadata o'zbekcha (xom «From Holder Type: HQ / Received By: 101 /
 * Source Type: BRANCH» emas).
 */
test.describe("Buyurtma tarixi — pochta qabuli (1440)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ (${theme}) qabul jumlasi, filial nomi takrorlanmaydi, metadata o'zbekcha`, async ({ page }, testInfo) => {
      if (theme === "dark") {
        await page.addInitScript(() => {
          window.localStorage.setItem("theme", "dark");
          window.localStorage.setItem("theme-version", "2");
        });
      }
      const { leaked } = await mockOrderDetailApi(page, undefined, { tracking: () => RECEIVE_TRACKING });
      await openOrderDetail(page);

      const block = page.locator("section").filter({ has: page.getByRole("heading", { name: "Buyurtma tarixi" }) });
      const items = block.getByTestId("tracking-event");
      await expect(items).toHaveCount(3);
      const texts = await items.allInnerTexts();
      const all = texts.join("\n");

      expect(all).toContain("Menejer Ravshan Ortiqov pochtani qabul qildi — TEST Claude Surxondaryo filiali");
      expect(all).toContain("HQ'dan TEST Claude Surxondaryo filialiga jo'natdi");
      expect(all).not.toMatch(/filiali filialiga/);
      expect(all).not.toMatch(/kutilmoqda holatiga qaytardi/);

      expect(all).toContain("Kimdan: Bosh ofis (HQ)");
      expect(all).toContain("Jo'natuvchi: Filial");
      expect(all).toContain("Jo'natuvchi roli: Menejer");
      expect(all).not.toMatch(/From Holder Type|Received By|Source Type|BRANCH|101/);

      await block.scrollIntoViewIfNeeded();
      await testInfo.attach(`tracking-receive-${theme}-1440`, { body: await block.screenshot(), contentType: "image/png" });
      expect(leaked).toEqual([]);
    });
  }
});
