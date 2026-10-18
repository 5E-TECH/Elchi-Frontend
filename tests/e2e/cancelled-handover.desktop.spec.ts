import { expect, test } from "@playwright/test";
import { CANCELLED_ORDERS, MARKET_QR, mockCancelledApi, openHandover, usbScan } from "./support/cancelledHandover";

/**
 * Bekor qilinganlarni marketga topshirish — 1440px (dizayn v2, maket `superadmin-neworders-cancelled-handover`).
 * Market QR skanerlanmaguncha jo'natilmaydi; USB skaner bilan market QR o'qilsa barcha bekorlar tanlanadi
 * va topshirish tokeni bilan jo'natiladi.
 */
test.describe("Bekor qilinganlar — market QR bilan topshirish, 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("market QR'siz jo'natib bo'lmaydi; QR skanerlansa — hammasi tanlanadi va token bilan jo'natiladi", async ({ page }) => {
    const { leaked, scanned, handovers } = await mockCancelledApi(page);
    await openHandover(page);

    await expect(page.getByText("Market QR kerak")).toBeVisible();
    await expect(page.getByRole("button", { name: "Marketga jo'natish" })).toBeDisabled();
    await expect(page.getByRole("checkbox", { name: "№10235 ni qo'lda tanlash" })).not.toBeChecked();

    await usbScan(page, MARKET_QR);

    await expect(page.getByText("Market QR skanerlandi")).toBeVisible();
    await expect(page.getByRole("timer", { name: /QR amal qilish vaqti/ })).toBeVisible();
    for (const order of CANCELLED_ORDERS) {
      await expect(page.getByRole("checkbox", { name: `№${order.id} ni tanlovdan chiqarish` })).toBeChecked();
    }
    expect(scanned).toEqual([MARKET_QR]);

    await page.getByRole("button", { name: "Marketga jo'natish — 3 ta" }).click();
    await expect.poll(() => handovers.length).toBe(1);
    expect(handovers[0]).toEqual({
      order_ids: CANCELLED_ORDERS.map((order) => order.id),
      authorization_token: "auth-e2e",
    });
    expect(leaked).toEqual([]);
  });
});
