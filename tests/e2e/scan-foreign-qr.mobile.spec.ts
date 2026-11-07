import { test } from "@playwright/test";
import { runCourierHiddenPostDetail, runCourierHiddenPostQr, runForeignOrderQr } from "./support/foreignQr";

/** Begona QR (anKpzwxk, Elchi-Backend #620) — `/scan/:token`, telefon (390). */
test.describe("Skaner natijasi — begona QR (390px)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("⭐ menejer, boshqa filial buyurtmasi (kunduzgi)", async ({ page }) => {
    await runForeignOrderQr(page, { theme: "light", label: "order-390" });
  });

  test("menejer, boshqa filial buyurtmasi (tungi)", async ({ page }) => {
    await runForeignOrderQr(page, { theme: "dark", label: "order-390" });
  });

  test("kuryer, pochta QR'i (tungi)", async ({ page }) => {
    await runCourierHiddenPostQr(page, { theme: "dark", label: "post-390" });
  });

  test("kuryer, pochta havolasi (/mails/:id) — «Pochta hali filialga qabul qilinmagan», global xabarsiz", async ({ page }) => {
    await runCourierHiddenPostDetail(page, { theme: "light", label: "390" });
  });
});
