import { expect, test, type Page } from "@playwright/test";
import {
  BATCH_ORDERS,
  BATCH_REF,
  BATCH_TOKEN,
  expectScanned,
  mockIncomingApi,
  openIncoming,
  OTHER_ORDER,
  scanToken,
} from "./support/incomingBatch";

/**
 * DamKku7C — chala qop, 1440px. Hamkor 6 ta dedi, 5 tasi keldi. Sonlar backenddan (`meta.batches`), frontend o'zi
 * sanamaydi. Maketlar `superadmin-neworders-incoming-scan-partial`, `-partial-confirm-dialog`. Soxta backend.
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 90_000 });

const PARTIAL = BATCH_ORDERS.slice(1);
const META = {
  external_batch_token: BATCH_TOKEN,
  external_batch_ref: BATCH_REF,
  external_batch_size: 6,
  received_count: 0,
  pending_count: 5,
};
const scanCard = (page: Page) => page.getByLabel("Skanerlash", { exact: true });
const alertRegion = (page: Page) => page.getByRole("region", { name: "1 ta qop chala keldi" });

test("⭐ chala qop: ogohlantirish, «5/6», sariq skan xabari, tasdiqdan keyin qabul", async ({ page }) => {
  const { leaked, received } = await mockIncomingApi(page, {
    items: () => [...PARTIAL, OTHER_ORDER],
    batches: [META],
  });
  await openIncoming(page);

  await expect(alertRegion(page)).toContainText(`Qop ${BATCH_REF} — hamkor 6 ta dedi, 5 tasi keldi`);
  await expect(page.getByText("5/6", { exact: false })).toHaveCount(5);

  await scanToken(page, BATCH_TOKEN);
  const message = scanCard(page).getByText(`Qop ${BATCH_REF}: 5/6 keldi`);
  await expect(message).toBeVisible();
  await expect(scanCard(page).getByText("5 ta posilka belgilandi, 1 tasi yetishmaydi")).toBeVisible();
  await expect(scanCard(page).locator('[data-tone="warning"]')).toBeVisible();
  await expectScanned(page, 5, 6);

  await page.getByRole("button", { name: "Qabul qilish — 5 ta posilka" }).click();
  const dialog = page.getByRole("alertdialog", { name: "1 ta qop chala — baribir qabul qilinsinmi?" });
  await expect(dialog).toContainText("Hamkor 6 ta dedi, 5 tasi keldi · 5 tasi skanerlangan");
  await expect(dialog).toContainText("1 ta yetishmaydi");
  await dialog.getByRole("button", { name: "Bekor qilish" }).click();
  await expect(dialog).toBeHidden();
  expect(received).toEqual([]);

  await page.getByRole("button", { name: "Qabul qilish — 5 ta posilka" }).click();
  await page.getByRole("button", { name: "Baribir qabul qilish" }).click();
  await expect.poll(() => received.length).toBe(1);
  expect(received[0]).toEqual(PARTIAL.map((order) => order.qr_code_token));
  expect(leaked).toEqual([]);
});

test("⭐ qop to'liq: ogohlantirish yo'q, «6/6», yashil xabar, tasdiqsiz qabul", async ({ page }) => {
  const { received } = await mockIncomingApi(page, { batches: [{ ...META, pending_count: 6 }] });
  await openIncoming(page);

  await expect(page.getByText("6/6", { exact: false })).toHaveCount(6);
  await expect(page.getByRole("region", { name: /qop chala keldi/ })).toHaveCount(0);

  await scanToken(page, BATCH_TOKEN);
  await expect(scanCard(page).getByText("Qop: 6 posilkadan 6 tasi belgilandi")).toBeVisible();
  await expect(scanCard(page).locator('[data-tone="success"]')).toBeVisible();

  await page.getByRole("button", { name: "Qabul qilish — 6 ta posilka" }).click();
  await expect.poll(() => received.length).toBe(1);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

test("⭐ ilgari qabul qilingan a'zo kamomad emas: 1 + 5 = 6/6", async ({ page }) => {
  await mockIncomingApi(page, {
    items: () => [...PARTIAL, OTHER_ORDER],
    batches: [{ ...META, received_count: 1 }],
  });
  await openIncoming(page);
  await expect(page.getByText("6/6", { exact: false })).toHaveCount(5);
  await expect(page.getByRole("region", { name: /qop chala keldi/ })).toHaveCount(0);
});

test("⭐ hamkor hajmni aytmagan: ogohlantirish va belgi yo'q", async ({ page }) => {
  await mockIncomingApi(page, {
    items: () => PARTIAL.map((order) => ({ ...order, external_batch_size: null })),
    batches: [{ ...META, external_batch_size: null }],
  });
  await openIncoming(page);
  await expect(page.getByRole("region", { name: /qop chala keldi/ })).toHaveCount(0);
  await expect(page.getByText(/\d\/\d/)).toHaveCount(0);
});

test("⭐ `meta.batches` yo'q (eski backend): frontend o'zi sanamaydi", async ({ page }) => {
  await mockIncomingApi(page, { items: () => [...PARTIAL, OTHER_ORDER] });
  await openIncoming(page);
  await expect(page.getByRole("region", { name: /qop chala keldi/ })).toHaveCount(0);
  await expect(page.getByText(/\d\/\d/)).toHaveCount(0);
});
