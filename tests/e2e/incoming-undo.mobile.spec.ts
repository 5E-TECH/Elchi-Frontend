import { expect, test } from "@playwright/test";
import { BATCH_ORDERS, BATCH_REF, expectScanned, mockIncomingApi, openIncoming, scannedRowIds, scanToken } from "./support/incomingBatch";

/** IP-1 — 390px: kartada «Qop …», 44 px «Olib tashlash», «Qaytarish» xabari ekranga sig'adi. */
test.describe("Kiruvchi posilkalar — olib tashlash, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("kartada «Qop BP-…», skanerlangan kartada 44 px «Olib tashlash» va «Qaytarish»; gorizontal skroll yo'q", async ({ page }) => {
    const { leaked } = await mockIncomingApi(page);
    await openIncoming(page);

    const card = page.getByRole("listitem").filter({ hasText: "Andijon mijoz 1" });
    await expect(card).toContainText(`Qop ${BATCH_REF}`);

    await scanToken(page, BATCH_ORDERS[0].qr_code_token);
    const undo = card.getByRole("button", { name: "№1251162 ni ro'yxatdan olib tashlash" });
    const box = (await undo.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);

    await undo.click();
    expect(await scannedRowIds(page)).toEqual([]);
    const toast = page.locator('[data-toast-id="incoming-unscan"]');
    await expect(toast).toContainText("№1251162 · 0 / 7");
    const toastBox = (await toast.boundingBox())!;
    expect(toastBox.x).toBeGreaterThanOrEqual(0);
    expect(toastBox.x + toastBox.width).toBeLessThanOrEqual(390);

    await toast.getByRole("button", { name: "Qaytarish" }).click();
    await expectScanned(page, 1, 7);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
