import { expect, test } from "@playwright/test";
import { mockRankingsApi, openDashboard, rankingCard } from "./support/dashboardRankings";

/** Dashboard reytinglari (9zbSDkUI) — 390px, maket `superadmin-dashboard-main` (telefon), taxta `tizim-charts`. */
test.describe("Dashboard reytinglari — 390px", () => {
  test.use({ timezoneId: "Asia/Tashkent" });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ TC6: ikki karta ustma-ust, bo'sh joy va gorizontal skroll yo'q; telefonda 3 qator + «Yana ko'rsatish»", async ({ page }) => {
    const { leaked } = await mockRankingsApi(page, { topBranches: [] });
    await openDashboard(page);

    const markets = rankingCard(page, "markets");
    const branches = rankingCard(page, "branches");
    await branches.scrollIntoViewIfNeeded();
    const m = (await markets.boundingBox())!;
    const b = (await branches.boundingBox())!;
    expect(Math.round(b.x)).toBe(Math.round(m.x));
    expect(Math.round(b.width)).toBe(Math.round(m.width));
    // Ustma-ust, oraliq 16px — ortiqcha bo'sh joy yo'q.
    expect(b.y - (m.y + m.height)).toBeGreaterThanOrEqual(12);
    expect(b.y - (m.y + m.height)).toBeLessThanOrEqual(20);
    expect(b.height).toBeLessThan(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await expect(markets.getByRole("listitem").filter({ visible: true })).toHaveCount(3);
    const more = markets.getByRole("button", { name: "Yana ko'rsatish · 5 ta" });
    expect((await more.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await more.click();
    await expect(markets.getByRole("listitem").filter({ visible: true })).toHaveCount(8);
    expect(leaked).toEqual([]);
  });
});
