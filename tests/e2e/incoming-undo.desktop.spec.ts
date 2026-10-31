import { expect, test, type Page } from "@playwright/test";
import {
  BATCH_ORDERS,
  BATCH_REF,
  BATCH_TOKEN,
  OTHER_ORDER,
  expectScanned,
  mockIncomingApi,
  openIncoming,
  scannedRowIds,
  scanToken,
} from "./support/incomingBatch";

/**
 * IP-1 (eo3eeJxs, DamKku7C) — 1440px: «Qop» ustuni, skanni olib tashlash + 5 soniyalik «Qaytarish»,
 * «Yangilash» belgilarni saqlaydi (maketlar `superadmin-neworders-incoming-scan`, `*-incoming-scan-undo`).
 */
test.describe("Kiruvchi posilkalar — olib tashlash va yangilash, 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ «Qop» ustuni va xulosa; qatordagi «Olib tashlash» → «Olib tashlandi» · «Qaytarish», fokus skanerda", async ({ page }) => {
    const { leaked } = await mockIncomingApi(page);
    await openIncoming(page);

    await expect(page.getByRole("columnheader", { name: "Qop" })).toBeVisible();
    const firstRow = page.getByRole("row").filter({ hasText: "Andijon mijoz 1" });
    await expect(firstRow).toContainText(BATCH_REF);
    await expect(page.getByRole("row").filter({ hasText: "Boshqa qop mijozi" })).toContainText("—");
    await expect(page.getByRole("region", { name: "Kelgan posilkalar" })).toContainText(
      "7 ta · 1 ta qop · jami 1 149 000 so'm",
    );

    await scanToken(page, BATCH_ORDERS[0].qr_code_token);
    await scanToken(page, OTHER_ORDER.qr_code_token);
    expect(await scannedRowIds(page)).toEqual([BATCH_ORDERS[0].id, OTHER_ORDER.id]);

    await firstRow.getByRole("button", { name: "№1251162 ni ro'yxatdan olib tashlash" }).click();

    expect(await scannedRowIds(page)).toEqual([OTHER_ORDER.id]);
    await expectScanned(page, 1, 7);
    const toast = page.locator('[data-toast-id="incoming-unscan"]');
    await expect(toast).toContainText("Olib tashlandi");
    await expect(toast).toContainText("№1251162 · 1 / 7");
    await expect(page.getByPlaceholder("QR kodni skanerlang yoki kiriting...")).toBeFocused();

    await toast.getByRole("button", { name: "Qaytarish" }).click();
    expect((await scannedRowIds(page))?.sort()).toEqual([BATCH_ORDERS[0].id, OTHER_ORDER.id].sort());
    await expectScanned(page, 2, 7);
    expect(leaked).toEqual([]);
  });

  test("⭐ qop skani xabaridagi «Olib tashlash» faqat shu skan belgilaganlarini oladi", async ({ page }) => {
    await mockIncomingApi(page);
    await openIncoming(page);

    await scanToken(page, BATCH_ORDERS[0].qr_code_token);
    await scanToken(page, BATCH_TOKEN);
    const scanCard = page.getByLabel("Skanerlash", { exact: true });
    await expect(scanCard.getByText("Qop: 6 posilkadan 6 tasi belgilandi")).toBeVisible();

    await scanCard.getByRole("button", { name: "5 ta posilkani ro'yxatdan olib tashlash" }).click();

    expect(await scannedRowIds(page)).toEqual([BATCH_ORDERS[0].id]);
    await expect(page.locator('[data-toast-id="incoming-unscan"]')).toContainText("5 ta posilka · 1 / 7");
  });

  test("⭐ «Yangilash» belgilarni saqlaydi: ro'yxatdan chiqqan posilka olinadi, qolgani qabulga ketadi", async ({ page }) => {
    let items: unknown[] = [...BATCH_ORDERS, OTHER_ORDER];
    const { received } = await mockIncomingApi(page, { items: () => items });
    await openIncoming(page);

    await scanToken(page, BATCH_ORDERS[0].qr_code_token);
    await scanToken(page, BATCH_ORDERS[1].qr_code_token);
    await expectScanned(page, 2, 7);

    // Ikkinchi posilka boshqa operator tomonidan qabul qilindi — yangi ro'yxatda yo'q.
    items = items.filter((order) => (order as { id: string }).id !== BATCH_ORDERS[1].id);
    await page.getByRole("button", { name: "Yangilash" }).click();

    await expect(page.getByRole("row").filter({ hasText: "Andijon mijoz 2" })).toHaveCount(0);
    await expectScanned(page, 1, 6);
    expect(await scannedRowIds(page)).toEqual([BATCH_ORDERS[0].id]);
    await expect(page.getByPlaceholder("QR kodni skanerlang yoki kiriting...")).toBeFocused();

    await page.getByRole("button", { name: "Qabul qilish — 1 ta posilka" }).click();
    await expect(page.getByText("1 buyurtma qabul qilindi")).toBeVisible();
    expect(received).toEqual([[BATCH_ORDERS[0].qr_code_token]]);
  });

  test("⭐ rQX8TqRV: KATTA harfli va kirill tartibidagi token topiladi, serverga asl token ketadi", async ({ page }) => {
    const { received } = await mockIncomingApi(page);
    await openIncoming(page);
    const [upper, cyrillic] = BATCH_ORDERS;

    await scanToken(page, upper.qr_code_token.toUpperCase());
    await expectScanned(page, 1, 7);

    // `2afcc394ca289bf23aee44d1` rus tartibida: a → ф, b → и, c → с, d → в, e → у, f → а.
    await scanToken(page, cyrillic.qr_code_token.replace(/[a-f]/g, (char) => "фисвуа"["abcdef".indexOf(char)]));
    await expectScanned(page, 2, 7);

    await page.getByRole("button", { name: "Qabul qilish — 2 ta posilka" }).click();
    await expect(page.getByText("2 buyurtma qabul qilindi")).toBeVisible();
    expect(received).toEqual([[upper.qr_code_token, cyrillic.qr_code_token]]);
  });

  /** Haqiqiy skaner kabi: fokus qayerda bo'lsa, o'sha yerga harflar va Enter. */
  const usbScan = async (page: Page, token: string) => {
    await page.keyboard.type(token);
    await page.keyboard.press("Enter");
  };

  test("⭐ eo3eeJxs: fokus maydonda bo'lmasa ham skan tutiladi, tugmadagi Enter uni bosmaydi", async ({ page }) => {
    let listCalls = 0;
    await mockIncomingApi(page, {
      items: () => {
        listCalls += 1;
        return [...BATCH_ORDERS, OTHER_ORDER];
      },
    });
    await openIncoming(page);

    await page.getByRole("heading", { level: 1 }).click();
    await expect(page.getByPlaceholder("QR kodni skanerlang yoki kiriting...")).not.toBeFocused();
    await usbScan(page, BATCH_ORDERS[0].qr_code_token);
    await expectScanned(page, 1, 7);
    await expect(page.getByLabel("Skanerlash", { exact: true }).getByText("№1251162 — ro'yxatga qo'shildi")).toBeVisible();

    const calls = listCalls;
    await page.getByRole("button", { name: "Yangilash" }).focus();
    await usbScan(page, BATCH_ORDERS[1].qr_code_token);
    await expectScanned(page, 2, 7);
    expect(listCalls).toBe(calls);
  });

  test("⭐ eo3eeJxs: F5 dan keyin skanlar tiklanadi, qabuldan keyin qaytmaydi", async ({ page }) => {
    const { received } = await mockIncomingApi(page);
    await openIncoming(page);
    await scanToken(page, BATCH_ORDERS[0].qr_code_token);
    await scanToken(page, OTHER_ORDER.qr_code_token);
    await expectScanned(page, 2, 7);

    await page.reload();
    await expect(page.getByText("Andijon mijoz 6")).toBeVisible({ timeout: 60_000 });
    await expectScanned(page, 2, 7);
    expect((await scannedRowIds(page))?.sort()).toEqual([BATCH_ORDERS[0].id, OTHER_ORDER.id].sort());

    await page.getByRole("button", { name: "Qabul qilish — 2 ta posilka" }).click();
    await expect(page.getByText("2 buyurtma qabul qilindi")).toBeVisible();
    expect(received).toEqual([[BATCH_ORDERS[0].qr_code_token, OTHER_ORDER.qr_code_token]]);

    await page.reload();
    await expect(page.getByText("Andijon mijoz 6")).toBeVisible({ timeout: 60_000 });
    await expectScanned(page, 0, 7);
  });

  test("⭐ eo3eeJxs: «USB skaner tayyor» — faqat tinglaganda; modalda va boshqa maydonda skan ushlanmaydi", async ({ page }) => {
    await mockIncomingApi(page);
    await openIncoming(page);
    const badge = page.getByText("USB skaner tayyor");
    await expect(badge).toBeVisible();

    await page.getByRole("heading", { level: 1 }).click();
    await expect(badge).toBeVisible();

    // Modal: «?» — tezkor tugmalar oynasi.
    await page.keyboard.type("?");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(badge).toBeHidden();
    await page.keyboard.type(BATCH_ORDERS[0].qr_code_token);
    await expectScanned(page, 0, 7);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(badge).toBeVisible();

    // Boshqa maydon: yuqoridagi qidiruv.
    await page.keyboard.press("Control+k");
    await expect(badge).toBeHidden();
    await page.keyboard.type(BATCH_ORDERS[0].qr_code_token);
    await expectScanned(page, 0, 7);
  });
});
