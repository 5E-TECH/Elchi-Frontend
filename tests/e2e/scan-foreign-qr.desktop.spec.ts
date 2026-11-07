import { test } from "@playwright/test";
import {
  runCourierHiddenPostDetail,
  runCourierHiddenPostQr,
  runForeignOrderQr,
  runScopeUnavailableRetry,
  runUniversalForeignQr,
} from "./support/foreignQr";

/** Begona QR (anKpzwxk, Elchi-Backend #620) — `/scan/:token`, 1440: ma'lumotsiz «filialingizda emas» holati. */
test.describe("Skaner natijasi — begona QR", () => {
  test.describe.configure({ timeout: 120_000 });
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("⭐ menejer, boshqa filial buyurtmasi (kunduzgi): kulrang holat, «Skanerga qaytish», qayta urinish va ma'lumot yo'q", async ({
    page,
  }) => {
    await runForeignOrderQr(page, { theme: "light", label: "order-1440" });
  });

  test("menejer, boshqa filial buyurtmasi (tungi)", async ({ page }) => {
    await runForeignOrderQr(page, { theme: "dark", label: "order-1440" });
  });

  test("kuryer, filialga hali qabul qilinmagan pochta QR'i", async ({ page }) => {
    await runCourierHiddenPostQr(page, { theme: "light", label: "post-1440" });
  });

  test("503 branch_scope_unavailable — «Qayta urinish» bilan ochiladi", async ({ page }) => {
    await runScopeUnavailableRetry(page, { theme: "light", label: "scope-1440" });
  });

  test("kuryer, pochta havolasi (/mails/:id) — kulrang holat (tungi)", async ({ page }) => {
    await runCourierHiddenPostDetail(page, { theme: "dark", label: "1440" });
  });

  test("universal skaner («Ma'lumot»): «Natija» kartasida lokal sarlavha, faqat o'qilgan matn, sahifa ochilmaydi", async ({
    page,
  }) => {
    await runUniversalForeignQr(page, { theme: "light", label: "1440" });
  });
});
