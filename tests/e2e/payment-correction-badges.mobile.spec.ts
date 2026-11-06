import { expect, test } from "@playwright/test";
import {
  courierCashboxWithCorrection,
  courierCorrectionDetails,
  historyOverviewWithCorrections,
  marketCashboxWithEdit,
  marketCorrectionDetails,
  OVERVIEW_PAGE_DATA,
  overviewCorrectionDetails,
} from "./support/paymentCorrection";
import { setupShellSession } from "./support/shellSession";

/**
 * T6-FE-1 (XXyAZ9ge) — telefon (390): to'lov tuzatish belgilari kartalarda va tafsilot varag'idagi blok.
 *  - kuryer (maket `courier-cashbox-my-transfers-corrected`): belgi uchinchi qator oxirida, «#4512 qaytarildi · {kim}»;
 *  - market (`market-cashbox-my-corrected`): belgi sarlavha yonida, «#4498 o'rniga · O'tkazma»;
 *  - superadmin `/payments` (`superadmin-payments-overview-corrected`): belgi «Kirim/Chiqim» dan keyin.
 * Gorizontal skroll yo'q; «Bog'liq yozuv» qatori ≥ 44 px.
 */
const noHorizontalScroll = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("kuryer 390: kartada «#4512 qaytarildi · Shodiyor Ergashev» + «Teskari yozuv», varaqada blok", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "courier", "Jasur Tursunov", {
    "finance/cashbox/my-cashbox": courierCashboxWithCorrection(),
    ...courierCorrectionDetails(),
  });
  await page.goto("/cash-box");

  const reversal = page.getByRole("button", {
    name: /^To'lovni qaytarish, Teskari yozuv \(#4512 qaytarildi · Shodiyor Ergashev\)/,
  });
  await expect(reversal).toBeVisible();
  const lastInLine = await reversal.locator("[data-payment-correction]").evaluate(
    (badge) => badge.parentElement?.lastElementChild === badge,
  );
  expect(lastInLine).toBe(true);
  const original = page.getByRole("button", { name: /^Kuryerdan filialga o'tkazma, Qaytarildi \(Qabul qildi: Shodiyor Ergashev · Kunlik topshiriq\)/ });
  await expect(original.locator("[data-payment-correction=reversed]")).toHaveText("Qaytarildi");
  expect(await noHorizontalScroll(page)).toBe(true);

  await original.scrollIntoViewIfNeeded();
  await original.click();
  const sheet = page.getByRole("dialog", { name: "Chiqim operatsiyasi" });
  const block = sheet.getByRole("region", { name: "Qaytarish va tahrir" });
  await expect(block).toContainText("To'liq qaytarildi");
  await expect(block).toContainText("Boshqa kuryer tanlab yuborilgan — pul Rustam Qosimovdan olingan");
  const related = block.getByRole("button", { name: /^Bog'liq yozuv: To'lovni qaytarish, Teskari yozuv, #4530/ });
  const box = await related.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(leaked).toEqual([]);
});

test("market 390: belgi sarlavha yonida, «Tuzatilgan» birinchi; varaqada «Bog'liq yozuv» almashtiradi", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "market", "Baraka Shop", {
    "finance/cashbox/my-cashbox": marketCashboxWithEdit(),
    ...marketCorrectionDetails(),
  });
  await page.goto("/cash-box");

  const replacement = page.getByRole("button", {
    name: /^HQ'dan marketga o'tkazma, Tuzatilgan \(Oktabr, 1-hafta hisobi · #4498 o'rniga\), O'tkazma, Chiqim −2 000 000 so'm/,
  });
  await expect(replacement).toBeVisible();
  await expect(replacement).toContainText("Oktabr, 1-hafta hisobi · #4498 o'rniga · O'tkazma");
  const reversal = page.getByRole("button", { name: /^To'lovni qaytarish, Teskari yozuv \(#4498 · summa tahrirlandi\)/ });
  await expect(reversal).toContainText("+2 400 000 so'm");
  expect(await noHorizontalScroll(page)).toBe(true);

  const edited = page.getByRole("button", { name: /^HQ'dan marketga o'tkazma, Tahrirlangan \(Oktabr, 1-hafta hisobi\)/ });
  await edited.scrollIntoViewIfNeeded();
  await edited.click();
  const sheet = page.getByRole("dialog", { name: "Chiqim operatsiyasi" });
  await expect(sheet.getByRole("region", { name: "Qaytarish va tahrir" })).toContainText("2 400 000 so'm → 2 000 000 so'm");
  await sheet.getByRole("button", { name: /^Bog'liq yozuv: HQ'dan marketga o'tkazma, Tuzatilgan, #4522/ }).click();
  await expect(sheet).toContainText("Operatsiyalar tarixi · #4522");
  await expect(sheet.locator("[data-payment-correction=replacement]")).toHaveText("Tuzatilgan");
  expect(leaked).toEqual([]);
});

test("superadmin 390: kartada belgi «Kirim/Chiqim» dan keyin", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "superadmin", "Shodiyor Ergashev", {
    ...OVERVIEW_PAGE_DATA,
    "finance/history": historyOverviewWithCorrections(),
    ...overviewCorrectionDetails(),
  });
  await page.goto("/payments");

  // Karta nomi ko'rinadigan pastki qatorni ham aytadi (ekran o'quvchi): «… (#4511 · Kuryer to'lovi qaytarildi), Chiqim …».
  const card = page.getByRole("button", {
    name: /^To'lovni qaytarish, Teskari yozuv \(#4511 · Kuryer to'lovi qaytarildi\), Chiqim /,
  });
  await expect(card).toContainText("#4511 · Kuryer to'lovi qaytarildi · Asosiy kassa");
  const previous = await card
    .locator("[data-payment-correction]")
    .evaluate((badge) => badge.previousElementSibling?.textContent ?? "");
  expect(previous).toBe("Chiqim");
  await expect(page.locator("[data-payment-correction]")).toHaveCount(5);
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(leaked).toEqual([]);
});
