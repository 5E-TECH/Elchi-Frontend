import { expect, test } from "@playwright/test";
import { mockShiftAutoReport } from "./support/shiftAutoReport";

/**
 * y8Tqm9Ap + gWI4gYkw (1440): smena sozlamalarida «Avtomatik yopish» va «Smena hisobotini yuborish» — PATCH faqat
 * o'zgarganlar; bildirishnoma havolasi /payments/shift-report/31 → hisobot: sariq «Avtomatik yopildi» banneri,
 * «Hisobot kimlarga yuborildi», PDF havolasi, «Hisobotni qayta yuborish» (tasdiq bilan).
 */
test("superadmin: avtomatik yopish va hisobot yuborish sozlamalari saqlanadi", async ({ page }) => {
  const mock = await mockShiftAutoReport(page);
  await page.goto("/payments/shift-settings");
  await expect(page.getByRole("heading", { name: "Avtomatik yopish" })).toBeVisible();

  await page.getByRole("switch", { name: "Smenani avtomatik yopish" }).click();
  await page.getByRole("button", { name: "Vaqt qo'shish" }).click();
  await page.getByRole("option", { name: "14:00" }).click();
  const times = page.getByRole("list", { name: "Kuniga yopish vaqtlari" });
  await expect(times.getByRole("listitem")).toHaveText(["14:00", "23:00"]);
  await page.getByText("Asosiy kassa va filial kassalari").click();

  const recipients = page.getByRole("table", { name: "Hisobot qabul qiluvchilari" });
  await recipients.getByRole("switch", { name: "Kuryerlar: Telegram" }).click();
  await recipients.getByRole("switch", { name: "Kuryerlar: tizim bildirishnomasi" }).click();
  await page.getByRole("radio", { name: "Excel" }).click();

  await page.getByRole("button", { name: "Saqlash" }).click();
  // Xabar (toast) — ko'rinadigan matn + ekran o'quvchi nusxasi.
  await expect(page.getByText("Sozlamalar saqlandi", { exact: true }).first()).toBeVisible();
  expect(mock.patches).toEqual([
    {
      auto_close: { enabled: true, times: ["14:00", "23:00"], scope: "main+branches" },
      report: { recipients: { couriers: { telegram: true, in_app: true } }, format: "xlsx" },
    },
  ]);
  // Server qiymatlari bilan forma qayta boshlanadi — o'zgarish yo'q, «Saqlash» o'chiq.
  await expect(page.getByRole("button", { name: "Saqlash" })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(mock.leaked).toEqual([]);
});

test("superadmin: bildirishnoma havolasi → avtomatik yopilgan smena hisoboti, yuborilganlar va qayta yuborish", async ({ page }) => {
  const mock = await mockShiftAutoReport(page);
  await page.goto("/payments/shift-report/31");
  await expect(page).toHaveURL(/\/payments\/shifts\/31$/);
  await expect(page.getByRole("heading", { level: 1, name: "Smena hisoboti" })).toBeVisible();

  const banner = page.getByTestId("shift-auto-closed");
  await expect(banner).toContainText(/Avtomatik yopildi — \d{2}:\d{2}, kassir yopmagan/);
  await expect(banner).toContainText("Shodiyor Ergashev");

  const list = page.getByRole("list", { name: "Hisobot kimlarga yuborildi" });
  await expect(list.getByTestId("shift-delivery-superadmin")).toContainText("Bosh admin · to'liq hisobot va PDF");
  const couriers = list.getByTestId("shift-delivery-courier");
  await expect(couriers).toContainText("Kuryerlar · 2 ta");
  await expect(couriers).toContainText("Telegram 1 / 2");
  await expect(couriers).toContainText("Bekzod Aliyev — Telegram: Telegram ulanmagan");
  await expect(page.getByRole("link", { name: "PDF" })).toHaveAttribute("href", "https://files.example/shift-31.pdf");

  await page.getByRole("button", { name: "Hisobotni qayta yuborish" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Hisobotni qayta yuborasizmi?" });
  await confirm.getByRole("button", { name: "Qayta yuborish" }).click();
  await expect(page.getByText("Hisobot qayta yuborildi", { exact: true }).first()).toBeVisible();
  expect(mock.resends).toBe(1);
  await expect(page.getByText(/· 2-raund/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(mock.leaked).toEqual([]);
});
