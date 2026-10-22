import { expect, test } from "@playwright/test";
import {
  MARKET_TARIFFS,
  mainHorizontalOverflow,
  mockOrderCreateApi,
  openManualCreate,
  PRICED_PRODUCTS,
} from "./support/orderCreate";

/**
 * CS-B — 390px TELEFON: yetkazish kartalarida narx sig'adi (gorizontal skroll yo'q), rasm 40px, «Qo'llash»
 * bosish maydoni ≥ 44px, matn ≥ 12px.
 */
test.describe("Buyurtma yaratish — standart narx va summa taklifi (CS-B), 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("kartalar to'liq qatorda, narx karta ichida; «Qo'llash» ≥ 44px; toshish yo'q", async ({ page }) => {
    const { leaked } = await mockOrderCreateApi(page, { profile: MARKET_TARIFFS, products: PRICED_PRODUCTS });
    await openManualCreate(page);

    const delivery = page.getByRole("group", { name: /Yetkazish turi/ });
    for (const [name, price] of [
      ["Markazgacha", "25 000 so'm"],
      ["Uygacha", "35 000 so'm"],
    ]) {
      const card = delivery.locator("label").filter({ hasText: name });
      await expect(card).toContainText(price);
      const box = (await card.boundingBox())!;
      const priceBox = (await card.getByText(price).boundingBox())!;
      expect(box.width, name).toBeGreaterThanOrEqual(280);
      expect(box.height, name).toBeGreaterThanOrEqual(44);
      // Narx karta ichida (kesilmaydi, karta chetidan chiqmaydi).
      expect(priceBox.x + priceBox.width, name).toBeLessThanOrEqual(box.x + box.width);
    }
    await expect(delivery.getByRole("radio", { name: /Uygacha/ })).toBeChecked();

    const catalog = page.getByRole("list", { name: /katalogi$/ });
    const holder = catalog.getByRole("button", { name: /Telefon ushlagich/ });
    const thumbBox = (await holder.locator("[data-product-thumb]").boundingBox())!;
    expect(Math.round(thumbBox.width)).toBe(40);

    await holder.click();
    const total = page.locator('input[name="details.total_price"]');
    await expect(total).toHaveValue("45 000");
    await total.fill("50000");
    const apply = page.getByRole("button", { name: "Mahsulotlar bo'yicha summani qo'llash: 45 000 so'm" });
    await apply.scrollIntoViewIfNeeded();
    const applyBox = (await apply.boundingBox())!;
    expect(applyBox.height).toBeGreaterThanOrEqual(44);
    await apply.click();
    await expect(total).toHaveValue("45 000");

    const summary = page.getByRole("complementary", { name: "Buyurtma xulosasi" });
    await expect(summary.getByRole("group", { name: "Yetkazish narxi" })).toContainText("35 000 so'm");

    // Yangi matnlar 12px dan kichik emas.
    const tiny = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          '[role="group"][aria-labelledby], fieldset p, [data-product-thumb] ~ span, [data-field] div',
        ),
      )
        .filter((el) => el.textContent?.trim() && parseFloat(getComputedStyle(el).fontSize) < 12)
        .map((el) => el.textContent?.trim()),
    );
    expect(tiny).toEqual([]);
    expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
