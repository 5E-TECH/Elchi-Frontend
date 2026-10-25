import { expect, test } from "@playwright/test";
import { FACTORY_EAN, mockBarcodeCamera } from "./support/barcodeCamera";
import { mockProductsApi } from "./support/products";
import { expectNoHorizontalScroll, FAKE_CAMERA } from "./support/scannerCamera";

/**
 * 390px: mahsulotni tahrirlash — «Shtrix kod» maydoni yonidagi «Kamera» (Trello CO66kcoB). Oyna ochiq turganda
 * markaziy «Skaner» bosilmaydi (ilova `inert`), shuning uchun kamera maydon yonidan ochiladi. Kadrdagi EAN-13
 * (soxta kamera, haqiqiy o'qish) maydonga yoziladi, kamera o'zi yopiladi, «Saqlash» — `barcode` FormData'da.
 */
test.use(FAKE_CAMERA);

test("tahrirlash oynasi: «Kamera» (44 px) → keng ramka → EAN-13 maydonga yoziladi → saqlanadi", async ({ page }) => {
  test.setTimeout(90_000);
  await mockBarcodeCamera(page, FACTORY_EAN);
  const { patches } = await mockProductsApi(page, "superadmin");
  await page.goto("/products");
  await page.getByRole("button", { name: "Mahsulot 01 — tahrirlash" }).first().click({ timeout: 60_000 });
  const dialog = page.getByRole("dialog", { name: "Mahsulotni tahrirlash" });
  const field = dialog.getByRole("textbox", { name: "Shtrix kod (EAN-13)" });
  await expect(field).toHaveValue("");

  const camera = dialog.getByRole("button", { name: "Shtrix kodni kamera bilan skanerlash" });
  await camera.scrollIntoViewIfNeeded();
  const box = (await camera.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  await expectNoHorizontalScroll(page);

  await camera.click();
  await expect(page.locator('[data-finder-shape="wide"]')).toBeVisible();
  await expect(page.getByText("Zavod qutisidagi shtrix kodni ramka ichiga oling")).toBeVisible();
  // Bitta qiymat: kod o'qilgach kamera o'zi yopiladi, kod maydonda.
  await expect(field).toHaveValue(FACTORY_EAN, { timeout: 20_000 });
  await expect(page.locator("[data-finder-shape]")).toHaveCount(0);

  await dialog.getByRole("button", { name: "Saqlash" }).click();
  await expect.poll(() => patches.length).toBe(1);
  expect(patches[0].body).toContain(FACTORY_EAN);
});
