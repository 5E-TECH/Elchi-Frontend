import { expect, test } from "@playwright/test";
import { mockDailyScheduleApi, noHorizontalScroll, openDailySchedule } from "./support/dailySchedule";

/**
 * Ops → «Kun tartibi» (2026-11-10), 1440px: «Qabul va yaratish» sarlavhasidagi «Bugungi qabul» havolasi shu tabga olib
 * keladi; yaratish / qabul chegaralari, kun almashishi va smena jadvali bitta «Saqlash» bilan — ikki PATCH faqat
 * o'zgarganlar bilan. Maket yo'q — eng yaqini `superadmin-payments-shift-settings`.
 */
const shot = async (page: import("@playwright/test").Page, name: string) => {
  if (process.env.E2E_SHOTS_DIR) await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/${name}.png`, fullPage: true });
};

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("Kun tartibi — 1440px", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ ${theme}: sarlavha havolasi → «Kun tartibi»; chegaralar va smena jadvali bitta «Saqlash» bilan`, async ({
      page,
    }) => {
      const mock = await mockDailyScheduleApi(page, { theme });
      await page.goto("/new-orders");
      const link = page.getByTestId("order-intake-control");
      await expect(link).toHaveText("Bugungi qabul: cheklovsiz", { timeout: 60_000 });
      await link.click();
      await expect(page).toHaveURL(/\/ops\?tab=daily-schedule$/);
      await expect(page.getByRole("tab", { name: "Kun tartibi" })).toHaveAttribute("aria-selected", "true");

      const intake = page.getByRole("region", { name: "Buyurtma qabuli" });
      const cutoff = intake.getByRole("textbox", { name: /^Buyurtma yaratish chegarasi/ });
      await cutoff.fill("1000");
      await expect(cutoff).toHaveValue("10:00");
      await intake.getByRole("textbox", { name: /^Yaratilgan buyurtmalarni qabul qilish chegarasi/ }).fill("1600");
      const dayChange = intake.getByRole("textbox", { name: /^Kun almashish vaqti/ });
      await dayChange.fill("1800");
      await expect(dayChange).toHaveValue("18:00");

      await page
        .getByRole("region", { name: "Avtomatik ochish" })
        .getByRole("switch", { name: "Smenani avtomatik ochish" })
        .click();
      await page
        .getByRole("region", { name: "Kechikish haqida xabar" })
        .getByRole("switch", { name: "Superadminlarga xabar yuborish" })
        .click();
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `daily-schedule-1440-${theme}`);

      await page.getByRole("button", { name: "Saqlash" }).click();
      await expect(page.getByText("Kun tartibi saqlandi", { exact: true }).first()).toBeVisible();
      expect(mock.intakePatches).toEqual([{ cutoff_time: "10:00", receive_cutoff_time: "16:00", day_change_time: "18:00" }]);
      expect(mock.shiftPatches).toEqual([{ auto_open: { enabled: true }, late_alert: { enabled: true } }]);
      // Server qiymatlari bilan teng — o'zgarish yo'q, «Saqlash» o'chiq; holat yangilandi.
      await expect(page.getByRole("button", { name: "Saqlash" })).toBeDisabled();
      await expect(intake.getByText(/^Hozir: ochiq · \d\d:\d\d da yopiladi$/).first()).toBeVisible();
      expect(mock.leaked).toEqual([]);
    });
  }

  test("avtomatik yopish (smena sozlamalaridan ko'chgan): kalit, vaqt, qamrov → faqat o'zgargan `auto_close`", async ({
    page,
  }) => {
    const mock = await mockDailyScheduleApi(page);
    await openDailySchedule(page);
    const close = page.getByRole("region", { name: "Avtomatik yopish" });
    await close.getByRole("switch", { name: "Smenani avtomatik yopish" }).click();
    await close.getByRole("button", { name: "Vaqt qo'shish" }).click();
    await page.getByRole("option", { name: "14:00" }).click();
    await expect(close.getByRole("list", { name: "Kuniga yopish vaqtlari" }).getByRole("listitem")).toHaveText([
      "14:00",
      "23:00",
    ]);
    await close.getByText("Asosiy kassa va filial kassalari").click();

    await page.getByRole("button", { name: "Saqlash" }).click();
    await expect(page.getByText("Kun tartibi saqlandi", { exact: true }).first()).toBeVisible();
    expect(mock.shiftPatches).toEqual([{ auto_close: { enabled: true, times: ["14:00", "23:00"], scope: "main+branches" } }]);
    expect(mock.intakePatches).toEqual([]);
    expect(mock.leaked).toEqual([]);
  });

  test("eski backend (`receive_*`, `auto_open`, `late_alert` yo'q): faqat mavjud bloklar, yaratish «faqat bugun»", async ({
    page,
  }) => {
    await mockDailyScheduleApi(page, {
      intake: {
        receive_cutoff_time: undefined,
        receive_is_open: undefined,
        receive_closes_at: undefined,
        receive_reopens_at: undefined,
      },
      shift: { auto_open: undefined, late_alert: undefined },
    });
    await openDailySchedule(page);
    const intake = page.getByRole("region", { name: "Buyurtma qabuli" });
    await expect(intake.getByText("Faqat joriy ish kuni uchun — kun almashganda cheklov o'chadi")).toBeVisible();
    await expect(intake.getByRole("textbox", { name: /qabul qilish chegarasi/ })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Avtomatik yopish" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Avtomatik ochish" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Kechikish haqida xabar" })).toHaveCount(0);
  });
});
