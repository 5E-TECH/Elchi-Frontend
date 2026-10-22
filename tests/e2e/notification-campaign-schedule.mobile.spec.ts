import { expect, test, type Locator } from "@playwright/test";
import { mockCampaignApi, noHorizontalScroll, openAudience, shot } from "./support/notificationCampaign";

/**
 * KM-3 telefonda (390px): «Yuborish vaqti» kartasi, «Kampaniyalar tarixi» kartalari (jadval o'rniga), bekor qilish va
 * hisobot oynalari — pastki varaqa; bosiladigan narsalar ≥ 44px, gorizontal skroll yo'q. Kunduzgi va tungi.
 */
// Pastki varaqa ochilish animatsiyasida (`transform`) o'lcham bir lahza 43.99… bo'ladi — animatsiya tugashini kutamiz.
const tall = async (locator: Locator) =>
  expect.poll(async () => (await locator.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

test.describe("Kampaniyani rejalashtirish va tarix — 390px", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`yuborish vaqti va tasdiq oynasi (${theme})`, async ({ page }) => {
      const mock = await mockCampaignApi(page, { theme, history: true });
      const form = await openAudience(page);
      await form.getByRole("checkbox", { name: "Market" }).check();
      await expect(form.getByTestId("audience-summary")).toContainText("Auditoriya: 98 ta");
      await form.getByRole("textbox", { name: "Sarlavha" }).fill("Kuzgi chegirma");
      await form.getByRole("combobox", { name: "Kategoriya" }).click();
      await page.getByRole("option", { name: "Reklama" }).click();

      const card = form.getByTestId("campaign-schedule");
      const scheduled = card.locator("label").filter({ hasText: "Belgilangan vaqtda" });
      await tall(scheduled);
      await scheduled.click();
      await tall(card.getByRole("combobox", { name: "Soat" }));
      await tall(card.getByRole("button", { name: /^Sana/ }));
      await expect(card).toContainText("Ertaga, 10:00 da yuboriladi");
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `phone-schedule-${theme}`, card);

      await form.getByRole("button", { name: "Rejalashtirish" }).click();
      const dialog = page.getByRole("alertdialog", { name: "Kampaniyani rejalashtirishni tasdiqlang" });
      await expect(dialog).toContainText("Ertaga, 10:00 da yuboriladi");
      // Telefonda — pastki varaqa: pastki chetga yopishgan.
      const box = (await dialog.boundingBox())!;
      expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(844 - 2);
      await tall(dialog.getByRole("button", { name: "Rejalashtirish" }));
      await shot(page, `phone-schedule-confirm-${theme}`);
      expect(mock.leaked).toEqual([]);
    });

    test(`kampaniyalar tarixi, bekor qilish va hisobot (${theme})`, async ({ page }) => {
      const mock = await mockCampaignApi(page, { theme, history: true });
      await page.goto("/notifications/send");
      const history = page.getByTestId("campaign-history");
      await expect(history.getByText("Kuzgi chegirma: yetkazish 20% arzon")).toBeVisible({ timeout: 60_000 });
      // Telefonda jadval yo'q — kartalar.
      await expect(history.getByRole("table")).toHaveCount(0);
      for (const button of await history.getByRole("button", { name: /bekor qilish|hisoboti/ }).all()) await tall(button);
      await history.scrollIntoViewIfNeeded();
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `phone-history-${theme}`, history);

      await history.getByRole("button", { name: "«Yangi tariflar 1-noyabrdan» kampaniyasini bekor qilish" }).click();
      const cancel = page.getByRole("alertdialog", { name: "Kampaniyani bekor qilasizmi?" });
      await expect(cancel).toContainText("Qolgan 2 820 ta qabul qiluvchiga yuborilmaydi");
      await tall(cancel.getByRole("button", { name: "Kampaniyani bekor qilish" }));
      await shot(page, `phone-cancel-${theme}`);
      await cancel.getByRole("button", { name: "Yopish" }).click();
      expect(mock.cancels).toEqual([]);

      await history.getByRole("button", { name: "«Kuryerlar uchun yangi qoidalar» hisoboti" }).click();
      const report = page.getByRole("dialog", { name: "Kampaniya hisoboti" });
      await expect(report).toContainText("72 tadan 1–10");
      // Kanallar — ro'yxat (jadval telefonda yashirin).
      await expect(report.getByRole("table")).toBeHidden();
      await expect(report).toContainText("Yuborildi 140 · Xato 2 · O'tkazildi 70 · Jarayonda 0");
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `phone-report-${theme}`);
      expect(mock.leaked).toEqual([]);
    });
  }
});
