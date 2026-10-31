import { expect, test } from "@playwright/test";
import {
  BATCH_ORDERS,
  BATCH_REF,
  BATCH_TOKEN,
  mockIncomingApi,
  openIncoming,
  OTHER_ORDER,
  scanToken,
} from "./support/incomingBatch";

/** DamKku7C — chala qop, 390px: ogohlantirish va tasdiq oynasi sig'adi, oyna pastki varaqa, tugmalar ≥ 44px. */
test.describe.configure({ timeout: 90_000 });

test("⭐ ogohlantirish, kartadagi «5/6» va tasdiq varag'i ekranga sig'adi", async ({ page }) => {
  await mockIncomingApi(page, {
    items: () => [...BATCH_ORDERS.slice(1), OTHER_ORDER],
    batches: [
      {
        external_batch_token: BATCH_TOKEN,
        external_batch_ref: BATCH_REF,
        external_batch_size: 6,
        received_count: 0,
        pending_count: 5,
      },
    ],
  });
  await openIncoming(page);

  const alert = page.getByRole("region", { name: "1 ta qop chala keldi" });
  await expect(alert).toContainText("hamkor 6 ta dedi, 5 tasi keldi");
  const box = (await alert.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await expect(page.getByText("5/6", { exact: false }).first()).toBeVisible();

  await scanToken(page, BATCH_TOKEN);
  await page.getByRole("button", { name: /Qabul qilish — 5 ta/ }).click();
  const dialog = page.getByRole("alertdialog", { name: "1 ta qop chala — baribir qabul qilinsinmi?" });
  await expect(dialog).toBeVisible();
  const action = dialog.getByRole("button", { name: "Baribir qabul qilish" });
  await action.scrollIntoViewIfNeeded();
  await expect(action).toBeVisible();
  expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const sheet = (await dialog.boundingBox())!;
  expect(sheet.width).toBeLessThanOrEqual(390);
  expect(sheet.y + sheet.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
