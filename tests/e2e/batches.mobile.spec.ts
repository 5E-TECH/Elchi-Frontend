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

  test("qaytarishlar 390px ichida: 2 filtr qatorda (varaqa tugmasi yo'q), «Sana» — pastki varaqa", async ({ page }) => {
    const { leaked, listQueries } = await mockBatchesApi(page);
    await page.goto("/returns");
    await expect(page.getByRole("heading", { level: 1, name: "Qaytarishlar" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("link", { name: "B-171 paketini ochish" })).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Maket `manager-returns-list` (telefon): «Holat» va «Sana» to'liq enli, 44 px; «Filtrlar» tugmasi yo'q.
    const filters = page.getByRole("group", { name: "Filtrlar" });
    const status = filters.getByRole("combobox", { name: "Holat" });
    const date = filters.getByRole("button", { name: /^Sana / });
    await expect(status).toBeVisible();
    await expect(date).toContainText("Barchasi");
    expect((await status.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await date.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("button", { name: "Filtrlar", exact: true })).toHaveCount(0);

    await date.click();
    const sheet = page.getByRole("dialog", { name: "Sanani tanlash" });
    await expect(sheet).toHaveAttribute("aria-modal", "true");
    await sheet.getByRole("button", { name: "Bugun" }).click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/\/returns\?(.*&)?period=today(&|$)/);
    await expect.poll(() => listQueries.at(-1)).toContain("period=today");
    await expect(date).toContainText("Bugun");
    await expectNoHorizontalScroll(page);
    expect(leaked).toEqual([]);
  });
});
