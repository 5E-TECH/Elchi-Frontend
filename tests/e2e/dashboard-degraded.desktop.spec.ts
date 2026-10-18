import { expect, test } from "@playwright/test";
import { mockDegradedDashboard, openDashboard } from "./support/dashboardDegraded";

/**
 * VkwhHqvW — dashboard bo'lagi olinmasa 0 lar emas, joyida xato holati (taxta `tizim-charts` «Xato»:
 * «Ma'lumotni yuklab bo'lmadi» + «Qayta urinish»); 503 — sahifa darajasida xato. 1440px, soxta backend.
 */
test.describe("Dashboard qisman nosozligi — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ superadmin: `topMarkets` + `markets` olinmadi — joyida xato kartasi; «Qayta urinish» — tiklanadi", async ({ page }) => {
    const { dashboardCalls, leaked } = await mockDegradedDashboard(page, { failedParts: ["topMarkets", "markets"] });
    await openDashboard(page);

    const markets = page.getByTestId("ranking-markets");
    await expect(markets).toHaveAttribute("data-part-failed", "", { timeout: 60_000 });
    await expect(markets).toContainText("Top marketlar");
    await expect(markets).toContainText("Ma'lumotni yuklab bo'lmadi");
    await expect(markets).not.toContainText("Bu davrda reyting uchun buyurtma yo'q");
    // Dizayn v2: admin dashboardida alohida «solishtiruv grafigi» yo'q — `markets` faqat «Top marketlar»
    // ning «Yana ko'rsatish» ro'yxati. Olingan bo'laklar (filiallar, kuryerlar) joyida.
    await expect(page.getByTestId("ranking-branches")).toContainText("Urgut filiali");
    await expect(page.getByTestId("ranking-couriers")).toContainText("Jasur Tursunov");

    const callsBeforeRetry = dashboardCalls();
    await markets.getByRole("button", { name: "Qayta urinish" }).click();
    await expect(markets.getByText("Baraka Shop")).toBeVisible();
    await expect(markets).not.toHaveAttribute("data-part-failed");
    // «Qayta urinish» — joriy davr so'rovi bir marta qayta yuboriladi (oldingi davr so'rovi — alohida).
    expect(dashboardCalls()).toBe(callsBeforeRetry + 1);
    expect(leaked).toEqual([]);
  });

  test("⭐ admin: 503 — sahifa darajasida xato (0 lar yo'q), «Qayta urinish» — tiklanadi", async ({ page }) => {
    await mockDegradedDashboard(page, { role: "admin", unavailable: true });
    await openDashboard(page);

    const content = page.locator("[data-shell-slot=content]");
    await expect(content.getByText("Bosh sahifa ma'lumotlarini yuklab bo'lmadi.")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("ranking-markets")).toHaveCount(0);
    await content.getByRole("button", { name: "Qayta urinish" }).first().click();
    await expect(page.getByTestId("ranking-markets")).toContainText("Baraka Shop");
  });

  test("⭐ market: `topMarkets` va `markets` olinmadi — reyting va solishtiruv joyida xato", async ({ page }) => {
    await mockDegradedDashboard(page, { role: "market", failedParts: ["topMarkets", "markets"] });
    await openDashboard(page);

    // Dizayn v2: reyting va o'z qatori bitta «Marketlar bo'yicha sotuv foizi» kartasida — joyida bitta xato kartasi.
    const sales = page.getByTestId("market-ranking-failed");
    await expect(sales).toContainText("Ma'lumotni yuklab bo'lmadi", { timeout: 60_000 });
    await expect(sales).toContainText("Marketlar bo'yicha sotuv foizi");
    await expect(page.getByTestId("market-stats-grid")).toBeVisible();
  });

  test("⭐ kuryer: `topCouriers` olinmadi — reyting yashirilmaydi, joyida xato", async ({ page }) => {
    await mockDegradedDashboard(page, { role: "courier", failedParts: ["topCouriers"] });
    await openDashboard(page);

    await expect(page.getByTestId("courier-ranking-failed")).toContainText("Top kuryerlar", { timeout: 60_000 });
    await expect(page.getByTestId("courier-ranking-failed")).toContainText("Ma'lumotni yuklab bo'lmadi");
    await expect(page.getByTestId("courier-stats-grid")).toBeVisible();
  });

  test("⭐ menejer: `branchDashboard` va `topBranches` olinmadi — filial raqamlari 0 emas, reyting joyida xato", async ({ page }) => {
    await mockDegradedDashboard(page, { role: "manager", failedParts: ["branchDashboard", "topBranches"] });
    await openDashboard(page, "/branch-dashboard");

    await expect(page.getByText("Statistika vaqtincha mavjud emas").first()).toBeVisible({ timeout: 60_000 });
    const ranking = page.getByTestId("ranking-branches");
    await expect(ranking).toHaveAttribute("data-part-failed", "");
    await expect(ranking).toContainText("Ma'lumotni yuklab bo'lmadi");
  });
});
