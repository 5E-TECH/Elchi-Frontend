import { expect, test } from "@playwright/test";
import { mockDailyScheduleApi, noHorizontalScroll, openDailySchedule } from "./support/dailySchedule";

/**
 * Ops → «Kun tartibi» (2026-11-10), 390px: bo'lim tanlovi — `Select`, toshish yo'q, bosiladigan narsalar ≥ 44 px,
 * kartalar ustma-ust; saqlash — ikki PATCH faqat o'zgarganlar bilan.
 */
const shot = async (page: import("@playwright/test").Page, name: string) => {
  if (process.env.E2E_SHOTS_DIR) await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/${name}.png`, fullPage: true });
};

test.describe("Kun tartibi — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ ${theme}: toshishsiz, ≥ 44 px; yaratish chegarasi va avtomatik ochish saqlanadi`, async ({ page }) => {
      const mock = await mockDailyScheduleApi(page, { theme });
      await openDailySchedule(page);
      await expect(page.getByRole("combobox", { name: /Ops bo'limi: Kun tartibi/ })).toBeVisible();
      expect(await noHorizontalScroll(page)).toBe(true);

      const intake = page.getByRole("region", { name: "Buyurtma qabuli" });
      const cutoff = intake.getByRole("textbox", { name: /^Buyurtma yaratish chegarasi/ });
      const targets = [
        page.getByRole("button", { name: "Saqlash" }),
        cutoff,
        intake.getByRole("textbox", { name: /^Kun almashish vaqti/ }),
        page.getByRole("region", { name: "Avtomatik ochish" }).getByRole("switch", { name: "Smenani avtomatik ochish" }),
        page.getByRole("region", { name: "Avtomatik ochish" }).getByRole("button", { name: "Vaqt qo'shish" }),
      ];
      for (const target of targets) {
        const box = (await target.boundingBox())!;
        expect(box.height, `${await target.getAttribute("aria-label") ?? (await target.textContent())}: ≥ 44px`).toBeGreaterThanOrEqual(44);
        expect(box.x + box.width).toBeLessThanOrEqual(390);
      }
      await shot(page, `daily-schedule-390-${theme}`);

      await cutoff.fill("0930");
      await page
        .getByRole("region", { name: "Avtomatik ochish" })
        .getByRole("switch", { name: "Smenani avtomatik ochish" })
        .click();
      await page.getByRole("button", { name: "Saqlash" }).click();
      await expect(page.getByText("Kun tartibi saqlandi", { exact: true }).first()).toBeVisible();
      expect(mock.intakePatches).toEqual([{ cutoff_time: "09:30" }]);
      expect(mock.shiftPatches).toEqual([{ auto_open: { enabled: true } }]);
      expect(await noHorizontalScroll(page)).toBe(true);
      expect(mock.leaked).toEqual([]);
    });
  }
});
