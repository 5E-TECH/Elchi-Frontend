import { expect, test } from "@playwright/test";
import { mockMailDeleteApi, openMailDetail } from "./support/mailDelete";

/** Pochta tafsiloti → savat (yokjwjXG) — 390px. */
test.describe("Pochtadan o'chirish — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("⭐ savat ≥ 44px; oyna pastdan chiqadi; sabab bilan o'chiriladi", async ({ page }) => {
    const { deletes, leaked } = await mockMailDeleteApi(page);
    await openMailDetail(page);

    const remove = page.getByRole("button", { name: "№1251 ni pochtadan o'chirish" }).locator("visible=true").first();
    const removeBox = (await remove.boundingBox())!;
    expect(removeBox.height).toBeGreaterThanOrEqual(44);
    expect(removeBox.width).toBeGreaterThanOrEqual(44);
    await remove.click();

    const dialog = page.getByRole("alertdialog");
    const box = (await dialog.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(Math.abs(box.y + box.height - viewport.height)).toBeLessThanOrEqual(1);
    for (const name of ["Bekor qilish", "Ha, o'chirish"]) {
      expect((await dialog.getByRole("button", { name }).boundingBox())!.height, name).toBeGreaterThanOrEqual(44);
    }
    const fontSize = await dialog.getByLabel(/^Sabab/).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(16);

    await dialog.getByLabel(/^Sabab/).fill("Market qaytarib oldi");
    await dialog.getByRole("button", { name: "Ha, o'chirish" }).click();
    await expect(dialog).toHaveCount(0);
    expect(deletes.map((d) => d.body.order_ids)).toEqual([["1251"]]);
    expect(leaked).toEqual([]);
  });
});
