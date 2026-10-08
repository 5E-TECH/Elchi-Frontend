import { expect, test } from "@playwright/test";
import { mockOrderDetailApi, openOrderDetail } from "./support/orderDetail";

/**
 * BUYURTMA MA'LUMOTLARI (OrderMeta) — 1440px.
 * Tartib: O'NG ustunda Meta → Mijoz; qisman sotuv banneri; kuryer tel: havolasi.
 */
test.describe("Buyurtma ma'lumotlari — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("o'ng ustunda Mijozdan yuqorida; kuryer + tel; banner; gorizontal skroll yo'q", async ({ page }) => {
    const { leaked } = await mockOrderDetailApi(page);
    await openOrderDetail(page);

    const meta = page.getByTestId("order-meta");
    const customer = page.getByText("Mijoz ma'lumotlari").first();
    const products = page.getByText("Buyurtma mahsulotlari").first();
    const [metaBox, customerBox, productsBox] = await Promise.all([
      meta.boundingBox(),
      customer.boundingBox(),
      products.boundingBox(),
    ]);
    // O'ng ustun: mahsulotlardan o'ngda, mijoz bilan bir xil ustunda va undan yuqorida.
    expect(metaBox!.x).toBeGreaterThan(productsBox!.x + 100);
    expect(Math.abs(metaBox!.x - (customerBox!.x - 16))).toBeLessThan(60);
    expect(metaBox!.y + metaBox!.height).toBeLessThanOrEqual(customerBox!.y);

    await expect(page.getByTestId("meta-courier")).toContainText("Xorazm Courier");
    await expect(page.getByTestId("meta-courier").locator("a")).toHaveAttribute("href", "tel:+998970000090");
    await expect(page.getByTestId("meta-holder")).toContainText("Kuryerda: Xorazm Courier");
    await expect(page.getByTestId("order-parent-banner")).toContainText("#95");

    const overflow = await page
      .locator("main.el-surface-page")
      .evaluate((main) => main.scrollWidth - main.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
