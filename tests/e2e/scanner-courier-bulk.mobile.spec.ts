import { expect, test } from "@playwright/test";
import { BULK_CANCEL_COMMENT, BULK_SOLD_COMMENT, mockCourierBulkApi, openCourierBulk } from "./support/floor";
import { enterCode, expectNoHorizontalScroll, FAKE_CAMERA, openScannerFromBottomNav } from "./support/scannerCamera";

/**
 * 390px: `/courier-bulk` — markaziy «Skaner» kamerani shu sahifa ustida ochadi (sahifada «Kamera bilan
 * skanerlash» yo'q). Kamera ichida «Bekor / Ertaga» rejimi; «Ro'yxat» — «Skanerlanganlar · 2 / 3 · …»;
 * «Tugatish» — kamera yopiladi, yakunlash sahifadagi «Kunni yakunlash» (tasdiq) bilan.
 */
test.use(FAKE_CAMERA);

test.describe("Tezkor amal — kamera rejimlari, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("Bekor / Ertaga kamera ichida, ro'yxat varag'i, «Tugatish» → «Kunni yakunlash»", async ({ page }) => {
    const api = await mockCourierBulkApi(page);
    await openCourierBulk(page);
    await expect(page.getByRole("button", { name: /Kamera/ })).toHaveCount(0);

    const camera = await openScannerFromBottomNav(page, "Kunni yakunlash");
    await expect(camera.getByText("3 ta kutilayotgan buyurtma")).toBeVisible();
    await expect(camera.getByRole("radio", { name: "Bekor" })).toHaveAttribute("aria-checked", "true");

    await enterCode(page, camera, "tok-10401");
    await expect(camera.getByText("Bekor qilishga belgilandi №10401 · Feruza Mirzayeva")).toBeVisible();

    await camera.getByRole("radio", { name: "Ertaga" }).click();
    await enterCode(page, camera, "tok-10402");
    await expect(camera.getByText("Ertaga qoldirishga belgilandi №10402 · Ali Valiyev")).toBeVisible();

    await camera.getByRole("button", { name: "Ro'yxat" }).click();
    const sheet = page.getByRole("dialog", { name: "Skanerlanganlar" });
    await expect(sheet.getByText("2 / 3 · 1 ta bekor, 1 ta ertaga")).toBeVisible();
    await expect(sheet.getByText("Skanerlanmagan 1 ta buyurtma sotilgan deb belgilanadi.")).toBeVisible();
    await sheet.getByRole("button", { name: "Tugatish" }).click();
    await expect(camera).toBeHidden();

    // Sahifadagi rejim ham kamera bilan bitta holat; qatorlarda belgilar.
    const row = (name: string, option: string) =>
      page.getByRole("radiogroup", { name: `${name}: natija` }).getByRole("radio", { name: option });
    await expect(row("Feruza Mirzayeva", "Bekor")).toHaveAttribute("aria-checked", "true");
    await expect(row("Ali Valiyev", "Ertaga")).toHaveAttribute("aria-checked", "true");

    await page.getByRole("button", { name: "Kunni yakunlash", exact: true }).click();
    const confirm = page.getByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" });
    await confirm.getByRole("button", { name: "Tasdiqlash" }).click();
    await expect.poll(() => api.requests.length).toBe(2);
    expect(api.cancels).toEqual([{ id: "10401", body: expect.objectContaining({ comment: BULK_CANCEL_COMMENT }) }]);
    expect(api.sells).toEqual([{ id: "10403", body: expect.objectContaining({ comment: BULK_SOLD_COMMENT }) }]);
    await expectNoHorizontalScroll(page);
    expect(api.leaked).toEqual([]);
  });
});
