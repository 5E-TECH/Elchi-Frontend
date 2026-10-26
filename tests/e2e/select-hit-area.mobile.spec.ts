import { expect, test, type Locator } from "@playwright/test";
import { mockDegradedDashboard } from "./support/dashboardDegraded";

/**
 * uEV2pchR — /orders filtrlari telefonda (390px, iPhone 12 kengligi): asboblar qatoridagi va filtr varaqasidagi har
 * bir trigger ≥ 44 px (barmoq nishoni), fokus halqasi qutining o'zida (44 px).
 */
test.describe.configure({ timeout: 180_000 });

const heights = async (locator: Locator) => {
  const result: { name: string; height: number }[] = [];
  for (const item of await locator.all()) {
    if (!(await item.isVisible())) continue;
    const name = (await item.getAttribute("aria-label")) ?? (await item.innerText()).trim().slice(0, 30);
    result.push({ name, height: Math.round((await item.boundingBox())!.height) });
  }
  return result;
};

test("⭐ 390: /orders dagi har filtr triggeri ≥ 44 px; varaqadagi maydon quti 44 px", async ({ page }) => {
  await mockDegradedDashboard(page);
  await page.goto("/orders");
  const filters = page.getByRole("button", { name: /^Filtrlar/ });
  await expect(filters).toBeVisible({ timeout: 90_000 });

  const toolbar = await heights(page.locator("#main-content").getByRole("button", { name: /^(Filtrlar|Sana oralig'i)/ }));
  expect(toolbar.length).toBeGreaterThan(0);
  for (const item of toolbar) expect(item.height, item.name).toBeGreaterThanOrEqual(44);

  await filters.click();
  const sheet = page.getByRole("dialog", { name: "Filtrlar" });
  await expect(sheet).toBeVisible();
  const triggers = await heights(sheet.locator("[data-select], [role=radio], button[aria-haspopup]"));
  expect(triggers.length).toBeGreaterThan(0);
  for (const item of triggers) expect(item.height, item.name).toBeGreaterThanOrEqual(44);

  const combobox = sheet.getByRole("combobox").first();
  if (await combobox.count()) {
    const box = combobox.locator("xpath=ancestor::*[@data-select][1]");
    await combobox.focus();
    expect(Math.round((await box.boundingBox())!.height)).toBe(44);
    expect(await box.evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe("none");
  }
});
