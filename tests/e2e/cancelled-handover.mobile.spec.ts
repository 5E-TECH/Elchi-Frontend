import { expect, test } from "@playwright/test";
import { MARKET_QR, mockCancelledApi, openHandover, usbScan } from "./support/cancelledHandover";

/**
 * Bekor qilinganlarni marketga topshirish — 390px: kartalar, «QR buzilganini tasdiqlash» pastki varaqasi
 * (sabab — backend enum kodi), market QR bilan jo'natish; gorizontal skroll yo'q.
 */
test.describe("Bekor qilinganlar — telefon, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("QR buzilgan buyurtma qo'lda tasdiqlanadi, market QR bilan jo'natiladi (sabab — enum kodi)", async ({ page }) => {
    const { leaked, handovers } = await mockCancelledApi(page);
    await openHandover(page);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByRole("button", { name: "QR buzilgan" }).first().click();
    const sheet = page.getByRole("dialog", { name: "QR buzilganini tasdiqlash" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("radio", { name: "Yorliq yo'qolgan" }).check();
    await sheet.getByRole("button", { name: "Qo'lda tasdiqlash" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText("Qo'lda tasdiqlangan")).toBeVisible();
    // Market QR'siz hali jo'natib bo'lmaydi.
    await expect(page.getByRole("button", { name: "Marketga jo'natish — 1 ta" })).toBeDisabled();

    await usbScan(page, MARKET_QR);
    await expect(page.getByText("Market QR skanerlandi")).toBeVisible();

    await page.getByRole("button", { name: "Marketga jo'natish — 3 ta" }).click();
    await expect.poll(() => handovers.length).toBe(1);
    expect(handovers[0]).toEqual(
      expect.objectContaining({
        authorization_token: "auth-e2e",
        manual_overrides: [{ order_id: "10235", reason: "Label yo'qolgan" }],
      }),
    );
    expect(leaked).toEqual([]);
  });
});
