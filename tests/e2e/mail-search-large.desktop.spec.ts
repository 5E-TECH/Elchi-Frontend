import { expect, test } from "@playwright/test";
import { mockMailSearchApi, openMailSearch } from "./support/mailSearch";

/**
 * TOZ-0 — pochta tafsilotida qidiruv, katta pochta (Trello mSix70Ca «c2b54a»): 150 qatorli pochtada qidiruv
 * harfma-harf yozilganda chizilgan qatorlar soni kamayadi, tanlangan checkboxlar yo'qolmaydi — qidiruvda yashirin
 * qolganlari ham tanlovda turadi, tozalanganda yana belgilangan holda ko'rinadi.
 */
test.describe("Pochta ichida qidiruv — 150 qatorli pochta (desktop)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("qidiruv yozilganda qatorlar kamayadi, tanlov saqlanadi", async ({ page }) => {
    const { orders, leaked } = await mockMailSearchApi(page, { extraRows: 141 });
    expect(orders).toHaveLength(150);
    await openMailSearch(page);
    const search = page.getByRole("searchbox", { name: "Pochtadagi buyurtmalarni qidirish" });
    const table = page.getByRole("table", { name: "Pochtadagi buyurtmalar" });
    const region = page.getByRole("region", { name: "Tanlangan buyurtmalar" });
    const rowBoxes = table.getByRole("checkbox", { name: /^№\d+ ni tanlash$/ });
    const box = (id: string) => table.getByRole("checkbox", { name: `№${id} ni tanlash` });

    await expect(rowBoxes).toHaveCount(150, { timeout: 30_000 });

    // Uch tanlov: biri qidiruvdan keyin ham ko'rinadi (10207 «Laylo»), ikkitasi yashirinadi.
    await box("10212").check();
    await box("10207").check();
    await box("20100").check();
    await expect(region).toContainText("3 ta buyurtma tanlandi / 150 ta");

    await search.click();
    await search.pressSequentially("Laylo", { delay: 40 });
    await expect(search).toHaveValue("Laylo");
    await expect(rowBoxes).toHaveCount(2);
    await expect(page.getByText("2 ta ko'rsatilmoqda · 150 tadan")).toBeVisible();
    await expect(box("10207")).toBeChecked();
    await expect(box("10192")).not.toBeChecked();
    await expect(region).toContainText("3 ta buyurtma tanlandi / 150 ta");
    await expect(region).toContainText("2 tasi qidiruvda yashirin, lekin tanlangan qoladi");
    await expect(page.getByRole("button", { name: "Pochtani jo'natish — 3 ta" })).toBeEnabled();

    // Qidiruv tozalanganda hammasi qaytadi — yashirin tanlanganlar belgilangan holda.
    await page.getByRole("button", { name: "Qidiruvni tozalash" }).last().click();
    await expect(rowBoxes).toHaveCount(150);
    await expect(box("10212")).toBeChecked();
    await expect(box("10207")).toBeChecked();
    await expect(box("20100")).toBeChecked();
    await expect(region).toContainText("3 ta buyurtma tanlandi / 150 ta");
    expect(leaked).toEqual([]);
  });
});
