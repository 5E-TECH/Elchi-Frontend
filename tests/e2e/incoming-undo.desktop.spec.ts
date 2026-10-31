import { expect, test } from "@playwright/test";
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
});
