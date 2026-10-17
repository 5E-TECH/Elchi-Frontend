import { expect, test } from "@playwright/test";
import { mockMailDeleteApi, openMailDetail } from "./support/mailDelete";

/** Pochta tafsiloti → savat (yokjwjXG) — 390px. */
test.describe("Pochtadan o'chirish — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("⭐ savat ≥ 44px; oyna pastdan chiqadi; sabab bilan o'chiriladi", async ({ page }) => {
    const { deletes, leaked } = await mockMailDeleteApi(page);
    await openMailDetail(page);

    // Dizayn v2: telefonda jadval o'rniga kartalar, gorizontal skroll yo'q, chop etish ham ≥ 44px.
    await expect(page.getByRole("table")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    const print = page.getByRole("button", { name: "№1251 ni chop etish" });
    const printBox = (await print.boundingBox())!;
    expect(Math.min(printBox.width, printBox.height)).toBeGreaterThanOrEqual(44);

    const remove = page.getByRole("button", { name: "№1251 ni pochtadan o'chirish" }).locator("visible=true").first();
    const removeBox = (await remove.boundingBox())!;
    expect(removeBox.height).toBeGreaterThanOrEqual(44);
    expect(removeBox.width).toBeGreaterThanOrEqual(44);
    await remove.click();

    const dialog = page.getByRole("alertdialog");
    const viewport = page.viewportSize()!;
    // Dizayn v2 `Dialog` varaqasi pastdan siljib chiqadi (250 ms) — joyiga tushgach o'lchanadi.
    await expect
      .poll(async () => {
        const settling = await dialog.boundingBox();
        return settling ? Math.abs(settling.y + settling.height - viewport.height) : Infinity;
      })
      .toBeLessThanOrEqual(1);
    const box = (await dialog.boundingBox())!;
    expect(Math.abs(box.y + box.height - viewport.height)).toBeLessThanOrEqual(1);
    expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);
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
