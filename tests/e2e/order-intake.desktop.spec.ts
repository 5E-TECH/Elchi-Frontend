import { expect, test } from "@playwright/test";
import {
  CLOSED_AT_10,
  OPEN_UNLIMITED,
  mockOrderIntakeApi,
  openNewOrders,
} from "./support/orderIntake";

/**
 * Bugungi qabul vaqti (2026-11-08), 1440px: «Qabul va yaratish» sarlavhasida admin vaqtni qo'yadi (oyna, PATCH);
 * qabul yopiq bo'lsa yaratish sahifasida ogohlantirish. Maket yo'q — eng yaqini `superadmin-neworders-markets`.
 */
const shot = async (page: import("@playwright/test").Page, name: string) => {
  if (process.env.E2E_SHOTS_DIR)
    await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/${name}.png` });
};

test.describe("Bugungi qabul vaqti — 1440px", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ ${theme}: superadmin «cheklovsiz» → oyna → 10:00 → Saqlash; tugma «Buyurtma yaratish» chapida`, async ({
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
      const create = page.getByRole("link", { name: "Buyurtma yaratish" });
      const [controlBox, createBox] = [
        (await control.boundingBox())!,
        (await create.boundingBox())!,
      ];
      expect(controlBox.x + controlBox.width).toBeLessThanOrEqual(createBox.x);
      expect(Math.abs(controlBox.y - createBox.y)).toBeLessThan(2);
      await shot(page, `order-intake-header-1440-${theme}`);

      await control.click();
      const dialog = page.getByRole("dialog", { name: "Bugungi qabul vaqti" });
      await dialog.getByRole("textbox", { name: /Qabul tugaydigan vaqt/ }).fill("1000");
      await expect(dialog.getByRole("textbox", { name: /Qabul tugaydigan vaqt/ })).toHaveValue(
        "10:00",
      );
      await dialog.evaluate((node) =>
        Promise.allSettled(node.ownerDocument.getAnimations().map((a) => a.finished)),
      );
      await shot(page, `order-intake-dialog-1440-${theme}`);
      await dialog.getByRole("button", { name: "Saqlash" }).click();

      await expect(dialog).toHaveCount(0);
      await expect(control).toHaveText("Bugungi qabul: 10:00 gacha");
      expect(patches).toEqual([{ cutoff_time: "10:00" }]);
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
