import { expect, test } from "@playwright/test";
import { fixedActionColumnProblems, mockShipmentsApi, openShipments, shipmentRow } from "./support/integrationShipments";

/** Integratsiya → Posilkalar (tokhPLMP) — 390px. */
test.describe("Integratsiya posilkalari — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("⭐ TC10: \"Amal\" ustuni o'ngda qotirilgan, kesilmaydi; jadval o'z ichida skroll qiladi, sahifa emas", async ({ page }) => {
    const { leaked } = await mockShipmentsApi(page);
    await openShipments(page);

    const header = page.locator(".ant-table-thead th").filter({ hasText: "Amal" });
    const retry = shipmentRow(page, "Mijoz 3 Aliyev").getByRole("button", { name: /Qayta/ });
    await expect(retry).toBeVisible();

    const container = await page.locator(".ant-table-content, .ant-table-body").first().boundingBox();
    for (const target of [header, retry]) {
      const box = (await target.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(container!.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(container!.x + container!.width + 1);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
    // Tugma ustida boshqa narsa yo'q — bosiladi.
    const center = await retry.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return Boolean(hit && el.contains(hit));
    });
    expect(center).toBe(true);

    // Jadval ichida oxirigacha skroll — "Amal" baribir joyida.
    await page.locator(".ant-table-content, .ant-table-body").first().evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await expect(retry).toBeVisible();
    expect((await retry.boundingBox())!.x + (await retry.boundingBox())!.width).toBeLessThanOrEqual(390);
    expect(await fixedActionColumnProblems(page)).toEqual([]);

    const main = await page.locator("main.el-surface-page").evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(main).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
