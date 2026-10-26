import { expect, test } from "@playwright/test";
import { mockCampaignApi, openAudience, shot, tashkentDay } from "./support/notificationCampaign";

/**
 * KM-3 — kampaniyani rejalashtirish, «Kampaniyalar tarixi», bekor qilish va hisobot oynalari (1440px). Maketlar:
 * `superadmin-notifications-send-schedule`, `-send-confirm-scheduled-dialog`, `-campaign-cancel-dialog`,
 * `-campaign-report-dialog`. Skrinshotlar — `KM2_SHOTS=<papka>` bo'lsa.
 */
test.describe("Xabar yuborish — rejalashtirish va kampaniyalar tarixi", () => {
  test.describe.configure({ timeout: 120_000 });

  test("belgilangan vaqtda: sana, soat, reklama taqiqi, tasdiq va scheduled_at +05:00", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const mock = await mockCampaignApi(page, { history: true });
    const form = await openAudience(page);
    await form.getByRole("checkbox", { name: "Market" }).check();
    await expect(form.getByTestId("audience-summary")).toContainText("Auditoriya: 98 ta");
    await form.getByRole("textbox", { name: "Sarlavha" }).fill("Kuzgi chegirma: yetkazish 20% arzon");
    await form.getByRole("combobox", { name: "Kategoriya" }).click();
    await page.getByRole("option", { name: "Reklama" }).click();

    const card = form.getByTestId("campaign-schedule");
    await expect(card).toContainText("Toshkent vaqti");
    await expect(card).toContainText("Reklama 18:00–09:00 oralig'ida yuborilmaydi");
    await card.getByRole("radio", { name: /Belgilangan vaqtda/ }).check();
    // Sukut — ertaga, 10:00 (maketdagidek).
    await expect(card.getByRole("combobox", { name: "Soat" })).toContainText("10:00");
    await expect(card).toContainText("Ertaga, 10:00 da yuboriladi");

    await card.getByRole("combobox", { name: "Soat" }).click();
    const quiet = page.getByRole("option", { name: /^08:30/ });
    await expect(quiet).toHaveAttribute("aria-disabled", "true");
    await expect(quiet).toContainText("Reklama taqiqi");
    await expect(page.getByRole("option", { name: /^09:00/ })).not.toHaveAttribute("aria-disabled", "true");
    await shot(page, "desktop-schedule-open", card);
    await page.keyboard.press("Escape");

    const submit = form.getByRole("button", { name: "Rejalashtirish" });
    await expect(form).toContainText(/Ertaga, 10:00 · 98 ta qabul qiluvchi/);
    await submit.click();
    const dialog = page.getByRole("alertdialog", { name: "Kampaniyani rejalashtirishni tasdiqlang" });
    await expect(dialog).toContainText("98 ta qabul qiluvchiga yuboriladi");
    await expect(dialog).toContainText("Ertaga, 10:00 da yuboriladi");
    await expect(dialog).toContainText(`· Toshkent vaqti`);
    await expect(dialog).toContainText("Yuborilguncha «Kampaniyalar tarixi»da bekor qilish mumkin.");
    await shot(page, "desktop-schedule-confirm");
    await dialog.getByRole("button", { name: "Rejalashtirish" }).click();

    await expect.poll(() => mock.campaigns.length).toBe(1);
    expect(mock.campaigns[0].body).toMatchObject({
      category: "marketing",
      scheduled_at: `${tashkentDay(1)}T10:00:00+05:00`,
    });
    const progress = page.getByTestId("campaign-progress");
    await expect(progress).toContainText("Rejalashtirilgan");
    await expect(progress).toContainText("Kampaniya ertaga, 10:00 da yuboriladi");
    await expect(progress.getByRole("button", { name: "Kampaniyalar tarixi" })).toBeVisible();
    expect(mock.leaked).toEqual([]);
  });

  test("«Darhol» — scheduled_at yuborilmaydi", async ({ page }) => {
    const mock = await mockCampaignApi(page);
    const form = await openAudience(page);
    await form.getByRole("checkbox", { name: "Market" }).check();
    await expect(form.getByTestId("audience-summary")).toContainText("Auditoriya: 98 ta");
    await form.getByRole("textbox", { name: "Sarlavha" }).fill("Salom");
    await expect(form.getByTestId("campaign-schedule").getByRole("radio", { name: /Darhol/ })).toBeChecked();
    await form.getByRole("button", { name: "Yuborish" }).click();
    await page.getByRole("alertdialog", { name: "Xabarni yuborishni tasdiqlang" }).getByRole("button", { name: /Ha, yuborish/ }).click();
    await expect.poll(() => mock.campaigns.length).toBe(1);
    expect(mock.campaigns[0].body).not.toHaveProperty("scheduled_at");
  });

  test("tarix: tablar, bekor qilish oynasi, hisobot oynasi va CSV", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const mock = await mockCampaignApi(page, { history: true });
    await page.goto("/notifications/send");
    const history = page.getByTestId("campaign-history");
    await expect(history.getByRole("table")).toBeVisible({ timeout: 60_000 });
    await expect(history.getByRole("row")).toHaveCount(7);
    await expect(history).toContainText("Ertaga, 10:00");
    await expect(history).toContainText("2 040 / 4 860");
    await expect(history).toContainText("210 yuborildi · 2 xato");
    await expect(history).toContainText("Xodim: Kuryer");
    // N10 (fb4qy6bd): so'ralgan vaqt va tungi taqiq belgisi (maket: «18:40 da so'ralgan, tungi taqiq»).
    await expect(history.getByRole("row").filter({ hasText: "Hafta oxiri" })).toContainText(
      "Ertaga, 09:00bugun, 18:40 da so'ralgan, tungi taqiq tufayli surildi",
    );
    await expect(history).toContainText("6 tadan 1–6");
    // Bekor qilingan va xato kampaniyada chiziq — yuborilganlar ulushi (backend `progress_pct` = 100 emas).
    await expect(history.getByRole("progressbar", { name: "«Bayram kunlari ish tartibi» — yuborildi" })).toHaveAttribute(
      "aria-valuenow",
      "31",
    );
    await expect(
      history.getByRole("progressbar", { name: "«Samarqand filiali yangi manzilda» — yuborildi" }),
    ).toHaveAttribute("aria-valuenow", "64");
    // Sahifada yuborilayotgan kampaniya bor — ro'yxat jonli.
    await expect(history).toContainText("Holat har 3 soniyada yangilanadi");
    await shot(page, "desktop-history", history);

    await history.getByRole("tab", { name: "Rejalashtirilgan" }).click();
    await expect(history.getByRole("row")).toHaveCount(3);
    expect(mock.listQueries.at(-1)).toMatchObject({ state: "scheduled" });
    await history.getByRole("tab", { name: "Barchasi" }).click();
    await expect(history.getByRole("row")).toHaveCount(7);

    // Bekor qilish — yuborilayotgan kampaniya: progress va «Qolgan 2 820 ta».
    await history.getByRole("button", { name: "«Yangi tariflar 1-noyabrdan» kampaniyasini bekor qilish" }).click();
    const cancel = page.getByRole("alertdialog", { name: "Kampaniyani bekor qilasizmi?" });
    await expect(cancel).toContainText("Navbatdagi qismlar yuborilmaydi");
    await expect(cancel).toContainText("Yuborilmoqda");
    await expect(cancel).toContainText("Qolgan 2 820 ta qabul qiluvchiga yuborilmaydi");
    await shot(page, "desktop-cancel");
    await cancel.getByRole("button", { name: "Kampaniyani bekor qilish" }).click();
    await expect(page.getByRole("region", { name: "Bildirishnomalar" })).toContainText("Kampaniya bekor qilindi");
    expect(mock.cancels).toEqual(["12"]);

    // Hisobot — yuborilgan kampaniya.
    await history.getByRole("button", { name: "«Kuryerlar uchun yangi qoidalar» hisoboti" }).click();
    const report = page.getByRole("dialog", { name: "Kampaniya hisoboti" });
    await expect(report).toContainText("Kuryerlar uchun yangi qoidalar · Kecha, 11:00");
    await expect(report.getByTestId("campaign-report")).toContainText("Auditoriya212qabul qiluvchi");
    await expect(report).toContainText("Push kanalida");
    await expect(report).toContainText("Push obunasi yo'q");
    await expect(report.getByRole("table")).toContainText("Ochiq ekranga");
    await expect(report).toContainText("72 tadan 1–10");
    await expect(report).toContainText("Push — xato");
    await expect(report).toContainText("Push yetkazilmadi");
    await expect(report).not.toContainText("raw provider text");
    // H7kpCman: «Yetkazildi» — DLR yo'q → «—» (0 emas); narx yonida «taxminiy»; SMS bloki yo'q (`sms: null`).
    const stats = report.getByTestId("campaign-report-stats");
    await expect(stats).toContainText("Yetkazildi—bu kanallarda yetkazish hisoboti yo'q");
    await expect(stats).toContainText("taxminiy · bepul kanallar");
    await expect(report.getByTestId("campaign-report-sms")).toHaveCount(0);
    // N9: maskalangan telefon va `reason_code` dan sabab.
    await expect(report).toContainText("Kuryer · ***7400");
    await expect(report).toContainText("Push obunasi eskirgan");
    await shot(page, "desktop-report");

    const download = page.waitForEvent("download");
    await report.getByRole("button", { name: "CSV yuklab olish" }).click();
    expect((await download).suggestedFilename()).toBe("kampaniya-notification-14-yetkazilmaganlar.csv");
    expect(mock.exports).toBe(1);
    expect(mock.leaked).toEqual([]);
  });
});
