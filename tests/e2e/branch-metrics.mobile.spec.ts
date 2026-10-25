import { expect, test, type Locator, type Page } from "@playwright/test";
import { mockBranchMetricsApi, openBranchMetrics, shotBranchMetrics } from "./support/branchMetrics";

/**
 * 6CYRjoZG — `/branches/:id` «Filial ko'rsatkichlari», 390px (maket `superadmin-branches-detail` telefon): davr
 * to'liq enli (har variant ≥ 44px), KPI 2 ustun, kartalar ustma-ust, gorizontal toshish yo'q; kunduzgi va tungi.
 */
const box = async (locator: Locator) => (await locator.boundingBox())!;

const expectPhoneLayout = async (page: Page, section: Locator) => {
  // Davr: to'liq enli, variantlar ≥ 44px.
  const periods = section.getByRole("radiogroup", { name: "Davr" });
  for (const radio of await periods.getByRole("radio").all()) {
    expect((await box(radio)).height).toBeGreaterThanOrEqual(44);
  }

  // «Grafik | Jadval» — to'liq enli (yorliq qisqarmaydi), variantlar ≥ 44px.
  const view = page.getByTestId("branch-metrics-revenue").getByRole("radiogroup", { name: "Kunlik daromad ko'rinishi" });
  expect((await box(view)).width).toBeGreaterThan(300);
  for (const radio of await view.getByRole("radio").all()) {
    expect((await box(radio)).height).toBeGreaterThanOrEqual(44);
    // Yorliq qirqilmagan (`truncate` — «Gra…» bo'lmasin).
    expect(
      await radio.evaluate((node) => [node, ...node.querySelectorAll("span")].every((el) => el.scrollWidth <= el.clientWidth + 1)),
    ).toBe(true);
  }

  // KPI: 2 ustun (1–2 bir qatorda, 3 pastda).
  const kpis = section.locator("[data-kpi]");
  await expect(kpis).toHaveCount(4);
  const [first, second, third] = [await box(kpis.nth(0)), await box(kpis.nth(1)), await box(kpis.nth(2))];
  expect(Math.round(first.y)).toBe(Math.round(second.y));
  expect(third.y).toBeGreaterThan(first.y + first.height - 1);

  // Kartalar ustma-ust, har biri to'liq enli.
  const cards = [
    page.getByRole("region", { name: "Muvaffaqiyat darajasi" }),
    page.getByTestId("branch-metrics-revenue"),
    page.getByTestId("branch-metrics-status"),
    page.getByTestId("branch-metrics-couriers"),
  ];
  let previousBottom = 0;
  for (const card of cards) {
    const rect = await box(card);
    expect(rect.y).toBeGreaterThanOrEqual(previousBottom - 1);
    expect(rect.width).toBeGreaterThan(340);
    previousBottom = rect.y + rect.height;
  }

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const contentOverflow = await page.evaluate(() => {
    const content = document.querySelector("[data-shell-slot=content]");
    return content ? content.scrollWidth - content.clientWidth : 0;
  });
  expect(contentOverflow).toBeLessThanOrEqual(0);
};

test.describe("Filial ko'rsatkichlari — 390px", () => {
  test.describe.configure({ timeout: 120_000 });

  test("kunduzgi: KPI 2 ustun, kartalar ustma-ust, toshish yo'q", async ({ page }) => {
    const mock = await mockBranchMetricsApi(page);
    const section = await openBranchMetrics(page);
    await expect(section.locator("[data-kpi]").first()).toContainText("186 ta");
    await expect(page.getByTestId("branch-metrics-revenue").locator("[data-trend-plot] svg.recharts-surface")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("branch-metrics-couriers").getByText("Bahodir Karimov")).toBeVisible();
    await expectPhoneLayout(page, section);
    await shotBranchMetrics(page, "branch-metrics--phone-light", 4200);
    expect(mock.leaked).toEqual([]);
  });

  test("tungi mavzu: toshish yo'q", async ({ page }) => {
    await mockBranchMetricsApi(page, { theme: "dark" });
    const section = await openBranchMetrics(page);
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(section.locator("[data-kpi]").first()).toContainText("186 ta");
    await expect(page.getByTestId("branch-metrics-revenue").locator("[data-trend-plot] svg.recharts-surface")).toBeVisible({
      timeout: 30_000,
    });
    await expectPhoneLayout(page, section);
    await shotBranchMetrics(page, "branch-metrics--phone-dark", 4200);
  });
});
