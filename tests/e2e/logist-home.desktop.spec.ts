import { expect, test } from "@playwright/test";
import { expectNoFinanceRequests, expectNoHorizontalOverflow, openLogistHome } from "./support/logistHome";

/**
 * LG-1 — logist bosh sahifasi (desktop 1280): yon menyuda «Bosh sahifa» va «Hududlar» (LG-3; moliyasiz — ega LG-S1), o'z
 * viloyatlari (logist_id = me), KPI, «Viloyatlar muvaffaqiyati», «Viloyatlarim» + «Jami»; pul yo'q; «Barchasi» —
 * sanasiz so'rov; xato → «Qayta urinish»; viloyat biriktirilmagan — bo'sh holat.
 */
test.describe.configure({ timeout: 180_000 });

test("⭐ o'z viloyatlari, KPI va jadval; menyu «Bosh sahifa» · «Hududlar»; pul yo'q", async ({ page }) => {
  const mock = await openLogistHome(page);

  const nav = page.getByRole("navigation", { name: "Asosiy bo'limlar" });
  await expect(nav.getByRole("link")).toHaveText(["Bosh sahifa", "Hududlar"]);

  const kpis = page.getByRole("region", { name: "Viloyatlarim bo'yicha umumiy ko'rsatkichlar" });
  await expect(kpis.getByText("Jarayonda 22 ta · 3 viloyat")).toBeVisible();
  await expect(kpis.getByText("/ 41")).toBeVisible();

  const table = page.getByRole("table", { name: "Viloyatlarim jadvali" });
  await expect(table.getByRole("row")).toHaveCount(5);
  await expect(table.getByRole("row").nth(1)).toContainText("Samarqand");
  await expect(table.getByRole("row").last()).toContainText("Jami · 3 viloyat");
  await expect(page.getByText("Toshkent sh.")).toHaveCount(0);
  await expect(page.getByText("Andijon")).toHaveCount(0);

  const text = await page.locator("[data-shell-slot=content]").innerText();
  expect(text).not.toMatch(/so'm|987/);
  expect(mock.statsQueries[0]).toMatch(/startDate=\d{4}-\d{2}-\d{2}&endDate=\d{4}-\d{2}-\d{2}/);

  await page.getByRole("radio", { name: "Barchasi" }).click();
  await expect.poll(() => mock.statsQueries.at(-1)).toBe("");
  await expectNoHorizontalOverflow(page);
  expect(mock.leaked).toEqual([]);
  expectNoFinanceRequests(mock);
});

test("xato — tushunarli matn, backend matni yo'q; «Qayta urinish» tiklaydi", async ({ page }) => {
  const mock = await openLogistHome(page, { fail: true });
  await expect(page.getByText("Viloyatlar statistikasini yuklab bo'lmadi")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/RPC timeout/)).toHaveCount(0);
  mock.failing = false;
  await page.getByRole("button", { name: "Qayta urinish" }).click();
  await expect(page.getByText("Sizga biriktirilgan 3 ta viloyat: Samarqand, Qashqadaryo, Surxondaryo")).toBeVisible();
});

test("viloyat biriktirilmagan — bo'sh holat", async ({ page }) => {
  const mock = await openLogistHome(page, { unassigned: true });
  await expect(page.getByText("Sizga hali viloyat biriktirilmagan")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("table")).toHaveCount(0);
  expectNoFinanceRequests(mock);
});
