import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, openInvestorHome, RAW_BACKEND_MESSAGE, shot } from "./support/investorHome";

/**
 * IN-1 — investor bosh sahifasi, desktop 1440 (maketlar `investor-dashboard-home`, `-home-table`, `-empty`, `-error`,
 * `-forbidden`, `-not-linked`). API soxta (`support/investorHome.ts`), yozish so'rovlari yo'q.
 */

test.use({ viewport: { width: 1440, height: 900 } });

test("ma'lumot bilan: KPI, oylik foyda (6 · 12 · 24, Grafik | Jadval), investitsiyalar va foyda tarixi", async ({ page }) => {
  const mock = await openInvestorHome(page);

  await expect(page.getByText("Investor kabineti · Habibulla Nazirov")).toBeVisible();
  const kpis = page.getByRole("region", { name: "Asosiy ko'rsatkichlar" });
  await expect(kpis.getByText("5 ta investitsiya · oxirgisi 01.08.2026")).toBeVisible({ timeout: 30_000 });
  await expect(kpis.getByText("Oxirgi to'lov: 05.09.2026")).toBeVisible();
  await expect(kpis.locator("[data-stat-value]")).toHaveText(["450 mln so'm", "12,5 %", "34,3 mln so'm", "6,2 mln so'm"]);

  // Menyu: Bosh sahifa · Investitsiyalar · Foyda tarixi (IN-2); yuqori panelda qidiruv yo'q (ROL-0).
  const menu = page.getByRole("navigation", { name: "Asosiy bo'limlar" });
  await expect(menu.getByRole("link")).toHaveText(["Bosh sahifa", "Investitsiyalar", "Foyda tarixi"]);
  await expect(page.getByRole("combobox", { name: /Qidiruv/ })).toHaveCount(0);

  const chart = page.getByRole("img", { name: /^Oylik foyda, .*jami 40,5 mln so'm, to'langan 34,3 mln so'm, kutilmoqda 6,2 mln so'm$/ });
  await expect(chart).toBeVisible();
  await expect(chart.locator("[data-stack]")).toHaveCount(9);
  await expect(page.getByText(/davri hali yopilmagan — foyda davr tugagach hisoblanadi$/)).toBeVisible();
  await expect(page.getByText("Jami: 450 000 000 so'm")).toBeVisible();

  // Tooltip — sichqoncha ustunga kelganda.
  await chart.locator("[data-stack-col]").nth(10).hover();
  await expect(page.locator("[data-stacked-tip]")).toContainText("6 200 000 so'm");
  await shot(page, "investor-home--desktop-light");

  const profits = page.getByRole("region", { name: "Foyda tarixi" });
  await expect(profits.getByRole("row")).toHaveCount(6);
  await expect(profits.getByRole("row").nth(1)).toContainText("01.09 – 30.09.2026");
  await expect(profits.getByRole("row").nth(1).getByText("Kutilmoqda")).toBeVisible();
  await expect(profits.getByRole("row").nth(2).getByText("To'langan")).toBeVisible();
  // IN-2: «Barchasi ›» → ro'yxat sahifalari.
  await expect(page.getByRole("link", { name: "Barcha investitsiyalar" })).toHaveAttribute("href", "/investments");
  await expect(page.getByRole("link", { name: "Barcha foyda yozuvlari" })).toHaveAttribute("href", "/profits");

  await page.getByRole("radio", { name: "Jadval" }).click();
  const table = page.getByRole("table", { name: "Oylik foyda jadvali" });
  await expect(table.getByRole("row").nth(1)).toContainText("Joriy oy");
  await expect(table.getByRole("row").last()).toContainText("Jami · 12 oy34 300 000 so'm6 200 000 so'm40 500 000 so'm");
  await shot(page, "investor-home-table--desktop-light");

  await page.getByRole("radio", { name: "24 oy" }).click();
  await expect(page.getByText("Jami foyda · 24 oy")).toBeVisible();
  expect(mock.months).toEqual(expect.arrayContaining(["12", "24"]));

  await expectNoHorizontalOverflow(page);
  expect(mock.leaked).toEqual([]);
  // Admin bosh sahifasining kompaniya so'rovlari ketmaydi.
  expect(mock.requested.filter((path) => /^(region\/stats|analytics)/.test(path))).toEqual([]);
});

test("bo'sh: KPI 0 va izohlar, grafik o'rnida bo'sh holat (boshqaruvlarsiz), ro'yxatlar bo'sh", async ({ page }) => {
  await openInvestorHome(page, { empty: true, theme: "dark" });
  await expect(page.getByText("Hali foyda hisoblanmagan")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Hali investitsiya kiritilmagan")).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Grafik davri" })).toHaveCount(0);
  await expect(page.getByText("Hali investitsiya yo'q")).toBeVisible();
  await expect(page.getByText("Hali foyda yozuvi yo'q")).toBeVisible();
  await shot(page, "investor-home-empty--desktop-dark");
});

test("500: ko'rsatkichlar o'rnida xato kartasi, ro'yxatlar ishlaydi; backend matni ko'rinmaydi", async ({ page }) => {
  await openInvestorHome(page, { status: 500, dashboardOnly: true });
  const card = page.getByRole("region", { name: "Ko'rsatkichlar va oylik foyda" });
  await expect(card.getByText("Ko'rsatkichlarni yuklab bo'lmadi")).toBeVisible({ timeout: 30_000 });
  await expect(card.getByText(/Server xatosi \(500\)/)).toBeVisible();
  await expect(card.getByRole("button", { name: "Qayta urinish" })).toBeVisible();
  await expect(page.getByText("Jami: 450 000 000 so'm")).toBeVisible();
  await expect(page.getByText(RAW_BACKEND_MESSAGE)).toHaveCount(0);
  await shot(page, "investor-home-error--desktop-light");
});

for (const [status, title] of [
  [403, "Investor profilingiz nofaol"],
  [404, "Investor profili hali bog'lanmagan"],
  [409, "Investor profilini aniqlab bo'lmadi"],
] as const) {
  test(`${status}: butun sahifa holati — «Qayta urinish» va «Chiqish»`, async ({ page }) => {
    const mock = await openInvestorHome(page, { status });
    await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(`Xato kodi ${status}`)).toBeVisible();
    await expect(page.getByText("Investor kabineti", { exact: true })).toBeVisible();
    await expect(page.getByText(RAW_BACKEND_MESSAGE)).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Asosiy ko'rsatkichlar" })).toHaveCount(0);

    const before = mock.requested.filter((path) => path === "investors/me/dashboard").length;
    await page.getByRole("button", { name: "Qayta urinish" }).click();
    await expect
      .poll(() => mock.requested.filter((path) => path === "investors/me/dashboard").length)
      .toBeGreaterThan(before);
    await expect(page.getByRole("button", { name: "Chiqish" })).toBeVisible();
    await shot(page, `investor-home-${status}--desktop-light`);
  });
}
