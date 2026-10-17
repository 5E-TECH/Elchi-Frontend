import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, mockBatchesApi, openBatches } from "./support/batches";

/** Paketlar — menejer (HQ), 390px: kartalar, gorizontal aylanish yo'q, karta ostidagi «HQ'ga yuborish». */
test.describe("Paketlar — telefon, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("⭐ ro'yxat kartalari → tafsilot → pastdagi tugma bilan yuborish", async ({ page }) => {
    const { leaked, sends } = await mockBatchesApi(page);
    await openBatches(page);
    await expectNoHorizontalScroll(page);

    const card = page.getByRole("link", { name: "B-172 paketini ochish" });
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await card.click();

    await expect(page.getByRole("heading", { level: 1, name: "Paket B-172" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    // Telefonda sarlavhadagi asosiy tugma yashirin — yagona ko'rinadigani buyurtmalar kartasi ostida (to'liq enli).
    const orders = page.getByRole("region", { name: "Paketdagi buyurtmalar" });
    await expect(page.getByRole("button", { name: "HQ'ga yuborish — 0 ta" })).toHaveCount(1);
    const send = orders.getByRole("button", { name: "HQ'ga yuborish — 0 ta" });
    await expect(send).toBeVisible();
    await expect(send).toBeDisabled();
    expect((await send.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    await orders.getByRole("checkbox", { name: "№10165 ni tanlash" }).check();
    await orders.getByRole("button", { name: "HQ'ga yuborish — 1 ta" }).click();
    await expect(page.getByText("Paket HQ'ga yuborildi", { exact: true })).toBeVisible();
    expect(sends.map((entry) => entry.body)).toEqual([{ orderIds: ["10165"] }]);
    expect(leaked).toEqual([]);
  });

  test("qaytarishlar 390px ichida", async ({ page }) => {
    const { leaked } = await mockBatchesApi(page);
    await page.goto("/returns");
    await expect(page.getByRole("heading", { level: 1, name: "Qaytarishlar" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("link", { name: "B-171 paketini ochish" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    expect(leaked).toEqual([]);
  });
});
