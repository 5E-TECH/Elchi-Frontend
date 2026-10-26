import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, mockSmsCampaignApi } from "./support/smsCampaign";
import { NOON_TASHKENT, mockSmsScheduleApi } from "./support/smsCampaignSchedule";
import { tapTargets, tooSmall } from "./support/tapTargets";
import { toast } from "./support/toast";

/**
 * KM-6 (2aS7PFX0) — telefonda (390): «Belgilangan vaqtda» sana va soat ustma-ust, rejalashtirish (SOXTA), tarix
 * kartasida «Rejalashtirilgan» + «Bekor qilish»; bekor qilish 409 — «allaqachon boshlangan yoki rejalashtirilmagan».
 * Gorizontal toshish yo'q, bosiladigan har narsa ≥ 44 px. Hech narsa yuborilmaydi.
 */
test.describe.configure({ timeout: 180_000 });

test("⭐ 390: rejalashtirish, tarix kartasi va bekor qilish 409; toshish yo'q, nishonlar ≥ 44 px", async ({ page }) => {
  await page.clock.setFixedTime(NOON_TASHKENT);
  const base = await mockSmsCampaignApi(page);
  const mock = await mockSmsScheduleApi(page);
  mock.cancelStatus = 409;
  await page.goto("/notifications/sms");
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByTestId("sms-meter")).toBeVisible({ timeout: 60_000 });

  await panel.getByRole("textbox", { name: "Xabar matni" }).fill("Elchi: kuzgi chegirma 20%");
  await panel.getByRole("textbox", { name: "Telefon raqamlari (har qatorda bittadan)" }).fill("+998901111111");

  const sendTime = panel.getByTestId("campaign-send-time");
  await sendTime.getByRole("radio", { name: /Belgilangan vaqtda/ }).check();
  await expect(sendTime.getByTestId("campaign-schedule-chosen")).toContainText("Ertaga, 10:00 da yuboriladi");
  // Telefonda «Sana» va «Soat» ustma-ust.
  // Yorliqlar «Sana *» / «Soat *» (majburiy belgi bilan) — maydonlarning o'zi solishtiriladi.
  const day = (await sendTime.getByRole("button", { name: /^Sana/ }).boundingBox())!;
  const time = (await sendTime.getByRole("combobox", { name: "Soat" }).boundingBox())!;
  expect(time.y).toBeGreaterThan(day.y);
  expect(Math.abs(time.x - day.x)).toBeLessThan(2);
  expect(tooSmall(await tapTargets(page))).toEqual([]);
  await expectNoHorizontalOverflow(page);

  await panel.getByRole("button", { name: "Ko'rib chiqish" }).click();
  const dialog = page.getByRole("alertdialog", { name: "SMS kampaniyani yuborishni tasdiqlang" });
  await expect(dialog).toContainText("Ertaga, 10:00 da yuboriladi");
  await dialog.getByRole("button", { name: "Rejalashtirish" }).click();
  await expect(panel.getByText(/Kampaniya rejalashtirildi: ertaga, 10:00 da yuboriladi/)).toBeVisible();
  expect(mock.created[0].body).toMatchObject({ scheduled_at: "2026-10-22T10:00:00+05:00" });

  // Tarix kartasi: holat, vaqt va «Bekor qilish»; backend 409 — tushunarli xabar, holat yangilanadi.
  const card = page.getByRole("list", { name: "Yuborilgan kampaniyalar" }).getByRole("listitem").first();
  await expect(card).toContainText("Rejalashtirilgan");
  await expect(card).toContainText("Ertaga, 10:00 da yuboriladi");
  await card.getByRole("button", { name: "Bekor qilish" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Kampaniyani bekor qilasizmi?" });
  await confirm.getByRole("button", { name: "Kampaniyani bekor qilish" }).click();
  await expect(
    toast(page, "Bekor qilib bo'lmadi: kampaniya allaqachon boshlangan yoki rejalashtirilmagan"),
  ).toBeVisible();
  expect(mock.cancelled).toEqual(["41"]);
  await expect(card).toContainText("Navbatga qo'yilgan");
  await expect(card.getByRole("button", { name: "Bekor qilish" })).toHaveCount(0);

  await expectNoHorizontalOverflow(page);
  expect(base.leaked).toEqual([]);
});
