import { expect, test } from "@playwright/test";
import { mockExtraCostApprovals, openMarketDashboard } from "./support/extraCostApprovals";
import { toast, toastRegion } from "./support/toast";

/** PINtZcLj — market dashboardi, «Qo'shimcha xarajat tasdiqlari» (maket `market-dashboard-extra-cost-approvals`), 1440px. */
test.describe("Qo'shimcha xarajat tasdiqlari — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ so'rovlar maketdagidek; «Tasdiqlash» — POST approve, so'rov ro'yxatdan chiqadi", async ({ page }) => {
    const { decisions } = await mockExtraCostApprovals(page);
    await openMarketDashboard(page);

    const card = page.getByTestId("extra-cost-approvals");
    await expect(card).toContainText("2 ta so'rov kutilmoqda");
    const sell = card.getByRole("listitem", { name: "Sotishdagi qo'shimcha xarajat, buyurtma №10225" });
    await expect(sell).toContainText("25 000 so'm");
    await expect(sell).toContainText("Tasdiqlansa — buyurtma sotiladi");
    await expect(sell).toContainText("#56 · Kuryer");
    await expect(sell.getByRole("link", { name: "№10225" })).toHaveAttribute("href", "/orders/edit/10225");
    const cancel = card.getByRole("listitem", { name: "Bekor qilishdagi qo'shimcha xarajat, buyurtma №10222" });
    await expect(cancel).toContainText("Yo'q");

    await sell.getByRole("button", { name: "Tasdiqlash" }).click();
    await expect.poll(() => decisions).toEqual(["approve ap-1"]);
  });

  test("⭐ ro'yxat so'rovi xato bersa — karta yo'qolmaydi: «Ma'lumotni yuklab bo'lmadi» + «Qayta urinish» — tiklanadi", async ({ page }) => {
    const { listCalls } = await mockExtraCostApprovals(page, { failFirst: true });
    await openMarketDashboard(page);

    const card = page.getByTestId("extra-cost-approvals");
    await expect(card.getByRole("alert")).toContainText("Ma'lumotni yuklab bo'lmadi", { timeout: 60_000 });
    await card.getByRole("button", { name: "Qayta urinish" }).click();
    await expect(card).toContainText("2 ta so'rov kutilmoqda");
    expect(listCalls()).toBeGreaterThanOrEqual(3);
  });

  test("⭐ 1tnpaIqd: so'rov boshqa joyda hal qilingan (400 «allaqachon yakunlangan») — xato emas, ro'yxat yangilanadi", async ({ page }) => {
    const { listCalls } = await mockExtraCostApprovals(page, { alreadyResolved: true });
    await openMarketDashboard(page);

    const card = page.getByTestId("extra-cost-approvals");
    await expect(card).toContainText("2 ta so'rov kutilmoqda");
    const before = listCalls();
    await card.getByRole("listitem", { name: /№10225/ }).getByRole("button", { name: "Tasdiqlash" }).click();

    await expect(toast(page, "Bu so'rov allaqachon hal qilingan — ro'yxat yangilandi", { tone: "info" })).toBeVisible();
    // Xato xabari (backend matni bilan) chiqmaydi.
    await expect(toastRegion(page).locator('[data-tone="error"]')).toHaveCount(0);
    await expect(toast(page, "allaqachon yakunlangan")).toHaveCount(0);
    await expect.poll(() => listCalls()).toBeGreaterThan(before);
    await expect(card).toContainText("1 ta so'rov kutilmoqda");
  });
});

