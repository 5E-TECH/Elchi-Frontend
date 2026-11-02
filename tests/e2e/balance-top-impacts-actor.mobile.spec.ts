import { expect, test } from "@playwright/test";
import { openTopImpactsWithActors, TOP_IMPACT_ACTORS } from "./support/balanceTopImpactsActor";

/**
 * guzrGySp — Balans → Tahlil, telefon (390px): jadval kartalarga aylanadi, har kartaning ikkinchi qatorida
 * «<kiritgan> · <sana>» — ism `created_by_user.name` dan, topilmasa `#id`, tizim yozuvi — «Avtomatik».
 */
test.describe("Balans → Tahlil: «Kiritgan» kartada (guzrGySp) — 390px", () => {
  test.describe.configure({ timeout: 120_000 });

  test("kartalarda ism, `#id` va «Avtomatik»; gorizontal skroll yo'q", async ({ page }) => {
    const { leaked } = await openTopImpactsWithActors(page);

    for (const actor of TOP_IMPACT_ACTORS) {
      await expect(page.getByText(new RegExp(`^${actor} ·`))).toBeVisible({ timeout: 90_000 });
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(leaked).toEqual([]);
  });
});
