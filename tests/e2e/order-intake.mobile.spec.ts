import { expect, test } from "@playwright/test";
import {
  CLOSED_AT_10,
  OPEN_UNLIMITED,
  mockOrderIntakeApi,
  openNewOrders,
} from "./support/orderIntake";

/** Bugungi qabul vaqti (2026-11-08), 390px: sarlavha havolasi ≥ 44 px (Ops «Kun tartibi»ga, 2026-11-10), toshish yo'q. */
const shot = async (page: import("@playwright/test").Page, name: string) => {
  if (process.env.E2E_SHOTS_DIR)
    await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/${name}.png` });
};

test.describe("Bugungi qabul vaqti — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ ${theme}: sarlavha havolasi ≥ 44 px, toshishsiz → Ops «Kun tartibi»`, async ({
      page,
    }) => {
      const { leaked } = await mockOrderIntakeApi(page, {
        // 2026-11-09: boshqaruv tugmasi faqat superadmin'da.
        role: "superadmin",
        theme,
        intake: OPEN_UNLIMITED,
      });
      await openNewOrders(page);

      const control = page.getByTestId("order-intake-control");
      const box = (await control.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      ).toBeLessThanOrEqual(0);
      await shot(page, `order-intake-header-390-${theme}`);

      await control.click();
      await expect(page).toHaveURL(/\/ops\?tab=daily-schedule$/);
      await expect(page.getByRole("combobox", { name: "Ops bo'limi: Kun tartibi" })).toBeVisible();
      expect(leaked).toEqual([]);
    });
  }

  test("market: qabul yopiq — yaratish sahifasida ogohlantirish, toshishsiz", async ({ page }) => {
    const { leaked } = await mockOrderIntakeApi(page, { role: "market", intake: CLOSED_AT_10 });
    await page.goto("/new-orders/create");
    await expect(page.getByTestId("intake-closed")).toBeVisible({ timeout: 60_000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
    await shot(page, "order-intake-create-closed-390-light");
    expect(leaked).toEqual([]);
  });
});
