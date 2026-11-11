import { expect, test } from "@playwright/test";
import { mockShiftAutoReport } from "./support/shiftAutoReport";

/**
 * T6-FE-3 (2wgTzcG0), 1440: «To'lovlarni tuzatish muddati» kartasi smena sozlamalarida — sahifadagi yagona «Saqlash»
 * faqat muddat PATCH'ini yuboradi, `window_days` — JSON son; «Boshqa» da 1–365 dan tashqari son — xato va «Saqlash»
 * o'chiq; server qiymati 7/10/30 dan boshqa bo'lsa «Boshqa» + son. Soxta backend PATCH'ni backenddek tekshiradi
 * (satr yoki 0 / 400 → 400).
 */
test.use({ viewport: { width: 1440, height: 900 }, timezoneId: "Asia/Tashkent" });

const noOverflow = () => document.documentElement.scrollWidth <= window.innerWidth;

test("superadmin: «7 kun» → «Saqlash» — PATCH { window_days: 7 } (son), xabar va «Oxirgi o'zgarish»", async ({ page }) => {
  const mock = await mockShiftAutoReport(page);
  await page.goto("/payments/shift-settings");
  const card = page.getByRole("region", { name: "To'lovlarni tuzatish muddati" });
  await expect(card.getByRole("radio", { name: "30 kun" })).toHaveAttribute("aria-checked", "true");
  await expect(card.getByText("Sukut qiymati — hali hech kim o'zgartirmagan")).toBeVisible();
  const save = page.getByRole("button", { name: "Saqlash" });
  await expect(save).toBeDisabled();

  await card.getByRole("radio", { name: "7 kun" }).click();
  await expect(save).toBeEnabled();
  await save.click();

  await expect(page.getByText("Sozlamalar saqlandi", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("To'lovlarni tuzatish muddati: 7 kun.", { exact: true }).first()).toBeVisible();
  expect(mock.correctionPatches).toEqual([{ window_days: 7 }]);
  expect(mock.patches).toEqual([]);
  // Sozlama qayta o'qildi: «7 kun» serverdan, «Saqlash» o'chiq, muallif ismi users/:id dan.
  await expect(card.getByText(/^Oxirgi o'zgarish: Shodiyor Ergashev · Bugun, \d{2}:\d{2}$/)).toBeVisible();
  await expect(card.getByRole("radio", { name: "7 kun" })).toHaveAttribute("aria-checked", "true");
  await expect(save).toBeDisabled();
  expect(await page.evaluate(noOverflow)).toBe(true);
  expect(mock.leaked).toEqual([]);
});

test("superadmin: «Boshqa» — 400 xato va «Saqlash» o'chiq, 45 → PATCH { window_days: 45 }", async ({ page }) => {
  const mock = await mockShiftAutoReport(page);
  await page.goto("/payments/shift-settings");
  const card = page.getByRole("region", { name: "To'lovlarni tuzatish muddati" });
  const save = page.getByRole("button", { name: "Saqlash" });

  await card.getByRole("radio", { name: "Boshqa" }).click();
  const days = card.getByRole("textbox", { name: "Kunlar soni" });
  await expect(days).toHaveValue("30");
  await expect(days).toBeFocused();
  await expect(card.getByText("1 dan 365 gacha", { exact: true })).toBeVisible();

  await days.fill("400");
  await expect(card.getByText("1 dan 365 gacha butun son kiriting")).toBeVisible();
  await expect(days).toHaveAttribute("aria-invalid", "true");
  await expect(save).toBeDisabled();

  await days.fill("45");
  await expect(card.getByText("1 dan 365 gacha butun son kiriting")).toHaveCount(0);
  await save.click();
  await expect(page.getByText("To'lovlarni tuzatish muddati: 45 kun.", { exact: true }).first()).toBeVisible();
  expect(mock.correctionPatches).toEqual([{ window_days: 45 }]);
  expect(mock.correction.window_days).toBe(45);
  await expect(save).toBeDisabled();
  await expect(card.getByRole("radio", { name: "Boshqa" })).toHaveAttribute("aria-checked", "true");
  expect(mock.leaked).toEqual([]);
});

test("superadmin: server qiymati 45 — «Boshqa» + 45; smena va muddat birga o'zgarsa ikkala PATCH, bitta xabar", async ({ page }) => {
  const mock = await mockShiftAutoReport(page, {
    correction: { window_days: 45, updated_by: "7", updated_at: "2026-10-01T05:15:00.000Z" },
  });
  await page.goto("/payments/shift-settings");
  const card = page.getByRole("region", { name: "To'lovlarni tuzatish muddati" });
  await expect(card.getByRole("radio", { name: "Boshqa" })).toHaveAttribute("aria-checked", "true");
  await expect(card.getByRole("textbox", { name: "Kunlar soni" })).toHaveValue("45");
  await expect(card.getByText("Oxirgi o'zgarish: Shodiyor Ergashev · 01.10.2026, 10:15")).toBeVisible();

  // Avtomatik yopish 2026-11-10 dan Ops → «Kun tartibi»da — smena PATCH'i hisobot kaliti bilan.
  await page
    .getByRole("table", { name: "Hisobot qabul qiluvchilari" })
    .getByRole("switch", { name: "Kuryerlar: Telegram" })
    .click();
  await card.getByRole("radio", { name: "10 kun" }).click();
  await expect(card.getByRole("textbox", { name: "Kunlar soni" })).toHaveCount(0);
  await page.getByRole("button", { name: "Saqlash" }).click();

  await expect(page.getByText("To'lovlarni tuzatish muddati: 10 kun.", { exact: true }).first()).toBeVisible();
  expect(mock.patches).toEqual([{ report: { recipients: { couriers: { telegram: true } } } }]);
  expect(mock.correctionPatches).toEqual([{ window_days: 10 }]);
  expect(mock.leaked).toEqual([]);
});
