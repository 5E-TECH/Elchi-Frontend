import { expect, test } from "@playwright/test";
import {
  CLOSED_AT_10,
  OPEN_UNLIMITED,
  mockOrderIntakeApi,
  openNewOrders,
} from "./support/orderIntake";

/**
 * Bugungi qabul vaqti (2026-11-08), 1440px: «Qabul va yaratish» sarlavhasida superadmin uchun havola — vaqtni qo'yish Ops →
 * «Kun tartibi»da (2026-11-10, `daily-schedule.*.spec.ts`); qabul yopiq bo'lsa yaratish sahifasida ogohlantirish. Maket
 * yo'q — eng yaqini `superadmin-neworders-markets`.
 */
const shot = async (page: import("@playwright/test").Page, name: string) => {
  if (process.env.E2E_SHOTS_DIR)
    await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/${name}.png` });
};

test.describe("Bugungi qabul vaqti — 1440px", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ ${theme}: superadmin «cheklovsiz» havolasi «Buyurtma yaratish» chapida → Ops «Kun tartibi» (oyna yo'q)`, async ({
      page,
    }) => {
      const { leaked, patches } = await mockOrderIntakeApi(page, {
        role: "superadmin",
        theme,
        intake: OPEN_UNLIMITED,
      });
      await openNewOrders(page);

      const control = page.getByTestId("order-intake-control");
      await expect(control).toHaveText("Bugungi qabul: cheklovsiz");
      await expect(control).toHaveAttribute("href", "/ops?tab=daily-schedule");
      const create = page.getByRole("link", { name: "Buyurtma yaratish" });
      const [controlBox, createBox] = [
        (await control.boundingBox())!,
        (await create.boundingBox())!,
      ];
      expect(controlBox.x + controlBox.width).toBeLessThanOrEqual(createBox.x);
      expect(Math.abs(controlBox.y - createBox.y)).toBeLessThan(2);
      await shot(page, `order-intake-header-1440-${theme}`);

      await control.click();
      await expect(page).toHaveURL(/\/ops\?tab=daily-schedule$/);
      await expect(page.getByRole("tab", { name: "Kun tartibi" })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(patches).toEqual([]);
      expect(leaked).toEqual([]);
    });
  }

  test("market: qabul yopiq — yaratish sahifasida «Bugungi qabul yopildi», «Buyurtma yaratish» o'chiq", async ({
    page,
  }) => {
    const { leaked } = await mockOrderIntakeApi(page, { role: "market", intake: CLOSED_AT_10 });
    await page.goto("/new-orders/create");
    const alert = page.getByTestId("intake-closed");
    await expect(alert).toBeVisible({ timeout: 60_000 });
    await expect(alert).toContainText("Qabul 10:00 da yopilgan.");
    await expect(page.getByRole("button", { name: "Buyurtma yaratish" })).toBeDisabled();
    await shot(page, "order-intake-create-closed-1440-light");
    expect(leaked).toEqual([]);
  });
});
