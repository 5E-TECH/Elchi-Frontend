import { expect, test } from "@playwright/test";
import { openRegionCouriers } from "./support/regionCourierDistrict";

/**
 * YD7xyjX9 — 390px: tuman, telefon va summa to'liq ko'rinadi. Tuman alohida qatorda: bitta qatorda summa kesilib
 * «· 1» bo'lib qolardi — noto'g'ri raqamdek o'qilardi.
 */
test.describe.configure({ timeout: 180_000 });

test("⭐ tuman, telefon va summa kesilmaydi", async ({ page }) => {
  const { couriers, leaked } = await openRegionCouriers(page);
  const row = couriers.getByRole("listitem").filter({ hasText: "Kuryer A" });
  await expect(row).toContainText("Arnasoy tumani");
  await expect(row).toContainText("1 200 000 so'm");

  const clipped = await couriers
    .locator(".truncate")
    .evaluateAll((nodes) =>
      nodes.filter((node) => node.scrollWidth > node.clientWidth).map((node) => node.textContent),
    );
  expect(clipped).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(leaked).toEqual([]);
});
