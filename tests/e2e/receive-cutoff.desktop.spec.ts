import { expect, test, type Page } from "@playwright/test";
import { expectScanned, mockIncomingApi, openIncoming, OTHER_ORDER, scanToken } from "./support/incomingBatch";
import { mockNewOrdersCameraApi, openMarket } from "./support/newOrdersCamera";
import { closeReceive, expectReceiveClosedAlert, expectTheme, noHorizontalScroll, serveSuperadminTheme } from "./support/receiveCutoff";

/**
 * «Kun tartibi» (Ops, 2026-11-10), 1440px: yaratilgan buyurtmalarni qabul qilish chegarasi o'tgan — market yangi
 * buyurtmalarida va kiruvchi posilkalarda ogohlantirish (chegara va ochilish vaqti), «Qabul qilish» o'chiq, qabul
 * so'rovi ketmaydi (backend ham `409 ORDER_RECEIVE_CLOSED`). Kiruvchi posilkalarda skan faqat belgilaydi — ishlayveradi.
 */
const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS_DIR) await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/${name}.png`, fullPage: true });
};

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("Qabul chegarasi o'tgan — 1440px", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ ${theme}: market yangi buyurtmalari — ogohlantirish, tanlansa ham «Qabul qilish» o'chiq`, async ({ page }) => {
      const { leaked, received } = await mockNewOrdersCameraApi(page);
      await serveSuperadminTheme(page, theme);
      await closeReceive(page);
      await openMarket(page);
      await expectTheme(page, theme);

      await expectReceiveClosedAlert(page, "market-orders-receive-closed");
      await page.getByRole("button", { name: "Barchasini tanlash" }).first().click();
      await expect(page.getByRole("button", { name: /^Qabul qilish — \d+ ta buyurtma$/ })).toBeDisabled();
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `receive-closed-market-1440-${theme}`);
      expect(received).toEqual([]);
      expect(leaked).toEqual([]);
    });

    test(`⭐ ${theme}: kiruvchi posilkalar — ogohlantirish; skan belgilaydi, «Qabul qilish» o'chiq`, async ({ page }) => {
      const { leaked, received } = await mockIncomingApi(page);
      await serveSuperadminTheme(page, theme);
      await closeReceive(page);
      await openIncoming(page);
      await expectTheme(page, theme);

      await expectReceiveClosedAlert(page, "incoming-receive-closed");
      await scanToken(page, OTHER_ORDER.qr_code_token);
      await expectScanned(page, 1, 7);
      await expect(page.getByRole("button", { name: "Qabul qilish — 1 ta posilka" })).toBeDisabled();
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `receive-closed-incoming-1440-${theme}`);
      expect(received).toEqual([]);
      expect(leaked).toEqual([]);
    });
  }
});
