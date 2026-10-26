import { expect, test } from "@playwright/test";
import { mockSmsCampaignApi, pick } from "./support/smsCampaign";
import { toast } from "./support/toast";
import { NOON_TASHKENT, mockSmsScheduleApi } from "./support/smsCampaignSchedule";

/**
 * KM-6 (2aS7PFX0) — SMS kampaniyani rejalashtirish (1440px): «Belgilangan vaqtda» → sana + soat (Toshkent),
 * taqiq soati tanlansa — 09:00 ga surilishi oldindan; tasdiqda «Tungi taqiq sababli … ga surildi»; «Rejalashtirish»
 * → `scheduled_at` (+05:00) bilan SOXTA yaratish; tarixda «Rejalashtirilgan» va «Bekor qilish» → `…/cancel`.
 * Hamma yozish so'rovlari mock — hech narsa yuborilmaydi.
 */
test.describe("SMS kampaniya — rejalashtirish, 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ belgilangan vaqt → taqiq siljishi → rejalashtirish → tarixdan bekor qilish", async ({ page }) => {
    await page.clock.setFixedTime(NOON_TASHKENT);
    const base = await mockSmsCampaignApi(page);
    const mock = await mockSmsScheduleApi(page);
    await page.goto("/notifications/sms");
    const panel = page.getByRole("tabpanel");
    await expect(panel.getByTestId("sms-meter")).toBeVisible({ timeout: 60_000 });

    await panel.getByRole("textbox", { name: "Xabar matni" }).fill("Elchi: kuzgi chegirma 20%");
    await panel
      .getByRole("textbox", { name: "Telefon raqamlari (har qatorda bittadan)" })
      .fill("+998901111111\n+998902222222\nxyz");

    // «Belgilangan vaqtda» — sukut ertaga 10:00 (Toshkent).
    const sendTime = panel.getByTestId("campaign-send-time");
    await sendTime.getByRole("radio", { name: /Belgilangan vaqtda/ }).check();
    await expect(sendTime.getByTestId("campaign-schedule-chosen")).toContainText("Ertaga, 10:00 da yuboriladi");

    // 20:00 — reklama taqiqi: backend 23-oktabr 09:00 ga suradi, shu oldindan aytiladi.
    await pick(page, /^Soat/, "20:00");
    await expect(sendTime.getByTestId("campaign-quiet-shift")).toContainText(
      "20:00 reklama taqiqiga tushadi — SMS 23.10.2026, 09:00 da yuboriladi",
    );

    await panel.getByRole("button", { name: "Ko'rib chiqish" }).click();
    const dialog = page.getByRole("alertdialog", { name: "SMS kampaniyani yuborishni tasdiqlang" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("campaign-confirm-shifted")).toContainText(
      "Tungi taqiq sababli 23.10.2026, 09:00 ga surildi",
    );
    await expect(dialog.getByTestId("campaign-confirm-shifted")).toContainText("So'ralgan: Ertaga, 20:00");
    await expect(dialog.getByRole("button", { name: "Yuborish" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Rejalashtirish" }).click();

    await expect(
      panel.getByText(/Kampaniya rejalashtirildi: tungi taqiq sababli 23\.10\.2026, 09:00 ga surildi/),
    ).toBeVisible();
    expect(mock.created).toHaveLength(1);
    expect(mock.created[0].body).toMatchObject({
      message_class: "promo",
      scheduled_at: "2026-10-22T20:00:00+05:00",
    });
    expect(mock.created[0].idempotencyKey).toBeTruthy();

    // Tarix: «Rejalashtirilgan», vaqt va siljish izohi; «Bekor qilish» → tasdiq → POST …/41/cancel.
    const table = page.getByRole("table", { name: "Yuborilgan kampaniyalar" });
    const row = table.getByRole("row").filter({ hasText: "kuzgi chegirma" });
    await expect(row).toContainText("Rejalashtirilgan");
    await expect(row).toContainText("23.10.2026, 09:00 da yuboriladi");
    await expect(row).toContainText("So'ralgan: Ertaga, 20:00 — tungi taqiq sababli surildi");
    await row.getByRole("button", { name: "Bekor qilish" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Kampaniyani bekor qilasizmi?" });
    await expect(confirm).toContainText("23.10.2026, 09:00 da yuborilishi kerak edi");
    await confirm.getByRole("button", { name: "Kampaniyani bekor qilish" }).click();
    await expect(toast(page, "Kampaniya bekor qilindi")).toBeVisible();
    expect(mock.cancelled).toEqual(["41"]);
    await expect(row).toContainText("Bekor qilingan");
    await expect(row.getByRole("button", { name: "Bekor qilish" })).toHaveCount(0);

    expect(base.leaked).toEqual([]);
  });
});
