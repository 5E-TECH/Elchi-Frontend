import { expect, test } from "@playwright/test";
import { cameraDialog, enterManually, mockNewOrdersCameraApi, openMarket, OTHER_TOKEN, OWN_TOKEN } from "./support/newOrdersCamera";

/**
 * 390px: `/new-orders/:marketId` — markaziy «Skaner» tugmasi kamerani SHU sahifa ustida ochadi (ega 2026-10-19).
 * Skan (qo'lda kiritish orqali) = darhol qabul; boshqa marketning kodi rad etiladi (qabul so'rovi yo'q);
 * kamera ichida market almashtirilsa — boshqa sahifa, kamera ochiq.
 */
// Soxta kamera (ruxsat berilgan): kamera faol holatda ochiladi — hisoblagich va natija xabari ko'rinadi.
test.use({
  permissions: ["camera"],
  launchOptions: {
    args: [
      "--host-resolver-rules=MAP api.elchipochta.uz ~NOTFOUND",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
});

test.describe("Market yangi buyurtmalari — kamera, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("markaziy tugma → kamera → kod: qabul; boshqa market — rad; market almashtirish — kamera ochiq", async ({ page }) => {
    const { leaked, received } = await mockNewOrdersCameraApi(page);
    await openMarket(page);

    await page.getByRole("link", { name: "Skaner — Qabul qilish" }).click();
    const dialog = cameraDialog(page);
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/new-orders\/121$/);
    await expect(dialog.getByText("Ipak Yo'li Savdo · 2 ta buyurtma")).toBeVisible();

    // O'z marketining buyurtmasi — darhol qabul.
    await enterManually(page, OWN_TOKEN);
    await expect.poll(() => received).toEqual([["10254"]]);
    await expect(dialog.getByText("Qabul qilindi №10254")).toBeVisible();

    // Boshqa marketniki — server tekshiruvi, rad: qabul so'rovi yo'q.
    await enterManually(page, OTHER_TOKEN);
    await expect(dialog.getByText("Boshqa market: Baraka Shop — qabul qilinmadi")).toBeVisible();
    expect(received).toEqual([["10254"]]);

    // Kamera ichida market almashtirish — /new-orders/122, kamera ochiq.
    await dialog.getByRole("button", { name: "Ipak Yo'li Savdo — almashtirish" }).click();
    const sheet = page.getByRole("dialog", { name: "Marketni tanlang" });
    await sheet.getByRole("button", { name: /Baraka Shop/ }).click();
    await expect(page).toHaveURL(/\/new-orders\/122$/);
    await expect(cameraDialog(page)).toBeVisible();
    await expect(cameraDialog(page).getByText("Baraka Shop · 1 ta buyurtma")).toBeVisible();

    await enterManually(page, OTHER_TOKEN);
    await expect.poll(() => received).toEqual([["10254"], ["10327"]]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
