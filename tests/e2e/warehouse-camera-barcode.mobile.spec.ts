import { expect, test, type Page } from "@playwright/test";
import { BROKEN_EAN, FACTORY_EAN, mockBarcodeCamera, mockWarehouseCameraApi } from "./support/barcodeCamera";
import { expectNoHorizontalScroll, FAKE_CAMERA } from "./support/scannerCamera";

/**
 * 390px: ombor kirimi — telefon kamerasi zavod shtrix kodini (EAN-13) o'qiydi (Trello CO66kcoB, ega qarori
 * 2026-10-24). Kamera kadri soxta (kanvas oqimi), lekin o'qish haqiqiy: `qr-scanner` → keng ramka hududi → ZXing
 * (Linux Chromium'da `BarcodeDetector` yo'q) → nazorat raqami → `GET warehouses/3/lookup` → kirim qatori.
 */
test.use(FAKE_CAMERA);

const openStockInCamera = async (page: Page) => {
  await page.goto("/warehouses/3");
  // Sarlavhadagi asosiy amal (bo'sh qoldiq kartasida ham shu nomli tugma bor).
  await page.getByRole("button", { name: "Mahsulot qo'shish" }).first().click();
  const stockIn = page.getByRole("dialog", { name: "Omborga mahsulot qo'shish" }).first();
  await expect(stockIn).toBeVisible();
  await stockIn.getByRole("button", { name: "Kamera bilan skanerlash" }).click();
  // Kamera oynasi (sarlavhasi — oqim nomi), keng ramka: shtrix kod rejimi.
  const finder = page.locator('[data-finder-shape="wide"]');
  await expect(finder).toBeVisible();
  return { stockIn, finder };
};

test.describe("Ombor kirimi — kamera, zavod shtrix kodi (EAN-13), 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("kamera EAN-13 ni o'qiydi → lookup → «Quvvatlagich 20 W qo'shildi», kirim ro'yxatida qator", async ({ page }) => {
    await mockBarcodeCamera(page, FACTORY_EAN);
    const { leaked, lookups } = await mockWarehouseCameraApi(page);
    await openStockInCamera(page);

    await expect(page.getByText("Zavod shtrix kodi yoki QR stikerni (ELC-P-…) ramka ichiga oling.")).toBeVisible();
    await expect(page.getByText("Quvvatlagich 20 W qo'shildi").first()).toBeVisible({ timeout: 20_000 });
    expect(lookups[0]).toBe(FACTORY_EAN);
    await expectNoHorizontalScroll(page);

    // Kod kadrda turibdi — takror jim (har kadrda yangi qator emas).
    await page.waitForTimeout(2_500);
    expect(new Set(lookups)).toEqual(new Set([FACTORY_EAN]));

    await page.getByRole("button", { name: "Skanerni yopish" }).first().click();
    await expect(page.locator("[data-finder-shape]")).toHaveCount(0);
    const list = page.getByRole("list", { name: "Skanerlangan mahsulotlar" });
    await expect(list.getByText("Quvvatlagich 20 W")).toBeVisible();
    expect(leaked).toEqual([]);
  });

  test("nazorat raqami xato EAN-13 — kamera qabul qilmaydi (lookup yo'q)", async ({ page }) => {
    await mockBarcodeCamera(page, BROKEN_EAN);
    const { lookups } = await mockWarehouseCameraApi(page);
    await openStockInCamera(page);
    await expect(page.getByText("Skanerlash faol")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(4_000);
    expect(lookups).toEqual([]);
  });
});
