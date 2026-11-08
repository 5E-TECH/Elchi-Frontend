import { expect, test, type Page } from "@playwright/test";
import { correctionPageData, mockCorrectionPosts } from "./support/paymentCorrectionActions";
import { setupShellSession } from "./support/shellSession";

/**
 * T6-FE-2 (N2) — superadmin `/payments` tarix tafsilotidan «Qaytarish» va «Summani tahrirlash» (desktop, 1440;
 * maketlar `superadmin-payments-history-detail-dialog-correctable`, `…-reverse-*`, `…-correct-amount-*`, `…-locked`):
 *  - forma → tasdiq → `POST finance/history/:id/reverse` tana aynan `{ reason }` + `Idempotency-Key`, xabar, hamma oyna
 *    yopiladi;
 *  - SHIFT_REQUIRED va 504 tasdiq oynasida qoladi, qayta bosish — o'sha kalit;
 *  - AMOUNT_EXCEEDS — «Tahrirlash» o'chiq, «Orqaga» dan keyin maydonda «Ko'pi bilan …»;
 *  - muddati o'tgan to'lov — qulf izohi va «Muddatni o'zgartirish».
 */
test.use({ viewport: { width: 1440, height: 900 } });

const REASON = "Boshqa kuryer tanlab yuborilgan — pul Rustam Qosimovdan olingan";

const openDetail = async (page: Page, title: string, index = 0) => {
  await page
    .getByRole("table", { name: "Operatsiyalar tarixi" })
    .getByRole("button", { name: title, exact: true })
    .nth(index)
    .click();
};

test("«Qaytarish»: forma, tasdiq, tana va kalit, «To'lov qaytarildi», hamma oyna yopiladi", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "superadmin", "Shodiyor Ergashev", correctionPageData());
  const { posts } = await mockCorrectionPosts(page);
  await page.goto("/payments");
  await openDetail(page, "Kuryer to'lovi");

  const detail = page.getByRole("dialog", { name: "Kirim operatsiyasi" });
  await expect(detail).toContainText(/Qaytarish yoki tahrirlash mumkin: \d\d\.\d\d\.\d{4},\s\d\d:\d\d\sgacha · muddat 30 kun/);
  await detail.getByRole("button", { name: "Qaytarish" }).click();
  await expect(detail).toBeHidden();

  const form = page.getByRole("dialog", { name: "To'lovni qaytarish" });
  await expect(form).toContainText("Pul teskari yo'nalishda qaytadi: asosiy kassadan Jasur Tursunov kassasiga.");
  const continueButton = form.getByRole("button", { name: "Davom etish" });
  await expect(continueButton).toBeDisabled();
  await form.getByRole("textbox", { name: /^Sabab/ }).fill(`  ${REASON}  `);
  await continueButton.click();

  const confirm = page.getByRole("alertdialog", { name: "To'lovni qaytarishni tasdiqlang" });
  await expect(confirm).toContainText("Jasur Tursunov kassasiga 1 850 000 so'm qaytadi");
  await expect(confirm).toContainText("Qaytarishni bekor qilib bo'lmaydi.");
  await confirm.getByRole("button", { name: "Qaytarish" }).click();

  await expect(page.getByText("To'lov qaytarildi", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(posts).toHaveLength(1);
  expect(posts[0].path).toBe("finance/history/4512/reverse");
  expect(posts[0].body).toEqual({ reason: REASON });
  expect(posts[0].key).toBeTruthy();
  expect(leaked).toEqual([]);
});

test("SHIFT_REQUIRED va 504 tasdiq oynasida qoladi; qayta bosish — o'sha `Idempotency-Key`", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "superadmin", "Shodiyor Ergashev", correctionPageData());
  const { posts } = await mockCorrectionPosts(page, [
    { status: 400, body: { statusCode: 400, message: "Smena ochilmagan", code: "SHIFT_REQUIRED" } },
    { status: 504, body: { statusCode: 504, message: "Gateway Timeout" } },
  ]);
  await page.goto("/payments");
  await openDetail(page, "Kuryer to'lovi");
  await page.getByRole("dialog", { name: "Kirim operatsiyasi" }).getByRole("button", { name: "Qaytarish" }).click();
  const form = page.getByRole("dialog", { name: "To'lovni qaytarish" });
  await form.getByRole("textbox", { name: /^Sabab/ }).fill(REASON);
  await form.getByRole("button", { name: "Davom etish" }).click();

  const confirm = page.getByRole("alertdialog", { name: "To'lovni qaytarishni tasdiqlang" });
  const confirmButton = confirm.getByRole("button", { name: "Qaytarish" });
  await confirmButton.click();
  const alert = confirm.getByRole("alert");
  await expect(alert).toContainText("Smena ochilmagan");
  await expect(alert.getByRole("button", { name: "Smenani ochish" })).toBeVisible();
  await expect(confirmButton).toBeEnabled();

  await confirmButton.click();
  await expect(alert).toContainText("Internet aloqasi yo'q");
  await expect(alert).toContainText("to'lov ikki marta qaytarilmaydi");
  await expect(page.getByText("Tarmoq xatosi")).toHaveCount(0);

  await confirmButton.click();
  await expect(page.getByText("To'lov qaytarildi", { exact: true })).toBeVisible();
  expect(posts).toHaveLength(3);
  expect(new Set(posts.map((post) => post.key)).size).toBe(1);
  expect(leaked).toEqual([]);
});

test("«Summani tahrirlash»: AMOUNT_EXCEEDS — tugma o'chiq, «Orqaga» dan keyin maydon xatosi; to'g'ri summa — «Summa tuzatildi»", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "superadmin", "Shodiyor Ergashev", correctionPageData());
  const { posts } = await mockCorrectionPosts(page, [
    { status: 409, body: { statusCode: 409, message: "Summa chegaradan oshdi", code: "AMOUNT_EXCEEDS", max: 7_220_000 } },
  ]);
  await page.goto("/payments");
  await openDetail(page, "Market to'lovi");
  await page.getByRole("dialog", { name: "Chiqim operatsiyasi" }).getByRole("button", { name: "Summani tahrirlash" }).click();

  const form = page.getByRole("dialog", { name: "Summani tahrirlash" });
  const amount = form.getByRole("textbox", { name: /^To'g'ri summa/ });
  await amount.fill("20000000");
  await expect(form).toContainText("+17 600 000 so'm");
  await form.getByRole("textbox", { name: /^Sabab/ }).fill("Marketga 2 000 000 so'm o'tkazilgan, summa xato kiritilgan");
  await form.getByRole("button", { name: "Davom etish" }).click();

  const confirm = page.getByRole("alertdialog", { name: "Summani tahrirlashni tasdiqlang" });
  await confirm.getByRole("button", { name: "Tahrirlash" }).click();
  await expect(confirm.getByRole("alert")).toContainText("Ko'pi bilan 7 220 000 so'm");
  await expect(confirm.getByRole("button", { name: "Tahrirlash" })).toBeDisabled();
  await confirm.getByRole("button", { name: "Orqaga" }).click();
  await expect(confirm).toBeHidden();

  await expect(form.getByText("Ko'pi bilan 7 220 000 so'm")).toBeVisible();
  await expect(form.getByRole("button", { name: "Davom etish" })).toBeDisabled();
  await amount.fill("2000000");
  await form.getByRole("button", { name: "Davom etish" }).click();
  await page.getByRole("alertdialog", { name: "Summani tahrirlashni tasdiqlang" }).getByRole("button", { name: "Tahrirlash" }).click();

  await expect(page.getByText("Summa tuzatildi", { exact: true })).toBeVisible();
  await expect(page.getByText("#4498: 2 400 000 → 2 000 000 so'm. Marketga xabar yuborildi.", { exact: true })).toBeVisible();
  expect(posts.map((post) => post.body)).toEqual([
    { new_amount: 20_000_000, reason: "Marketga 2 000 000 so'm o'tkazilgan, summa xato kiritilgan" },
    { new_amount: 2_000_000, reason: "Marketga 2 000 000 so'm o'tkazilgan, summa xato kiritilgan" },
  ]);
  expect(posts[1].key).not.toBe(posts[0].key);
  expect(posts[1].path).toBe("finance/history/4498/correct-amount");
  expect(leaked).toEqual([]);
});

test("muddati o'tgan to'lov: qulf izohi, «Muddatni o'zgartirish» → sozlamalar, tugmalar yo'q", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "superadmin", "Shodiyor Ergashev", correctionPageData());
  await page.goto("/payments");
  await openDetail(page, "Market to'lovi", 1);
  const detail = page.getByRole("dialog", { name: "Chiqim operatsiyasi" });
  const note = detail.getByRole("note");
  await expect(note).toContainText("Muddat tugagan: 02.10.2026, 17:30");
  await expect(note).toContainText("To'lovni 30 kun ichida qaytarish yoki summasini tahrirlash mumkin edi.");
  await expect(detail.getByRole("button", { name: "Qaytarish" })).toHaveCount(0);
  await expect(detail.getByRole("button", { name: "Summani tahrirlash" })).toHaveCount(0);
  await note.getByRole("link", { name: "Muddatni o'zgartirish" }).click();
  await expect(page).toHaveURL(/\/payments\/shift-settings$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(leaked).toEqual([]);
});
