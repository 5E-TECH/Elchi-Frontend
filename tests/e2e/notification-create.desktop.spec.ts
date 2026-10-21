import { expect, test, type Page } from "@playwright/test";
import { GROUP_DEEP_LINK, openNotificationGroups } from "./support/notificationGroups";
import { toast } from "./support/toast";

/**
 * NG-B — «Bildirishnoma qo'shish» oynasi (admin, 1440): havola tayyor (QR oq ramkada chapda, qadamlar, ajratgich
 * ostida teskari sanoq `role=timer`, kutish holati), faol ulanish (havola berilmaydi, «o'chiring»), nofaol ulanish
 * (NG-S3: asosiy tugma «Faollashtirish» → ochiq oyna USTIDA tasdiq; Esc — fokus tugmaga qaytadi; tasdiqda faqat
 * `PATCH {is_active: true}`, oyna yopiladi). 390 — `notification-create.mobile.spec.ts`.
 */
test.describe.configure({ timeout: 180_000 });

const openCreateDialog = async (page: Page) => {
  await page.getByRole("button", { name: "Bildirishnoma qo'shish" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Bildirishnoma qo'shish" });
  await expect(dialog).toBeVisible();
  return dialog;
};

const pickMarket = async (page: Page, name: string) => {
  await page.getByRole("combobox", { name: /^Market/ }).click();
  await page.getByRole("option", { name: new RegExp(name) }).click();
};

test("⭐ havola tayyor: QR chapda oq ramkada, qadamlar, sanoq ajratgich ostida, «Telegram'da ochish»", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const mock = await openNotificationGroups(page);
  const dialog = await openCreateDialog(page);

  await pickMarket(page, "Bahor Kiyim");
  await dialog.getByRole("button", { name: "Ulash havolasini olish" }).click();

  const section = dialog.getByRole("region", { name: "Bir martalik havola tayyor" });
  await expect(section).toBeVisible();
  expect(mock.linkRequests).toEqual([{ purpose: "market_group", group_type: "create", market_id: "52" }]);
  await expect(section.getByText("Havolani oching yoki QR kodni Telegram bor telefonda skanerlang.")).toBeVisible();

  const timer = section.getByRole("timer");
  await expect(timer).toHaveText(/^(10:00|9:\d{2}) qoldi$/);
  await expect(section.getByText(/^· \d{2}:\d{2} gacha amal qiladi$/)).toBeVisible();
  await expect(section.getByRole("progressbar")).toHaveCount(0);
  await expect(section.getByRole("status")).toHaveText("Guruh ulanishi kutilmoqda…");

  // QR desktopda qadamlar chapida; oq ramka (tungi mavzuda ham oq).
  const qr = section.getByRole("img", { name: "Telegram guruhini ulash havolasining QR kodi" });
  const qrBox = (await qr.boundingBox())!;
  const titleBox = (await section.getByRole("heading", { name: "Bir martalik havola tayyor" }).boundingBox())!;
  expect(qrBox.x + qrBox.width).toBeLessThan(titleBox.x);
  expect(Math.round(qrBox.width)).toBe(156);
  expect(await qr.evaluate((node) => getComputedStyle(node.parentElement!).backgroundColor)).toBe("rgb(255, 255, 255)");

  // Sanoq qatori ajratgich (border-top) ostida, qadamlardan keyin.
  const divider = timer.locator("xpath=ancestor::div[1]");
  expect(await divider.evaluate((node) => getComputedStyle(node).borderTopWidth)).toBe("1px");

  // Bir soniyadan keyin sanoq kamayadi.
  const before = await timer.textContent();
  await expect.poll(async () => timer.textContent(), { timeout: 5_000 }).not.toBe(before);

  await expect(dialog.getByRole("link", { name: "Telegram'da ochish" })).toHaveAttribute("href", GROUP_DEEP_LINK);
});

test("⭐ faol ulanish: havola berilmaydi, «avval eskisini ro'yxatdan o'chiring», tugma o'chiq", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const mock = await openNotificationGroups(page);
  const dialog = await openCreateDialog(page);

  await pickMarket(page, "Baraka Shop");
  await dialog.getByText("Bekor qilinganlar guruhi").click();

  const alert = dialog.getByRole("alert");
  await expect(alert).toContainText("Bu turdagi guruh allaqachon ulangan");
  await expect(alert).toContainText("ID: -1002184736577");
  await expect(alert).toContainText("avval eskisini ro'yxatdan o'chiring");
  await expect(alert).not.toContainText("tahrirla");
  await expect(dialog.getByRole("button", { name: "Ulash havolasini olish" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Faollashtirish" })).toHaveCount(0);
  expect(mock.linkRequests).toEqual([]);
});

test("⭐ nofaol ulanish (NG-S3): «Faollashtirish» → oyna ustida tasdiq; Esc → fokus qaytadi; tasdiq → PATCH, oyna yopiladi", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const mock = await openNotificationGroups(page);
  const dialog = await openCreateDialog(page);

  await pickMarket(page, "Nur Elektronika");
  const alert = dialog.getByRole("alert");
  await expect(alert).toContainText("Bu turdagi guruh ulangan, lekin nofaol");
  await expect(alert).toContainText("Nur Elektronika uchun bu turdagi guruh nofaol (ID: -1001937420815)");
  await expect(alert).not.toContainText("chiqarilgan");
  await expect(dialog.getByRole("button", { name: "Ulash havolasini olish" })).toHaveCount(0);

  const activate = dialog.getByRole("button", { name: "Faollashtirish" });
  await activate.click();
  const confirm = page.getByRole("alertdialog", { name: "Faollashtirishni tasdiqlang" });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("Bot guruhda ekanini tekshiring");
  await expect(confirm).toContainText("Guruh ID: -1001937420815");

  // Esc faqat ustki oynani yopadi — qo'shish oynasi qoladi, fokus «Faollashtirish» ga qaytadi.
  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(activate).toBeFocused();
  expect(mock.patches).toEqual([]);

  await activate.click();
  await confirm.getByRole("button", { name: "Faollashtirish" }).click();
  await expect(toast(page, "Guruh faollashtirildi", { tone: "success" })).toBeVisible();
  await expect(dialog).toBeHidden();
  expect(mock.patches).toEqual([{ id: "8", body: { is_active: true } }]);
  expect(mock.linkRequests).toEqual([]);
  const row = page.getByRole("row").filter({ hasText: "-1001937420815" });
  await expect(row.getByText("Faol", { exact: true })).toBeVisible();
});

test("⭐ TOZ-1: kompyuter soati 1 soat oldinda — havola darhol «eskirgan» emas, sanoq 10 daqiqadan", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openNotificationGroups(page, { linkExpiresInMs: -60 * 60_000 });
  const dialog = await openCreateDialog(page);

  await pickMarket(page, "Bahor Kiyim");
  await dialog.getByRole("button", { name: "Ulash havolasini olish" }).click();

  const section = dialog.getByRole("region", { name: "Bir martalik havola tayyor" });
  await expect(section).toBeVisible();
  await expect(section.getByRole("timer")).toHaveText(/^(10:00|9:\d{2}) qoldi$/);
  await expect(dialog.getByText("Havola muddati tugadi")).toHaveCount(0);
  await expect(dialog.getByRole("link", { name: "Telegram'da ochish" })).toHaveAttribute("href", GROUP_DEEP_LINK);
});

test("⭐ TOZ-1: kompyuter soati 3 daqiqa ortda — sanoq 13 daqiqadan, «10:00» da qotmaydi", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openNotificationGroups(page, { linkExpiresInMs: 13 * 60_000 });
  const dialog = await openCreateDialog(page);

  await pickMarket(page, "Bahor Kiyim");
  await dialog.getByRole("button", { name: "Ulash havolasini olish" }).click();

  const section = dialog.getByRole("region", { name: "Bir martalik havola tayyor" });
  await expect(section.getByRole("timer")).toHaveText(/^(13:00|12:\d{2}) qoldi$/);
});

test("⭐ TOZ-1: server `expires_at` bermasa — 10 daqiqalik sanoq, «NaN» yo'q", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openNotificationGroups(page, { linkExpiresInMs: null });
  const dialog = await openCreateDialog(page);

  await pickMarket(page, "Bahor Kiyim");
  await dialog.getByRole("button", { name: "Ulash havolasini olish" }).click();

  const section = dialog.getByRole("region", { name: "Bir martalik havola tayyor" });
  await expect(section.getByRole("timer")).toHaveText(/^(10:00|9:\d{2}) qoldi$/);
  await expect(section.getByText(/NaN/)).toHaveCount(0);
  await expect(dialog.getByRole("link", { name: "Telegram'da ochish" })).toHaveAttribute("href", GROUP_DEEP_LINK);
});
