import { expect, test } from "@playwright/test";
import { mainHorizontalOverflow } from "./support/integrations";
import { CONSOLE_LOG, mockPartnerJournal } from "./support/partnerJournal";

/** «HODISALAR» — UMUMIY WEBHOOK JURNALI, 390px (Dj70iDbD): kartalar, tugmalar ≥ 44px, gorizontal skroll yo'q. */

test.describe("Umumiy webhook jurnali — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("⭐ kartada hamkor nomi, ma'lumot ochiladi, filtr va tugmalar ≥ 44px", async ({ page }) => {
    const { journal, leaked } = await mockPartnerJournal(page);
    await page.goto(CONSOLE_LOG);

    const filter = page.getByRole("combobox", { name: "Hamkor bo'yicha filtr" });
    await filter.click({ timeout: 60_000 });
    await page.getByRole("option", { name: "Barcha hamkorlar" }).click();
    await expect.poll(() => journal.at(-1)?.has("partner_id")).toBe(false);

    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByText(/Baraka Shop · №103/)).toBeVisible();
    expect((await filter.boundingBox())?.height).toBeGreaterThanOrEqual(44);

    const toggle = page.getByRole("button", { name: "Ma'lumot" }).first();
    expect((await toggle.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await toggle.click();
    await expect(page.locator("#partner-payload-1")).toContainText('"external_order_id": "EX-1"');

    expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
