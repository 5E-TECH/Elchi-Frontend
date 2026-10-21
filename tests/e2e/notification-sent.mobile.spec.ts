import { expect, test } from "@playwright/test";
import { mockSentApi, noHorizontalScroll, shot } from "./support/notificationSent";

/**
 * NS-2 — «Yuborilganlar» telefonda (390px): kartalar, «Filtrlar» pastki varaqasi, tafsilot — pastki varaqa,
 * 44px nishonlar, gorizontal skrollsiz.
 */
test.describe("Yuborilganlar — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`kartalar, «Filtrlar» varaqasi va tafsilot (${theme})`, async ({ page }) => {
      const mock = await mockSentApi(page, { theme });
      await page.goto("/notifications/sent");

      const list = page.getByRole("list", { name: "Yuborilgan xabarlar" });
      await expect(list.getByRole("listitem")).toHaveCount(10, { timeout: 60_000 });
      await expect(page.getByRole("table")).toHaveCount(0);
      const partial = list.getByRole("listitem").filter({ hasText: "Ertaga qabul punkti" });
      await expect(partial).toContainText("Kimga: — · 148 ta qabul qiluvchi");
      await expect(partial).toContainText("Darhol, Telegram, SMS · Shodiyor Ergashev");
      // Telefonda desktop filtrlari yo'q — «Filtrlar» tugmasi.
      await expect(page.getByRole("combobox", { name: "Natija" })).toHaveCount(0);
      const filtersButton = page.getByRole("button", { name: "Filtrlar" });
      expect((await filtersButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      const send = page.getByRole("link", { name: "Xabar yuborish" });
      expect((await send.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      for (const box of await list.getByRole("button").evaluateAll((items) =>
        items.slice(0, 4).map((item) => item.getBoundingClientRect().height),
      )) {
        expect(box).toBeGreaterThanOrEqual(44);
      }
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `list-phone-${theme}`);

      await filtersButton.click();
      const sheet = page.getByRole("dialog", { name: "Filtrlar" });
      await sheet.getByRole("combobox", { name: "Natija" }).click();
      await page.getByRole("option", { name: "Qisman yuborildi" }).click();
      await shot(page, `filters-sheet-phone-${theme}`);
      await sheet.getByRole("button", { name: "Natijalarni ko'rsatish" }).click();
      await expect(sheet).toBeHidden();
      await expect(page).toHaveURL(/status=partial/);
      await expect(list.getByRole("listitem")).toHaveCount(1);
      await expect(page.getByRole("button", { name: /Filtrlar\s*1/ })).toBeVisible();

      await list.getByRole("button").first().click();
      const dialog = page.getByRole("dialog", { name: "Ertaga qabul punkti 10:00 dan ishlaydi" });
      await expect(dialog.getByText("Rol: Kuryer, Market")).toBeVisible();
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `detail-phone-${theme}`);
      expect(mock.leaked).toEqual([]);
    });
  }

  test("bo'sh holat telefonda — filtrlarsiz", async ({ page }) => {
    const mock = await mockSentApi(page);
    mock.emptyList = true;
    await page.goto("/notifications/sent");
    await expect(page.getByText("Hali xabar yuborilmagan")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Filtrlar" })).toHaveCount(0);
    expect(await noHorizontalScroll(page)).toBe(true);
    await shot(page, "empty-phone-light");
  });
});
