import { expect, test } from "@playwright/test";
import { BATCH_ORDERS, BATCH_TOKEN, expectScanned, mockIncomingApi, openIncoming, scannedRowIds, scanToken } from "./support/incomingBatch";

/** TC4 (CbKnJLZO): qop tokeni kiritilganda 6 qator belgilanadi — 1440px. */
test.describe("Kiruvchi posilkalar — qop yorlig'i, 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ qop tokeni → 6 qator belgilanadi, \"Qop: 6 posilkadan 6 tasi belgilandi\", qabulda 6 ta posilka tokeni", async ({ page }) => {
    const { leaked, received } = await mockIncomingApi(page);
    await openIncoming(page);

    await scanToken(page, BATCH_TOKEN);

    // Natija «Skanerlash» kartasida (xuddi shu matn qisqa vaqt global skan signalida ham chiqadi).
    await expect(page.getByLabel("Skanerlash", { exact: true }).getByText("Qop: 6 posilkadan 6 tasi belgilandi")).toBeVisible();
    expect(await scannedRowIds(page)).toEqual(BATCH_ORDERS.map((order) => order.id));
    await expectScanned(page, 6, 7);

    await page.getByRole("button", { name: "Qabul qilish — 6 ta posilka" }).click();
    // r8EGkLrP: qabul xabari qop bo'yicha qabul qilinganini aytadi.
    await expect(page.getByText("Qop bo'yicha qabul qilindi: 6 ta posilka (jami 6 ta buyurtma)")).toBeVisible();
    expect(received).toEqual([BATCH_ORDERS.map((order) => order.qr_code_token)]);
    expect(leaked).toEqual([]);
  });
});
