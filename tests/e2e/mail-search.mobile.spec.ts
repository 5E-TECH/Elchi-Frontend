import { expect, test } from "@playwright/test";
import { mockMailSearchApi, openMailSearch } from "./support/mailSearch";

/** Pochta tafsiloti → qidiruv va takroriy telefonlar (MD-1) — 390px. */
test.describe("Pochta ichida qidiruv — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("⭐ maydon va chiplar ≥ 44px, maydon shrifti 16px, gorizontal skroll yo'q, kartada «Takroriy raqam»", async ({ page }) => {
    await mockMailSearchApi(page);
    await openMailSearch(page);
    await expect(page.getByRole("table")).toHaveCount(0);

    const search = page.getByRole("searchbox", { name: "Pochtadagi buyurtmalarni qidirish" });
    const box = (await search.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(40);
    const field = (await search.evaluate((el) => el.parentElement!.getBoundingClientRect().height));
    expect(field).toBeGreaterThanOrEqual(44);
    expect(await search.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);

    const chips = page.getByTestId("mail-duplicate-phones").getByRole("button");
    await expect(chips).toHaveCount(2);
    for (const chip of await chips.all()) {
      expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByText("Takroriy raqam")).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    // Chiplar raqam tartibida (maket): birinchisi «+998 90 233 51 79».
    await chips.first().click();
    await expect(page).toHaveURL(/\?q=%2B998\+90\+233\+51\+79$/);
    await expect(page.getByRole("checkbox", { name: /^№\d+ ni tanlash$/ })).toHaveCount(2);

    await search.fill("Dilshod");
    const clear = page.getByRole("button", { name: "Qidiruvni tozalash" }).last();
    expect((await clear.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await clear.click();
    await expect(page.getByRole("checkbox", { name: /^№\d+ ni tanlash$/ })).toHaveCount(9);
  });
});
