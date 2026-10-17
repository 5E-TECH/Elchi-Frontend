import { expect, test } from "@playwright/test";
import { BRANCHES, mockRankingsApi, openDashboard, rankingCard, shortRange } from "./support/dashboardRankings";

/**
 * Dashboard reytinglari (9zbSDkUI) — 1440px, maket `superadmin-dashboard-main`, `manager-branch-dashboard-main`.
 * Soxta backend: «Bugun» — reyting oxirgi 30 kun bo'yicha, 2+ kunlik davr — tanlangan oraliq.
 */
test.describe("Dashboard reytinglari — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 }, timezoneId: "Asia/Tashkent" });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ TC1+TC3: «Bugun» — Top marketlar to'la, izohda «· oxirgi 30 kun»; davr o'zgarsa — tanlangan sanalar", async ({ page }) => {
    const { leaked, dashboardParams } = await mockRankingsApi(page, { topBranches: BRANCHES.slice(0, 5) });
    await openDashboard(page);

    const markets = rankingCard(page, "markets");
    await expect(markets.getByRole("heading", { name: "Top marketlar" })).toBeVisible();
    await expect(markets.getByText("Sotuv foizi · sotilgan / jami · oxirgi 30 kun")).toBeVisible();
    await expect(markets.getByRole("listitem").filter({ visible: true })).toHaveCount(5);
    await expect(markets.getByText("Baraka Shop")).toBeVisible();
    await expect(rankingCard(page, "branches").getByText("Sotuv foizi · sotilgan / jami · oxirgi 30 kun")).toBeVisible();

    // 8 ta market: 5 ko'rinadi, «Yana ko'rsatish · 3 ta» qolganini ochadi.
    await markets.getByRole("button", { name: "Yana ko'rsatish · 3 ta" }).click();
    await expect(markets.getByRole("listitem").filter({ visible: true })).toHaveCount(8);
    await markets.getByRole("button", { name: "Kamroq ko'rsatish" }).click();
    await expect(markets.getByRole("listitem").filter({ visible: true })).toHaveCount(5);

    await page.getByRole("radio", { name: "Bu hafta" }).click();
    await expect.poll(() => dashboardParams.length).toBeGreaterThan(1);
    const { start_day: from, end_day: to } = dashboardParams[dashboardParams.length - 1];
    const expected = from === to ? "oxirgi 30 kun" : shortRange(from, to);
    await expect(markets.getByText(`Sotuv foizi · sotilgan / jami · ${expected}`)).toBeVisible();
    expect(leaked).toEqual([]);
  });

  test("⭐ TC4: bo'sh «Top filiallar» — ixcham v2 bo'sh holat (≤ 120px), karta cho'zilmaydi, «30 buyurtma» matni yo'q", async ({ page }) => {
    await mockRankingsApi(page, { topBranches: [] });
    await openDashboard(page);

    const branches = rankingCard(page, "branches");
    const empty = branches.locator('[data-state-size="inline"]');
    await expect(empty).toHaveText("Bu davrda reyting uchun buyurtma yo'q");
    const emptyBox = (await empty.boundingBox())!;
    expect(emptyBox.height).toBeLessThanOrEqual(120);

    // Qo'shni karta to'la bo'lsa ham bo'sh karta uning bo'yiga cho'zilmaydi (avval 300px edi).
    const branchesBox = (await branches.boundingBox())!;
    const marketsBox = (await rankingCard(page, "markets").boundingBox())!;
    expect(branchesBox.height).toBeLessThan(200);
    expect(branchesBox.height).toBeLessThan(marketsBox.height);
    await expect(page.getByText(/kamida 30 buyurtma/)).toHaveCount(0);
  });

  test("«Kam ma'lumot» (tizim-charts): 30 dan kam buyurtmali filial bor — reyting va eslatma", async ({ page }) => {
    await mockRankingsApi(page, { topBranches: BRANCHES.slice(0, 5) });
    await openDashboard(page);
    const branches = rankingCard(page, "branches");
    await expect(branches.getByRole("listitem")).toHaveCount(5);
    await expect(branches.getByText("Ma'lumot hali kam — reyting natijalari o'zgarishi mumkin")).toBeVisible();
    await expect(rankingCard(page, "markets").getByText(/Ma'lumot hali kam/)).toHaveCount(0);
  });

  test("menejer: o'z filiali 6-o'rinda — ro'yxat ostida alohida, «Sizning filial» (`manager-branch-dashboard-main`)", async ({ page }) => {
    const { leaked } = await mockRankingsApi(page, { role: "manager", topBranches: BRANCHES });
    await openDashboard(page, "/branch-dashboard");

    const branches = rankingCard(page, "branches");
    await expect(branches.getByText("Sotuv foizi · top 5 va sizning filial · oxirgi 30 kun")).toBeVisible();
    await expect(branches.getByRole("list", { name: "Top filiallar" }).getByRole("listitem")).toHaveCount(5);
    const own = branches.getByRole("list", { name: "Sizning filialingiz o'rni" });
    await expect(own).toContainText("Urgut filiali");
    await expect(own).toContainText("Sizning filial");
    await expect(own).toContainText("58 / 86 ta");

    // «Barchasi» (filtr 1970-01-01 dan): izohda «01.01.1970 – …» yozilmaydi.
    await page.getByRole("radio", { name: "Barchasi" }).click();
    await expect(branches.getByText("Sotuv foizi · top 5 va sizning filial", { exact: true })).toBeVisible();
    await expect(branches.getByText(/1970/)).toHaveCount(0);
    expect(leaked).toEqual([]);
  });
});
