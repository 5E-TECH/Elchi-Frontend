import { expect, test, type Page } from "@playwright/test";
import { expectScanned, mockIncomingApi, openIncoming, OTHER_ORDER, scanToken } from "./support/incomingBatch";
import { mockNewOrdersCameraApi, openMarket } from "./support/newOrdersCamera";
import { closeReceive, expectReceiveClosedAlert, expectTheme, noHorizontalScroll, serveSuperadminTheme } from "./support/receiveCutoff";

/**
 * «Kun tartibi» (Ops, 2026-11-10), 390px: qabul chegarasi o'tgan — ogohlantirish ekranga sig'adi (matn o'raladi),
 * gorizontal toshish yo'q, «Qabul qilish» (telefonda pastki panelda / sarlavhada) o'chiq, qabul so'rovi ketmaydi.
 */
const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS_DIR) await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/${name}.png`, fullPage: true });
};

const fitsScreen = async (page: Page, testId: string) => {
  const box = (await page.getByTestId(testId).boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
};

test.describe("Qabul chegarasi o'tgan — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ ${theme}: market yangi buyurtmalari — ogohlantirish sig'adi, «Qabul qilish» o'chiq`, async ({ page }) => {
      const { leaked, received } = await mockNewOrdersCameraApi(page);
      await serveSuperadminTheme(page, theme);
      await closeReceive(page);
      await openMarket(page);
      await expectTheme(page, theme);

      await expectReceiveClosedAlert(page, "market-orders-receive-closed");
      await fitsScreen(page, "market-orders-receive-closed");
      await page.getByRole("button", { name: "Barchasini tanlash" }).first().click();
      await expect(page.getByRole("button", { name: /^Qabul qilish — \d+ ta/ })).toBeDisabled();
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `receive-closed-market-390-${theme}`);
      expect(received).toEqual([]);
      expect(leaked).toEqual([]);
    });

    test(`⭐ ${theme}: kiruvchi posilkalar — ogohlantirish sig'adi; skan belgilaydi, «Qabul qilish» o'chiq`, async ({ page }) => {
      const { leaked, received } = await mockIncomingApi(page);
      await serveSuperadminTheme(page, theme);
      await closeReceive(page);
      await openIncoming(page);
      await expectTheme(page, theme);

      await expectReceiveClosedAlert(page, "incoming-receive-closed");
      await fitsScreen(page, "incoming-receive-closed");
      await scanToken(page, OTHER_ORDER.qr_code_token);
      await expectScanned(page, 1, 7);
      await expect(page.getByRole("button", { name: "Qabul qilish — 1 ta" })).toBeDisabled();
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `receive-closed-incoming-390-${theme}`);
      expect(received).toEqual([]);
      expect(leaked).toEqual([]);
    });
  }
});
