import { expect, test } from "@playwright/test";
import { mockShipmentsApi, openShipments, shipmentErrorPanel, shipmentRows } from "./support/integrationShipments";

/** Integratsiya → Posilkalar (tokhPLMP) — 390px, dizayn v2: jadval o'rniga kartalar. */
test.describe("Integratsiya posilkalari — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("⭐ TC10: posilkalar kartalarda, «Qayta jo'natish» ≥ 44px va ekranga sig'adi; sahifada gorizontal skroll yo'q", async ({ page }) => {
    const { leaked } = await mockShipmentsApi(page);
    await openShipments(page);

    // Telefonda jadval yo'q — kartalar ro'yxati.
    await expect(page.locator('table[aria-label="Posilkalar"]')).toHaveCount(0);
    await expect(shipmentRows(page)).toHaveCount(4);

    const retry = shipmentErrorPanel(page, "Mijoz 3 Aliyev").getByRole("button", { name: /Qayta jo'natish/ });
    await expect(retry).toBeVisible();
    // Pastki menyu ostida qolmasin — tugmani ekran o'rtasiga suramiz, keyin o'lchaymiz.
    await retry.evaluate((el) => el.scrollIntoView({ block: "center" }));
    const box = (await retry.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    // Tugma ustida boshqa narsa yo'q — bosiladi.
    const center = await retry.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return Boolean(hit && el.contains(hit));
    });
    expect(center).toBe(true);

    const main = await page.locator("main:has([data-shell-slot=content])").evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(main).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
