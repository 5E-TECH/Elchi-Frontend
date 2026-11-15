import { expect, test } from "@playwright/test";
import {
  CANCELLED_ORDERS,
  MARKET_PIN,
  MARKET_QR,
  mockCancelledApi,
  openHandover,
  rowCheckbox,
  scanOrders,
  usbScan,
} from "./support/cancelledHandover";

/**
 * Bekor qilinganlarni marketga topshirish — 1440px (dizayn v2, maket `superadmin-neworders-cancelled-handover`).
 * Market QR skanerlanmaguncha jo'natilmaydi; market QR / PIN kod hech narsani avtomatik tanlamaydi (ega qarori
 * 2026-11-15) — USB skaner bilan o'qilgan buyurtma ro'yxatdan chiqib «Skanerlangan (N)» ga o'tadi, «Ro'yxatga
 * qaytarish» bilan qaytadi va faqat skanerlanganlar topshirish tokeni bilan jo'natiladi.
 */
test.describe("Bekor qilinganlar — market QR bilan topshirish, 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ market QR'siz jo'natib bo'lmaydi; QR hech narsani tanlamaydi — skanerlangani ro'yxatdan chiqadi, token bilan jo'natiladi", async ({ page }) => {
    const { leaked, scanned, handovers } = await mockCancelledApi(page);
    await openHandover(page);

    await expect(page.getByText("Market QR kerak")).toBeVisible();
    await expect(page.getByRole("button", { name: "Marketga jo'natish" })).toBeDisabled();
    await expect(page.getByRole("checkbox", { name: "№10235 ni qo'lda tanlash" })).not.toBeChecked();

    await usbScan(page, MARKET_QR);

    await expect(page.getByText("Market QR skanerlandi")).toBeVisible();
    await expect(page.getByRole("timer", { name: /QR amal qilish vaqti/ })).toBeVisible();
    // Ilgari shu yerda marketning BARCHA bekorlari tanlanardi.
    for (const order of CANCELLED_ORDERS) {
      await expect(page.getByRole("checkbox", { name: `№${order.id} ni qo'lda tanlash` })).not.toBeChecked();
    }
    await expect(page.getByRole("button", { name: "Marketga jo'natish" })).toBeDisabled();
    expect(scanned).toEqual([MARKET_QR]);

    await scanOrders(page, ["10235", "10220", "10213"]);
    await expect(page.getByText("Hammasi skanerlandi")).toBeVisible();
    // Xato skan — «Ro'yxatga qaytarish»: qator ro'yxatga qaytadi va jo'natishga kirmaydi.
    await page.getByRole("button", { name: "№10220 ni ro'yxatga qaytarish" }).click();
    await expect(rowCheckbox(page, "10220")).not.toBeChecked();
    await expect(page.getByTestId("scanned-card").getByText("№10220", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Marketga jo'natish — 2 ta" }).click();
    await expect.poll(() => handovers.length).toBe(1);
    expect(handovers[0]).toEqual({ order_ids: ["10235", "10213"], authorization_token: "auth-e2e" });
    // Topshirilgani «Topshirildi» da, jo'natilmagani ro'yxatda qoldi.
    await expect(page.getByTestId("handed-over-card")).toBeVisible();
    await expect(page.getByTestId("scanned-card")).toHaveCount(0);
    await expect(rowCheckbox(page, "10220")).toBeVisible();
    expect(leaked).toEqual([]);
  });

  // zkRab9M2 (BG6): QR o'qilmasa — market QR oynasidagi 6 xonali kod (maket `superadmin-neworders-cancelled-pin-dialog`).
  test("⭐ PIN kod bilan: noto'g'ri kod — qolgan urinishlar; to'g'ri kod hech narsani tanlamaydi, skanerlangani token bilan jo'natiladi", async ({ page }) => {
    const { leaked, scanned, pins, handovers } = await mockCancelledApi(page);
    await openHandover(page);

    await page.getByRole("button", { name: "PIN kodni kiritish" }).click();
    const dialog = page.getByRole("dialog", { name: "Market PIN kodi" });
    await expect(dialog).toBeVisible();
    const input = dialog.getByRole("textbox", { name: /6 xonali PIN/ });
    await expect(input).toBeFocused();

    // Tez yozib Enter — USB skaner tezligida; sahifa skaneri to'xtagan, bu buyurtma/QR skani emas.
    await page.keyboard.type("111111", { delay: 10 });
    await page.keyboard.press("Enter");
    await expect(dialog.getByText("Kod noto'g'ri — yana 4 ta urinish qoldi")).toBeVisible();
    await expect(page.getByText("Market QR kerak")).toBeVisible();

    await input.fill("");
    await page.keyboard.type(MARKET_PIN, { delay: 10 });
    await page.keyboard.press("Enter");

    await expect(dialog).toBeHidden();
    await expect(page.getByText("Market PIN kodi tasdiqlandi")).toBeVisible();
    await expect(page.getByRole("timer", { name: /QR amal qilish vaqti/ })).toBeVisible();
    for (const order of CANCELLED_ORDERS) {
      await expect(page.getByRole("checkbox", { name: `№${order.id} ni qo'lda tanlash` })).not.toBeChecked();
    }
    await expect(page.getByRole("button", { name: "Marketga jo'natish" })).toBeDisabled();
    expect(pins).toEqual([
      { market_id: "201", pin: "111111" },
      { market_id: "201", pin: MARKET_PIN },
    ]);
    expect(scanned).toEqual([]);

    await scanOrders(page, CANCELLED_ORDERS.map((order) => order.id));
    await page.getByRole("button", { name: "Marketga jo'natish — 3 ta" }).click();
    await expect.poll(() => handovers.length).toBe(1);
    expect(handovers[0]).toEqual({
      order_ids: CANCELLED_ORDERS.map((order) => order.id),
      authorization_token: "auth-pin-e2e",
    });
    await expect(page.getByTestId("handed-over-card").getByText("Parol orqali").first()).toBeVisible();
    expect(leaked).toEqual([]);
  });
});
