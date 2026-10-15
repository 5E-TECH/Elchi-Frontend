import { expect, test } from "@playwright/test";
import { BATCH_ORDERS, BATCH_TOKEN, mockIncomingApi, openIncoming, scannedRowIds, scanToken } from "./support/incomingBatch";

/** TC4 (CbKnJLZO) — 390px: qop skani, hisob xabari ekranga sig'adi. */
test.describe("Kiruvchi posilkalar — qop yorlig'i, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("qop tokeni → 6 qator belgilanadi; xabar ekranga sig'adi, gorizontal skroll yo'q", async ({ page }) => {
    const { leaked } = await mockIncomingApi(page);
    await openIncoming(page);

    await scanToken(page, BATCH_TOKEN);

    const note = page.getByText("Qop: 6 posilkadan 6 tasi belgilandi");
    await expect(note).toBeVisible();
    const box = (await note.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(await scannedRowIds(page)).toEqual(BATCH_ORDERS.map((order) => order.id));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
