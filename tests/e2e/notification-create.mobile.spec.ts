import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalOverflow, openNotificationGroups } from "./support/notificationGroups";
import { tapTargets, tooSmall } from "./support/tapTargets";

/**
 * NG-B — «Bildirishnoma qo'shish» oynasi telefonda (390, admin): pastki varaqa; havola tayyor — QR qadamlar va
 * sanoqdan KEYIN, markazda (havola tugmasi asosiy yo'l); nofaol ulanishda «Faollashtirish» ≥ 44 px va tasdiq
 * oynasi; kichik nishon va gorizontal oqib ketish yo'q.
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

test("⭐ 390: havola tayyor — QR sanoqdan keyin markazda, nishonlar ≥ 44 px, oqib ketish yo'q", async ({ page }) => {
  await openNotificationGroups(page);
  const dialog = await openCreateDialog(page);

  await pickMarket(page, "Bahor Kiyim");
  await dialog.getByRole("button", { name: "Ulash havolasini olish" }).click();
  const section = dialog.getByRole("region", { name: "Bir martalik havola tayyor" });
  await expect(section).toBeVisible();

  const qr = section.getByRole("img", { name: "Telegram guruhini ulash havolasining QR kodi" });
  await qr.scrollIntoViewIfNeeded();
  // Bitta lahzada o'lchanadi (varaqa ichidagi skroll o'lchovlar orasida siljitmasin).
  const boxes = await section.evaluate((node) => {
    const rect = (el: Element | null) => el!.getBoundingClientRect().toJSON() as DOMRect;
    return {
      section: rect(node),
      timer: rect(node.querySelector("[role=timer]")),
      status: rect(node.querySelector("[role=status]")),
      qr: rect(node.querySelector("img")),
    };
  });
  expect(boxes.qr.y).toBeGreaterThan(boxes.timer.y);
  expect(boxes.qr.y).toBeGreaterThan(boxes.status.y);
  // Markazda (±2 px).
  const qrCenter = boxes.qr.x + boxes.qr.width / 2;
  const sectionCenter = boxes.section.x + boxes.section.width / 2;
  expect(Math.abs(qrCenter - sectionCenter)).toBeLessThanOrEqual(2);

  // Varaqa ekran tagiga yopishgan.
  const dialogBox = (await dialog.boundingBox())!;
  expect(Math.round(dialogBox.y + dialogBox.height)).toBeGreaterThanOrEqual(844 - 1);

  const open = dialog.getByRole("link", { name: "Telegram'da ochish" });
  const openBox = (await open.boundingBox())!;
  expect(openBox.height).toBeGreaterThanOrEqual(44);
  expect(tooSmall(await tapTargets(page))).toEqual([]);
  await expectNoHorizontalOverflow(page);
});

test("⭐ 390: nofaol ulanish — «Faollashtirish» ≥ 44 px, tasdiq oynasi ochiladi", async ({ page }) => {
  await openNotificationGroups(page);
  const dialog = await openCreateDialog(page);

  await pickMarket(page, "Nur Elektronika");
  await expect(dialog.getByRole("alert")).toContainText("Bu turdagi guruh ulangan, lekin nofaol");
  const activate = dialog.getByRole("button", { name: "Faollashtirish" });
  const box = (await activate.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(tooSmall(await tapTargets(page))).toEqual([]);
  await expectNoHorizontalOverflow(page);

  await activate.click();
  await expect(page.getByRole("alertdialog", { name: "Faollashtirishni tasdiqlang" })).toBeVisible();
});

test("⭐ 390 · TOZ-1: kompyuter soati 1 soat oldinda — havola amalda, sanoq 10 daqiqadan, oqib ketish yo'q", async ({ page }) => {
  await openNotificationGroups(page, { linkExpiresInMs: -60 * 60_000 });
  const dialog = await openCreateDialog(page);

  await pickMarket(page, "Bahor Kiyim");
  await dialog.getByRole("button", { name: "Ulash havolasini olish" }).click();
  const section = dialog.getByRole("region", { name: "Bir martalik havola tayyor" });
  await expect(section).toBeVisible();
  await expect(section.getByRole("timer")).toHaveText(/^(10:00|9:\d{2}) qoldi$/);
  await expect(dialog.getByText("Havola muddati tugadi")).toHaveCount(0);
  expect((await dialog.getByRole("link", { name: "Telegram'da ochish" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expectNoHorizontalOverflow(page);
});
