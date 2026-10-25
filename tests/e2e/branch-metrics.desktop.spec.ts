import { expect, test } from "@playwright/test";
import { healthyMetrics, METRICS_BRANCH, mockBranchMetricsApi, openBranchMetrics, shotBranchMetrics } from "./support/branchMetrics";

/**
 * 6CYRjoZG — `/branches/:id` «Filial ko'rsatkichlari» (maket `superadmin-branches-detail`), 1440px: bitta
 * `GET analytics/dashboard?branch_id=` so'rovidan KPI (delta + sparkline), muvaffaqiyat, kunlik daromad (recharts),
 * holatlar, kuryerlar reytingi; davr almashadi; xato / qisman nosozlik — «Qayta urinish».
 */
test.describe("Filial ko'rsatkichlari — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  test("maket tartibi: KPI, muvaffaqiyat + kunlik daromad, holatlar + reyting; davr «Bu oy»", async ({ page }) => {
    const mock = await mockBranchMetricsApi(page);
    const section = await openBranchMetrics(page);

    await expect(section.getByText(/^Bu hafta · .+ · Urgut filiali buyurtmalari$/)).toBeVisible();
    expect(mock.dashboardRequests[0].get("branch_id")).toBe(METRICS_BRANCH.id);
    expect(mock.dashboardRequests[0].get("start_day")).toBeTruthy();

    // KPI: 4 ta bir qatorda, delta va sparkline bilan.
    const kpis = section.locator("[data-kpi]");
    await expect(kpis).toHaveCount(4);
    await expect(kpis.nth(0)).toContainText("Qabul qilingan");
    await expect(kpis.nth(0)).toContainText("186 ta");
    await expect(kpis.nth(0)).toContainText("+3,9%");
    await expect(kpis.nth(2)).toContainText("26,4 mln so'm");
    await expect(section.locator("[data-sparkline]")).toHaveCount(4);
    const boxes = await kpis.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
    expect(new Set(boxes.map(Math.round)).size).toBe(1);

    // Muvaffaqiyat (1/3) va kunlik daromad (2/3) bir qatorda.
    const success = page.getByRole("region", { name: "Muvaffaqiyat darajasi" });
    const revenue = page.getByTestId("branch-metrics-revenue");
    await expect(success).toContainText("75,8%");
    await expect(success).toContainText("+3,7 p.p.");
    await expect(revenue.locator("[data-trend-plot] svg.recharts-surface")).toBeVisible({ timeout: 30_000 });
    const [successBox, revenueBox] = [await success.boundingBox(), await revenue.boundingBox()];
    expect(Math.round(successBox!.y)).toBe(Math.round(revenueBox!.y));
    expect(revenueBox!.width).toBeGreaterThan(successBox!.width * 1.4);

    // Holatlar + reyting.
    const status = page.getByTestId("branch-metrics-status");
    await expect(status.getByRole("list", { name: "Holatlar bo'yicha taqsimot" }).getByRole("listitem")).toHaveText([
      /Sotilgan.*141 ta.*75,8%/,
      /Yo'lda.*22 ta.*11,8%/,
      /Yangi.*6 ta.*3,2%/,
      /Bekor qilingan.*17 ta.*9,1%/,
    ]);
    await expect(status.getByRole("link", { name: "Ro'yxat" })).toHaveAttribute("href", /\/orders\?orderBranchId=15&startDay=\d{4}-\d{2}-\d{2}&endDay=/);
    const couriers = page.getByTestId("branch-metrics-couriers");
    await expect(couriers.getByText("3 / 3 faol")).toBeVisible();
    await expect(couriers.getByText("Bahodir Karimov")).toBeVisible();
    await expect(couriers.getByText("6 ta yangi (biriktirilmagan) buyurtma kirmaydi", { exact: false })).toBeVisible();

    // Xodimlar bo'limi ko'rsatkichlardan keyin.
    const employees = page.getByRole("table", { name: "Filial xodimlari" });
    expect((await employees.boundingBox())!.y).toBeGreaterThan((await couriers.boundingBox())!.y);

    // Gorizontal toshish yo'q.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await shotBranchMetrics(page, "branch-metrics--desktop-light", 2300);

    // Davr: «Bu oy» — yangi so'rov (oyning 1-kunidan), URL'da `?period=month`.
    await section.getByRole("radio", { name: "Bu oy" }).click();
    await expect(page).toHaveURL(/\/branches\/15\?period=month$/);
    await expect.poll(() => mock.dashboardRequests.at(-1)?.get("start_day")).toMatch(/-01$/);
    await expect(section.getByText(/^Bu oy · .+ · Urgut filiali buyurtmalari$/)).toBeVisible();
    await expect(page.getByTestId("branch-metrics-revenue").getByText(/^Joriy davr · \d{2}\.\d{2}/)).toBeVisible();

    // «Barchasi» — `all=true`, oldingi davr yo'q: delta chizilmaydi.
    await section.getByRole("radio", { name: "Barchasi" }).click();
    await expect.poll(() => mock.dashboardRequests.at(-1)?.get("all")).toBe("true");
    await expect(section.locator("[data-kpi]").first()).toContainText("186 ta");
    await expect(section.locator("[data-stat-delta]")).toHaveCount(0);
    expect(mock.leaked).toEqual([]);
  });

  test("tungi mavzu — 1440px", async ({ page }) => {
    await mockBranchMetricsApi(page, { theme: "dark" });
    const section = await openBranchMetrics(page);
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(section.locator("[data-kpi]")).toHaveCount(4);
    await expect(page.getByTestId("branch-metrics-revenue").locator("[data-trend-plot] svg.recharts-surface")).toBeVisible({
      timeout: 30_000,
    });
    await shotBranchMetrics(page, "branch-metrics--desktop-dark", 2300);
  });

  test("so'rov xatosi → «Qayta urinish»; olinmagan bo'lak — karta joyida xato, qayta urinishda tiklanadi", async ({ page }) => {
    const mock = await mockBranchMetricsApi(page, {
      dashboard: (params, call) => {
        // 1–2: 503 (so'rov bir marta avtomatik qayta urinadi), 3: reyting olinmadi, keyin — sog'.
        if (call <= 2) return { status: 503, message: "Dashboard ma'lumoti vaqtincha olinmadi" };
        const data = healthyMetrics(params);
        if (call === 3) return { status: 200, data: { ...data, topCouriers: null, degraded: true, failed_parts: ["topCouriers"] } };
        return { status: 200, data };
      },
    });
    const section = await openBranchMetrics(page);

    await expect(section.getByText("Filial ko'rsatkichlarini yuklab bo'lmadi")).toBeVisible({ timeout: 30_000 });
    await section.getByRole("button", { name: "Qayta urinish" }).click();

    const couriers = page.getByTestId("branch-metrics-couriers");
    await expect(couriers).toHaveAttribute("data-part-failed", "");
    await expect(couriers.getByText("Ma'lumotni yuklab bo'lmadi")).toBeVisible();
    await expect(section.locator("[data-kpi]").first()).toContainText("186 ta");
    await couriers.getByRole("button", { name: "Qayta urinish" }).click();
    await expect(page.getByTestId("branch-metrics-couriers").getByText("Bahodir Karimov")).toBeVisible();
    expect(mock.dashboardRequests.length).toBeGreaterThanOrEqual(4);
    expect(mock.leaked).toEqual([]);
  });
});
