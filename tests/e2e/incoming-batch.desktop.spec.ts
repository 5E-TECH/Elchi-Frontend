import { expect, test } from "@playwright/test";
import { BATCH_ORDERS, BATCH_TOKEN, mockIncomingApi, openIncoming, scannedRowIds, scanToken } from "./support/incomingBatch";

/** TC4 (CbKnJLZO): qop tokeni kiritilganda 6 qator belgilanadi — 1440px. */
test.describe("Kiruvchi posilkalar — qop yorlig'i, 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ qop tokeni → 6 qator belgilanadi, \"Qop: 6 posilkadan 6 tasi belgilandi\", qabulda 6 ta posilka tokeni", async ({ page }) => {
    const { leaked, received } = await mockIncomingApi(page);
    await openIncoming(page);

    await scanToken(page, BATCH_TOKEN);

    await expect(page.getByText("Qop: 6 posilkadan 6 tasi belgilandi")).toBeVisible();
    expect(await scannedRowIds(page)).toEqual(BATCH_ORDERS.map((order) => order.id));
    await expect(page.getByText("6 / 7")).toBeVisible();

    await page.getByRole("button", { name: /QABUL QILISH \(6\)/ }).click();
    await expect(page.getByText("6 buyurtma qabul qilindi")).toBeVisible();
    expect(received).toEqual([BATCH_ORDERS.map((order) => order.qr_code_token)]);
    expect(leaked).toEqual([]);
  });
});
