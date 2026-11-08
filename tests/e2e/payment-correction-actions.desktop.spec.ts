import { expect, test, type Page } from "@playwright/test";
import { correctionPageData, mockCorrectionPosts, mockCorrectionShift } from "./support/paymentCorrectionActions";
import { setupShellSession } from "./support/shellSession";

/**
 * T6-FE-2 (N2) — superadmin `/payments` tarix tafsilotidan «Qaytarish» va «Summani tahrirlash» (desktop, 1440;
 * maketlar `superadmin-payments-history-detail-dialog-correctable`, `…-reverse-*`, `…-correct-amount-*`, `…-locked`):
 *  - forma → tasdiq → `POST finance/history/:id/reverse` tana aynan `{ reason }` + `Idempotency-Key`, xabar, hamma oyna
 *    yopiladi;
 *  - «Bekor qilish» — tafsilotga qaytadi;
 *  - SHIFT_REQUIRED va 504 tasdiq oynasida qoladi, qayta bosish — o'sha kalit va tana (backend 200 `idempotent`);
 *  - «Smenani ochish» — smena oynasi tasdiq ustida, ochilgach tasdiqqa qaytadi;
 *  - AMOUNT_EXCEEDS — «Tahrirlash» o'chiq, «Orqaga» dan keyin maydonda «Ko'pi bilan …»;
 *  - ALREADY_CORRECTED — neytral quti, ro'yxat yangilanadi, «Orqaga» butun oqimni yopadi (ega qarori 2026-11-03);
 *  - COURIER_MOVED — tafsilotda qulf izohi, POST javobida tasdiq tugmasi o'chiq;
 *  - muddati o'tgan to'lov — qulf izohi va «Muddatni o'zgartirish»;
 *  - admin — `correctable` tasodifan kelsa ham tugmalar yo'q.
 */
test.use({ viewport: { width: 1440, height: 900 } });

const REASON = "Boshqa kuryer tanlab yuborilgan — pul Rustam Qosimovdan olingan";

/** `GET finance/history` (ro'yxat) so'rovlari soni — tuzatishdan keyin ro'yxat yangilanganini tekshirish uchun. */
const countHistoryListRequests = (page: Page) => {
  const counter = { count: 0 };
  page.on("request", (request) => {
    if (request.method() === "GET" && /\/finance\/history(\?|$)/.test(request.url())) counter.count += 1;
  });
  return counter;
};

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
  // «Bekor qilish» — tafsilotga qaytadi (oqim yopilmaydi).
  await form.getByRole("button", { name: "Bekor qilish" }).click();
  await expect(form).toBeHidden();
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: "Qaytarish" }).click();
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

test("SHIFT_REQUIRED va 504 tasdiq oynasida qoladi; qayta bosish — o'sha `Idempotency-Key` va tana, 200 `idempotent`", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "superadmin", "Shodiyor Ergashev", correctionPageData());
  const { posts } = await mockCorrectionPosts(page, [
    { status: 400, body: { statusCode: 400, message: "Smena ochilmagan", code: "SHIFT_REQUIRED" } },
    { status: 504, body: { statusCode: 504, message: "Gateway Timeout" } },
    {
      status: 200,
      body: { statusCode: 200, message: "ok", data: { correction: { id: "12", action: "reverse" }, cashboxes: [], idempotent: true } },
    },
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
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(posts).toHaveLength(3);
  expect(new Set(posts.map((post) => post.key)).size).toBe(1);
  expect(posts.every((post) => JSON.stringify(post.body) === JSON.stringify({ reason: REASON }))).toBe(true);
  expect(leaked).toEqual([]);
});

test("«Smenani ochish»: smena oynasi tasdiq ustida, smena ochilgach — tasdiqqa qaytadi, o'sha kalit bilan qaytariladi", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "superadmin", "Shodiyor Ergashev", correctionPageData());
  const shift = await mockCorrectionShift(page);
  const { posts } = await mockCorrectionPosts(page, [
    { status: 400, body: { statusCode: 400, message: "Smena ochilmagan", code: "SHIFT_REQUIRED" } },
  ]);
  await page.goto("/payments");
  await openDetail(page, "Kuryer to'lovi");
  await page.getByRole("dialog", { name: "Kirim operatsiyasi" }).getByRole("button", { name: "Qaytarish" }).click();
  const form = page.getByRole("dialog", { name: "To'lovni qaytarish" });
  await form.getByRole("textbox", { name: /^Sabab/ }).fill(REASON);
  await form.getByRole("button", { name: "Davom etish" }).click();

  const confirm = page.getByRole("alertdialog", { name: "To'lovni qaytarishni tasdiqlang" });
  await confirm.getByRole("button", { name: "Qaytarish" }).click();
  const alert = confirm.getByRole("alert");
  await expect(alert).toContainText("Tuzatish joriy smenaga yoziladi");
  await alert.getByRole("button", { name: "Smenani ochish" }).click();

  const shiftDialog = page.getByRole("dialog", { name: "Smenani ochish" });
  await expect(shiftDialog).toBeVisible();
  await shiftDialog.getByRole("button", { name: "Smenani ochish" }).click();
  await expect(page.getByText("Smena ochildi", { exact: true })).toBeVisible();
  await expect(shiftDialog).toBeHidden();
  await expect(confirm).toBeVisible();

  await confirm.getByRole("button", { name: "Qaytarish" }).click();
  await expect(page.getByText("To'lov qaytarildi", { exact: true })).toBeVisible();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(shift.opens).toHaveLength(1);
  expect(posts).toHaveLength(2);
  expect(posts[1].key).toBe(posts[0].key);
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

test("ALREADY_CORRECTED: neytral quti, ro'yxat yangilanadi, «Tahrirlash» o'chiq, «Orqaga» — hamma oyna yopiladi", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "superadmin", "Shodiyor Ergashev", correctionPageData());
  const { posts } = await mockCorrectionPosts(page, [
    { status: 409, body: { statusCode: 409, message: "Already corrected", code: "ALREADY_CORRECTED" } },
  ]);
  const lists = countHistoryListRequests(page);
  await page.goto("/payments");
  await openDetail(page, "Kuryer to'lovi");
  await page.getByRole("dialog", { name: "Kirim operatsiyasi" }).getByRole("button", { name: "Summani tahrirlash" }).click();

  const form = page.getByRole("dialog", { name: "Summani tahrirlash" });
  await form.getByRole("textbox", { name: /^To'g'ri summa/ }).fill("1500000");
  await expect(form).toContainText("−350 000 so'm");
  await form.getByRole("textbox", { name: /^Sabab/ }).fill("Kuryer 1 500 000 so'm topshirgan, summa xato kiritilgan");
  await form.getByRole("button", { name: "Davom etish" }).click();

  const confirm = page.getByRole("alertdialog", { name: "Summani tahrirlashni tasdiqlang" });
  await expect(confirm).toContainText("1 850 000 so'm");
  await expect(confirm).toContainText("1 500 000 so'm");
  const before = lists.count;
  await confirm.getByRole("button", { name: "Tahrirlash" }).click();
  const alert = confirm.getByRole("alert");
  await expect(alert).toHaveText("To'lov allaqachon tuzatilgan. Ro'yxat yangilandi.");
  await expect(alert).toHaveAttribute("data-tone", "neutral");
  await expect(confirm.getByRole("button", { name: "Tahrirlash" })).toBeDisabled();
  await expect.poll(() => lists.count).toBeGreaterThan(before);

  await confirm.getByRole("button", { name: "Orqaga" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(posts).toHaveLength(1);
  expect(posts[0].body).toEqual({ new_amount: 1_500_000, reason: "Kuryer 1 500 000 so'm topshirgan, summa xato kiritilgan" });
  expect(leaked).toEqual([]);
});

test("COURIER_MOVED: tafsilotda qulf izohi va faqat «Yopish»; POST javobida — o'sha matn, tasdiq tugmasi o'chiq", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "superadmin", "Shodiyor Ergashev", correctionPageData());
  const { posts } = await mockCorrectionPosts(page, [
    { status: 409, body: { statusCode: 409, message: "Courier moved", code: "COURIER_MOVED" } },
  ]);
  await page.goto("/payments");

  await openDetail(page, "Kuryer to'lovi", 1);
  const moved = page.getByRole("dialog", { name: "Kirim operatsiyasi" });
  await expect(moved.getByRole("note")).toHaveText("Tuzatib bo'lmaydi — kuryer boshqa filialga o'tgan.");
  await expect(moved.getByRole("button", { name: "Qaytarish" })).toHaveCount(0);
  await expect(moved.getByRole("button", { name: "Summani tahrirlash" })).toHaveCount(0);
  await moved.locator("[data-dialog-footer]").getByRole("button", { name: "Yopish" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await openDetail(page, "Kuryer to'lovi");
  await page.getByRole("dialog", { name: "Kirim operatsiyasi" }).getByRole("button", { name: "Qaytarish" }).click();
  const form = page.getByRole("dialog", { name: "To'lovni qaytarish" });
  await form.getByRole("textbox", { name: /^Sabab/ }).fill(REASON);
  await form.getByRole("button", { name: "Davom etish" }).click();
  const confirm = page.getByRole("alertdialog", { name: "To'lovni qaytarishni tasdiqlang" });
  await confirm.getByRole("button", { name: "Qaytarish" }).click();
  await expect(confirm.getByRole("alert")).toHaveText("Tuzatib bo'lmaydi — kuryer boshqa filialga o'tgan.");
  await expect(confirm.getByRole("button", { name: "Qaytarish" })).toBeDisabled();
  // «Orqaga» — formaga (oqim yopilmaydi), sabab saqlanadi.
  await confirm.getByRole("button", { name: "Orqaga" }).click();
  await expect(form.getByRole("textbox", { name: /^Sabab/ })).toHaveValue(REASON);
  expect(posts).toHaveLength(1);
  expect(leaked).toEqual([]);
});

test("admin: `correctable` tasodifan kelsa ham — tugmalar va muddat izohi yo'q, faqat «Yopish»", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "admin", "Dilshod Karimov", correctionPageData());
  await page.goto("/payments");
  await openDetail(page, "Kuryer to'lovi");
  const detail = page.getByRole("dialog", { name: "Kirim operatsiyasi" });
  await expect(detail.getByRole("button", { name: "Yopish" }).last()).toBeVisible();
  await expect(detail).not.toContainText("Qaytarish yoki tahrirlash mumkin");
  await expect(detail.getByRole("button", { name: "Qaytarish" })).toHaveCount(0);
  await expect(detail.getByRole("button", { name: "Summani tahrirlash" })).toHaveCount(0);
  expect(leaked).toEqual([]);
});
