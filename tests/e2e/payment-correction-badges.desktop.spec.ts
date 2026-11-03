import { expect, test } from "@playwright/test";
import {
  courierCashboxWithCorrection,
  courierCashDetailWithCorrection,
  courierCorrectionDetails,
  historyOverviewWithCorrections,
  marketCashboxWithEdit,
  marketCorrectionDetails,
  OVERVIEW_PAGE_DATA,
  overviewCorrectionDetails,
} from "./support/paymentCorrection";
import { HQ_MANAGER_PROFILE, setupShellSession } from "./support/shellSession";

/**
 * T6-FE-1 (XXyAZ9ge) — kassa tarixida to'lov tuzatish belgilari va «Qaytarish va tahrir» bloki (desktop, 1440):
 *  - kuryer `/cash-box` «To'lov o'tkazmalari» (maket `courier-cashbox-my-transfers-corrected`): so'rovda
 *    `payment_reversal`, «Teskari yozuv» / «Qaytarildi», teskari yozuv tafsiloti — blok, «Bog'liq yozuv» asl to'lovni
 *    shu oynada ochadi (`courier-cashbox-history-detail-corrected`);
 *  - market `/cash-box` (`market-cashbox-my-corrected`): «Tuzatilgan» tepada (tuzatish vaqti, C1), «Tahrirlangan» →
 *    «Bog'liq yozuv» → «Tuzatilgan» (`market-cashbox-history-detail-dialog-corrected`);
 *  - superadmin `/payments` (`superadmin-payments-overview-corrected`) va menejer kuryer kassasi tafsiloti.
 * Faqat o'qish: yozish so'rovi yo'q (`leaked`).
 */
test.use({ viewport: { width: 1440, height: 900 } });

test("kuryer: «To'lov o'tkazmalari» payment_reversal ni so'raydi, belgilar, blok va «Bog'liq yozuv»", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("finance/cashbox/my-cashbox")) requests.push(decodeURIComponent(request.url()));
  });
  const { leaked } = await setupShellSession(page, "courier", "Jasur Tursunov", {
    "finance/cashbox/my-cashbox": courierCashboxWithCorrection(),
    ...courierCorrectionDetails(),
  });
  await page.goto("/cash-box");
  await page.getByRole("tab", { name: "To'lov o'tkazmalari" }).click();
  await expect.poll(() => requests.some((url) => /sourceTypes=[^&]*payment_reversal/.test(url))).toBe(true);

  const table = page.getByRole("table", { name: "Operatsiyalar tarixi" });
  const reversal = table.locator("tr", { hasText: "To'lovni qaytarish" });
  await expect(reversal.locator("[data-payment-correction=reversal]")).toHaveText("Teskari yozuv");
  await expect(reversal).toContainText("#4512 qaytarildi · Shodiyor Ergashev");
  await expect(reversal).not.toContainText("Boshqa kuryer tanlab");
  const original = table.locator("tr", { has: page.locator("[data-payment-correction=reversed]") });
  await expect(original.locator("[data-payment-correction=reversed]")).toHaveText("Qaytarildi");
  await expect(original).toContainText("−1 850 000 so'm");
  await expect(table.locator("[data-payment-correction]")).toHaveCount(2);

  await reversal.getByRole("button", { name: "To'lovni qaytarish", exact: true }).click();
  // Oyna nomi «Bog'liq yozuv» dan keyin o'zgaradi — nom bo'yicha emas, rol bo'yicha.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("Kirim operatsiyasi");
  await expect(dialog).toContainText(/Operatsiyalar tarixi · #4530 · Bugun, \d\d:\d\d/);
  const block = dialog.getByRole("region", { name: "Qaytarish va tahrir" });
  await expect(block).toContainText("To'liq qaytarildi");
  await expect(block).toContainText("Boshqa kuryer tanlab yuborilgan — pul Rustam Qosimovdan olingan");
  await expect(block.getByText("Summa", { exact: true })).toHaveCount(0);
  // C6: teskari yozuvning izohi (= sabab) takrorlanmaydi.
  await expect(dialog.getByText("Izoh", { exact: true })).toHaveCount(0);

  await block.getByRole("button", { name: /^Bog'liq yozuv: asl to'lov, Kuryerdan filialga o'tkazma, Qaytarildi, #4512/ }).click();
  await expect(dialog).toHaveAccessibleName("Chiqim operatsiyasi");
  await expect(dialog).toContainText("Operatsiyalar tarixi · #4512");
  await expect(dialog.locator("[data-payment-correction=reversed]").first()).toHaveText("Qaytarildi");
  await expect(
    dialog.getByRole("button", { name: /^Bog'liq yozuv: To'lovni qaytarish, Teskari yozuv, #4530, \+1 850 000 so'm/ }),
  ).toBeVisible();
  await expect(dialog.getByText("Kunlik topshiriq")).toBeVisible();
  expect(leaked).toEqual([]);
});

test("market: «Tuzatilgan» tepada, «Tahrirlangan» → «Bog'liq yozuv» → «Tuzatilgan»", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "market", "Baraka Shop", {
    "finance/cashbox/my-cashbox": marketCashboxWithEdit(),
    ...marketCorrectionDetails(),
  });
  await page.goto("/cash-box");

  const rows = page.getByRole("table", { name: "Operatsiyalar tarixi" }).locator("tbody tr");
  await expect(rows.nth(0).locator("[data-payment-correction]")).toHaveAttribute("data-payment-correction", "replacement");
  await expect(rows.nth(0)).toContainText("Oktabr, 1-hafta hisobi · #4498 o'rniga");
  await expect(rows.nth(1).locator("[data-payment-correction]")).toHaveText("Teskari yozuv");
  await expect(rows.nth(1)).toContainText("#4498 · summa tahrirlandi");
  await expect(rows.nth(1)).toContainText("+2 400 000 so'm");
  await expect(rows.nth(2).locator("[data-payment-correction]")).toHaveText("Tahrirlangan");
  await expect(rows.nth(2)).toContainText("−2 400 000 so'm");

  await rows.nth(2).getByRole("button", { name: /^HQ'dan marketga o'tkazma, Tahrirlangan \(/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("Chiqim operatsiyasi");
  await expect(dialog).toContainText("Operatsiyalar tarixi · #4498");
  const block = dialog.getByRole("region", { name: "Qaytarish va tahrir" });
  await expect(block).toContainText("Summa tahrirlandi");
  await expect(block).toContainText("2 400 000 so'm → 2 000 000 so'm");
  await expect(block).toContainText("Marketga 2 000 000 so'm o'tkazilgan, summa xato kiritilgan");

  await block.getByRole("button", { name: /^Bog'liq yozuv: HQ'dan marketga o'tkazma, Tuzatilgan, #4522, −2 000 000 so'm/ }).click();
  await expect(dialog).toContainText("Operatsiyalar tarixi · #4522");
  await expect(dialog.locator("[data-payment-correction=replacement]")).toHaveText("Tuzatilgan");
  await expect(
    dialog.getByRole("button", { name: /^Bog'liq yozuv: asl to'lov, HQ'dan marketga o'tkazma, Tahrirlangan, #4498/ }),
  ).toContainText("Asl to'lov · #4498");
  expect(leaked).toEqual([]);
});

test("superadmin /payments: to'rt belgi va havolalar «Manba» ustunida", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "superadmin", "Shodiyor Ergashev", {
    ...OVERVIEW_PAGE_DATA,
    "finance/history": historyOverviewWithCorrections(),
    ...overviewCorrectionDetails(),
  });
  await page.goto("/payments");

  const table = page.getByRole("table", { name: "Operatsiyalar tarixi" });
  await expect(table.locator("[data-payment-correction]")).toHaveText([
    "Teskari yozuv",
    "Tuzatilgan",
    "Teskari yozuv",
    "Qaytarildi",
    "Tahrirlangan",
  ]);
  await expect(table.locator("tbody tr").nth(0)).toContainText("#4511 · Kuryer to'lovi qaytarildi");
  await expect(table.locator("tbody tr").nth(1)).toContainText("Baraka Shop · #4498 o'rniga");
  await expect(table.locator("tbody tr").nth(2)).toContainText("#4498 · summa tahrirlandi");

  await table.getByRole("button", { name: /^Kuryer to'lovi, Qaytarildi \(/ }).click();
  const dialog = page.getByRole("dialog", { name: "Kirim operatsiyasi" });
  await expect(dialog.getByRole("region", { name: "Qaytarish va tahrir" })).toContainText("To'liq qaytarildi");
  await expect(
    dialog.getByRole("button", { name: /^Bog'liq yozuv: To'lovni qaytarish, Teskari yozuv, #4531, −1 850 000 so'm/ }),
  ).toBeVisible();
  expect(leaked).toEqual([]);
});

test("menejer: kuryer kassasi tafsilotida belgilar, «To'lov o'tkazmalari» teskari yozuvni yashirmaydi", async ({ page }) => {
  const { leaked } = await setupShellSession(
    page,
    "manager",
    "Mohira Qodirova",
    { "finance/cashbox/user/263": courierCashDetailWithCorrection(), ...courierCorrectionDetails() },
    HQ_MANAGER_PROFILE,
  );
  await page.goto("/payments/cash-detail/263?type=courier");

  const reversal = page.getByRole("button", { name: /^To'lovni qaytarish, Teskari yozuv, #4512 qaytarildi, Kirim/ });
  await expect(reversal).toBeVisible();
  await page.getByRole("radio", { name: "To'lov o'tkazmalari" }).click();
  await expect(reversal).toBeVisible();
  await expect(page.getByRole("button", { name: /^Kuryerdan filialga o'tkazma, Qaytarildi, Chiqim/ })).toBeVisible();

  await reversal.click();
  const dialog = page.getByRole("dialog", { name: "Kirim operatsiyasi" });
  await expect(dialog.getByRole("region", { name: "Qaytarish va tahrir" })).toContainText("Shodiyor Ergashev");
  expect(leaked).toEqual([]);
});
