import { expect, test } from "@playwright/test";
import { noHorizontalScroll, openDashboard } from "./support/dashboardTrend";

/**
 * Bosh sahifa (superadmin), 1440px, soxta backend:
 *  - DwrMygfo: delta — joriy javobning `previous` bo'lagidan (oldingi davr uchun IKKINCHI `analytics/dashboard` /
 *    `analytics/kpi` so'rovi yo'q), KPI kartalarida 14 kunlik sparkline;
 *  - l9NNdsCH: «Yo'qotilgan daromad» kartasi, «Moliyaviy tahlil» trendi — «Sof foyda», «Maqsad · 80%»;
 *  - XdKajqLe: «Barchasi» — kpi va revenue `all=true` bilan, «Yetkazish sifati», «Moliyaviy tahlil», «Kassa balansi»
 *    chiziladi, «oxirgi 366 kun» izohi.
 */
test.describe.configure({ timeout: 180_000 });
test.use({ viewport: { width: 1440, height: 900 } });

test("⭐ DwrMygfo + l9NNdsCH: 4 KPI (Yo'qotilgan daromad), delta `previous` dan, sparkline, maqsad, «Sof foyda» trendi", async ({ page }) => {
  const { kpis, requests } = await openDashboard(page);

  for (const label of ["Jami daromad", "Sof foyda", "O'rtacha buyurtma", "Yo'qotilgan daromad"]) {
    await expect(kpis.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(kpis.locator("[data-sparkline]")).toHaveCount(4);
  const lost = kpis.locator('[data-kpi="lostRevenue"]');
  await expect(lost).toContainText("5 mln so'm");
  // 5 mln / 5,6 mln → −10,7% — kamayish yaxshi (yashil).
  await expect(lost.locator("[data-stat-delta]")).toHaveText("−10,7%");
  await expect(lost.locator("[data-stat-delta]")).toHaveAttribute("data-quality", "good");
  // Jami daromad 48,6 / 45,68 mln → +6,4%.
  await expect(kpis.locator('[data-kpi="revenue"] [data-stat-delta]')).toHaveText("+6,4%");

  const success = page.locator("section", { has: page.getByRole("heading", { name: "Muvaffaqiyat darajasi" }) });
  await expect(success.getByText("Bugun · maqsad 80%")).toBeVisible();
  await expect(success.getByText("Maqsad · 80%")).toBeVisible();
  await expect(success.getByText("Yaxshi chegarasi · 70%")).toHaveCount(0);

  const finance = page.locator("section", { has: page.getByRole("heading", { name: "Moliyaviy tahlil" }) });
  await finance.scrollIntoViewIfNeeded();
  await expect(finance.getByText("Sof foyda = market tarifi − kuryer va filial ulushi")).toBeVisible();
  await expect(finance.getByText(/^Sof foyda · \d+ kun$/)).toBeVisible();

  // Oldingi davr uchun ikkinchi og'ir so'rov yo'q: har dashboard/kpi so'rovi — joriy davr (bugun).
  expect(requests.dashboard.length).toBeGreaterThan(0);
  const days = new Set([...requests.dashboard, ...requests.kpi].map((params) => params.get("start_day")));
  expect(days.size).toBe(1);
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(requests.leaked).toEqual([]);
});

test("⭐ XdKajqLe: «Barchasi» — dashboard, kpi va revenue `all=true`; sifat, moliyaviy tahlil, kassa ko'rinadi; «oxirgi 366 kun»", async ({ page }) => {
  const { requests } = await openDashboard(page);
  await page.getByRole("radio", { name: "Barchasi" }).click();

  await expect.poll(() => requests.kpi.at(-1)?.get("all")).toBe("true");
  await expect.poll(() => requests.revenue.at(-1)?.get("all")).toBe("true");
  expect(requests.revenue.at(-1)?.get("period")).toBe("monthly");
  expect(requests.revenue.at(-1)?.has("start_day")).toBe(false);
  expect([...requests.kpi, ...requests.revenue, ...requests.dashboard].some((params) => params.get("start_day") === "1970-01-01")).toBe(false);

  const quality = page.locator("section", { has: page.getByRole("heading", { name: "Yetkazish sifati" }) });
  await expect(quality).toContainText("Barcha davr · oxirgi");
  await expect(quality).toContainText("86,4%");
  const finance = page.locator("section", { has: page.getByRole("heading", { name: "Moliyaviy tahlil" }) });
  await finance.scrollIntoViewIfNeeded();
  await expect(finance.getByText("Sof foyda · barcha davr")).toBeVisible();
  await expect(finance.getByText(/^«Barchasi» — faqat oxirgi \d+ kun hisobga olindi:/)).toBeVisible();
  await expect(finance.getByRole("switch", { name: "Oldingi davr bilan solishtirish" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Kassa balansi" })).toBeVisible();
  await expect(page.getByText(/kuryerlar kesimi hisoblanmaydi/)).toHaveCount(0);
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(requests.leaked).toEqual([]);
});

for (const theme of ["light", "dark"] as const) {
  test(`1440px (${theme}): KPI qatori, muvaffaqiyat (maqsad) va «Moliyaviy tahlil» — toshishsiz`, async ({ page }, testInfo) => {
    const { kpis, requests } = await openDashboard(page, { theme });
    await expect(kpis.locator("[data-sparkline]")).toHaveCount(4);
    const finance = page.locator("section", { has: page.getByRole("heading", { name: "Moliyaviy tahlil" }) });
    await finance.scrollIntoViewIfNeeded();
    await expect(finance.getByText(/^Sof foyda · \d+ kun$/)).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
    await testInfo.attach(`dashboard-${theme}-1440`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    expect(requests.leaked).toEqual([]);
  });
}
