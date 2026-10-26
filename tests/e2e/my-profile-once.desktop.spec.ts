import { expect, test } from "@playwright/test";
import { mockDegradedDashboard } from "./support/dashboardDegraded";

/**
 * z87E6tdQ — har bir asosiy sahifa yuklanishida `GET /auth/my-profile` bitta: auth bootstrap, `useSettings`
 * (['app-settings']) va `useGetMyProfile` (/orders filtrlari) yagona profil keshidan o'qiydi. Avval /orders da 3 ta,
 * qolgan sahifalarda 2 ta edi. Soxta API (superadmin), 1440px.
 */
const PAGES = [
  "/",
  "/orders",
  "/mails/today",
  "/payments",
  "/products",
  "/all-users",
  "/regions",
  "/branches",
  "/new-orders",
  "/financial-balance",
  "/activity-logs",
];

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 300_000 });

test("⭐ har sahifa yuklanishida GET /auth/my-profile aynan 1 marta", async ({ page }) => {
  await mockDegradedDashboard(page);
  let calls = 0;
  page.on("request", (request) => {
    if (request.method() === "GET" && new URL(request.url()).pathname === "/auth/my-profile") calls += 1;
  });

  for (const path of PAGES) {
    calls = 0;
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 90_000 });
    // Sahifa ichidagi kechroq ochiladigan so'rovlar (filtr variantlari, sozlamalar) ham ketib bo'lsin.
    await page.waitForTimeout(1_500);
    expect.soft(calls, path).toBe(1);
  }
});
