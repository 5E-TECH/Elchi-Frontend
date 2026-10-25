import { expect, test } from "@playwright/test";
import { mockDegradedDashboard } from "./support/dashboardDegraded";

/**
 * uEV2pchR — /orders filtr maydonlari (1920px): qutining istalgan joyi bosiladi (yuqori chetidan 5 px pastga bosish
 * ham ro'yxatni ochadi), fokus halqasi qutining o'zida va quti 40 px. Avval ichki tugma 20 px edi — 58% o'lik zona.
 */
test.use({ viewport: { width: 1920, height: 1000 } });
test.describe.configure({ timeout: 180_000 });

test("⭐ filtr qutisining yuqori chetidan 5 px pastga bosish ro'yxatni ochadi; fokus halqasi qutida (40 px)", async ({ page }) => {
  await mockDegradedDashboard(page);
  await page.goto("/orders");
  await page.getByRole("button", { name: /^Filtrlar/ }).click({ timeout: 90_000 });
  const panel = page.getByRole("group", { name: "Qo'shimcha filtrlar" });
  const combobox = panel.getByRole("combobox", { name: "Yetkazish turi" });
  const box = combobox.locator("xpath=ancestor::*[@data-select][1]");
  const rect = (await box.boundingBox())!;
  expect(Math.round(rect.height)).toBe(40);

  await page.mouse.click(rect.x + rect.width / 2, rect.y + 5);
  await expect(page.getByRole("listbox", { name: "Yetkazish turi" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);

  // Klaviatura fokusi: halqa (box-shadow) qutining o'zida, tugmada kontur yo'q.
  await combobox.focus();
  await expect(combobox).toBeFocused();
  const ring = await box.evaluate((node) => getComputedStyle(node).boxShadow);
  expect(ring).not.toBe("none");
  expect(await combobox.evaluate((node) => getComputedStyle(node).outlineStyle)).toBe("none");
  expect(Math.round((await combobox.boundingBox())!.height)).toBeGreaterThanOrEqual(38);
});
