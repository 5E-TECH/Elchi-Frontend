import { expect, test } from "@playwright/test";
import { openTopImpactsWithActors, TOP_IMPACT_ACTORS } from "./support/balanceTopImpactsActor";

/**
 * guzrGySp — Balans → Tahlil: «Kiritgan» ustuni top-impacts javobidagi `created_by_user.name` dan (avval `#id`).
 * Foydalanuvchi topilmasa — `#id`, tizim yozuvi — «Avtomatik». 1440px — jadval.
 */
test.describe("Balans → Tahlil: «Kiritgan» ustuni (guzrGySp) — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.describe.configure({ timeout: 120_000 });

  test("«Kiritgan» — ism, `#id` va «Avtomatik»", async ({ page }) => {
    const { leaked } = await openTopImpactsWithActors(page);

    const table = page.getByRole("table", { name: "Eng katta ta'sir ko'rsatgan tranzaksiyalar" });
    await expect(table.getByRole("cell", { name: "Dilnoza Karimova", exact: true })).toBeVisible({
      timeout: 90_000,
    });
    const headers = await table.getByRole("columnheader").allTextContents();
    const actorColumn = headers.indexOf("Kiritgan");
    expect(actorColumn).toBeGreaterThan(-1);

    const actors = await table
      .locator("tbody tr")
      .evaluateAll(
        (rows, column) =>
          rows.map((row) => row.querySelectorAll("td")[column]?.textContent?.trim()),
        actorColumn,
      );
    expect(actors).toEqual([...TOP_IMPACT_ACTORS]);
    expect(leaked).toEqual([]);
  });
});
