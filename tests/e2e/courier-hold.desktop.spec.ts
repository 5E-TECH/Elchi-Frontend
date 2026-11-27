import { expect, test } from "@playwright/test";
import { mockCourierHold } from "./support/courierHold";

/**
 * «KURYERDAGI BUYURTMALAR», 1440px (onXzDc5n): yon menyudan ochiladi; «72 soatdan oshgan» → «48 soatga yaqin» →
 * «Kuryerlar bo'yicha» (kuryer tanlansa — uning hamma ochiq buyurtmalari); /orders dagi «Kuryerda turgan vaqti» filtri.
 */
test.describe("Kuryerdagi buyurtmalar — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ superadmin: menyudan ochiladi, uchta ro'yxat va kuryer tanlovi", async ({ page }) => {
    const { leaked, listQueries } = await mockCourierHold(page);
    await page.goto("/");

    await page.getByRole("link", { name: "Kuryerdagi buyurtmalar" }).first().click({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/courier-hold$/);

    const list = page.getByRole("table", { name: "Kuryerdagi buyurtmalar ro'yxati" });
    await expect(list.getByRole("row")).toHaveCount(3); // sarlavha + 98 va 80 soatlik
    await expect(list.getByRole("row").nth(1)).toContainText("98 soat");
    await expect.poll(() => listQueries.at(-1)?.get("courier_hold")).toBe("over_72");
    const tabs = page.getByRole("tablist", { name: "Ro'yxat turi" });
    await expect(tabs.getByRole("tab", { name: /72 soatdan oshgan\s*2/ })).toBeVisible();

    await tabs.getByRole("tab", { name: /48 soatga yaqin/ }).click();
    await expect.poll(() => listQueries.at(-1)?.get("courier_hold")).toBe("near_48");
    await expect(list.getByRole("row")).toHaveCount(2);
    await expect(list.getByRole("row").nth(1)).toContainText("40 soat");

    await tabs.getByRole("tab", { name: /Kuryerlar bo'yicha/ }).click();
    const summary = page.getByRole("table", { name: "Kuryerlar bo'yicha jamlama" });
    const bobur = summary.getByRole("row").filter({ hasText: "Bobur Aliyevich Abdurahmonov" });
    await expect(bobur).toContainText("80 soat");
    await bobur.getByRole("button", { name: /buyurtmalarini ochish/ }).click();

    await expect.poll(() => listQueries.at(-1)?.get("courier_id")).toBe("27");
    expect(listQueries.at(-1)?.get("courier_hold")).toBe("any");
    await expect(list.getByRole("row")).toHaveCount(3);
    await expect(page.getByTestId("courier-hold-courier")).toContainText("Kuryer: Bobur Aliyevich Abdurahmonov");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });

  test("⭐ /orders: «Kuryerda turgan vaqti» — «72 soatdan oshgan» so'rovga `courier_hold=over_72` bo'lib ketadi", async ({ page }) => {
    const { listQueries } = await mockCourierHold(page);
    await page.goto("/courier-hold");
    await page.getByRole("link", { name: "Buyurtmalar ro'yxatida ochish" }).click({ timeout: 60_000 });

    await expect(page).toHaveURL(/\/orders\?courier_hold=over_72$/);
    await expect.poll(() => listQueries.at(-1)?.get("courier_hold")).toBe("over_72");
    // Faol filtr — chip bilan (olib tashlansa so'rovdan ham ketadi).
    const chip = page.getByRole("button", { name: /Kuryerda turgan vaqti/ }).last();
    await expect(chip).toBeVisible();
    await chip.click();
    await expect.poll(() => listQueries.at(-1)?.has("courier_hold")).toBe(false);
  });
});
