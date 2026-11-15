import { expect, test } from "@playwright/test";
import {
  CANCELLED_ORDERS,
  MARKET_PIN,
  MARKET_QR,
  mockCancelledApi,
  openHandover,
  pendingOrder,
  scanOrders,
  usbScan,
} from "./support/cancelledHandover";

/**
 * Bekor qilinganlarni marketga topshirish — 1440px (dizayn v2, maket `superadmin-neworders-cancelled-handover`).
 * Market QR skanerlanmaguncha topshirilmaydi; market QR / PIN kod hech narsani avtomatik tanlamaydi va yubormaydi.
 * SKAN = TOPSHIRISH (ega qarori 2026-11-15, BeePost naqshi): USB skaner bilan o'qilgan buyurtma o'sha zahoti alohida
 * so'rov bilan (token bilan) topshiriladi, ro'yxatdan chiqib «Topshirildi» ga o'tadi; «Marketga jo'natish» tugmasi yo'q.
 */
test.describe("Bekor qilinganlar — market QR bilan topshirish, 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ market QR'siz topshirilmaydi; QR hech narsani yubormaydi — har skan darhol token bilan topshiriladi", async ({ page }) => {
    const { leaked, scanned, handovers } = await mockCancelledApi(page);
    await openHandover(page);

    await expect(page.getByText("Market QR kerak")).toBeVisible();
    await expect(page.getByRole("button", { name: /Marketga jo'natish/ })).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);

    // QR'dan oldingi buyurtma skani — hech narsa yuborilmaydi, qator joyida.
    await usbScan(page, "tok-10235");
    await expect(page.getByText("Avval market QR'ini skanerlang").first()).toBeVisible();
    await expect(pendingOrder(page, "10235")).toBeVisible();
    expect(handovers).toEqual([]);

    await usbScan(page, MARKET_QR);

    await expect(page.getByText("Market QR skanerlandi")).toBeVisible();
    await expect(page.getByRole("timer", { name: /QR amal qilish vaqti/ })).toBeVisible();
    // Ilgari shu yerda marketning BARCHA bekorlari tanlanardi — endi hech biri yuborilmaydi.
    for (const order of CANCELLED_ORDERS) await expect(pendingOrder(page, order.id)).toBeVisible();
    expect(handovers).toEqual([]);
    expect(scanned).toEqual([MARKET_QR]);

    await scanOrders(page, ["10235", "10213"], handovers);
    expect(handovers).toEqual([
      { order_ids: ["10235"], authorization_token: "auth-e2e" },
      { order_ids: ["10213"], authorization_token: "auth-e2e" },
    ]);
    // Topshirilmagani ro'yxatda qoldi, topshirilganlari «Topshirildi» da.
    await expect(pendingOrder(page, "10220")).toBeVisible();
    await expect(page.getByTestId("handed-over-card").getByText("QR orqali")).toHaveCount(2);

    // Topshirilganni qayta skanerlash — «Allaqachon topshirilgan», so'rov yo'q.
    await usbScan(page, "tok-10235");
    await expect(page.getByText("Allaqachon topshirilgan №10235").first()).toBeVisible();
    expect(handovers).toHaveLength(2);

    await scanOrders(page, ["10220"], handovers);
    await expect(page.getByText("Hammasi topshirildi")).toBeVisible();
    expect(leaked).toEqual([]);
  });

  // zkRab9M2 (BG6): QR o'qilmasa — market QR oynasidagi 6 xonali kod (maket `superadmin-neworders-cancelled-pin-dialog`).
  test("⭐ PIN kod bilan: noto'g'ri kod — qolgan urinishlar; to'g'ri kod hech narsani yubormaydi, skan token bilan topshiradi", async ({ page }) => {
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
    for (const order of CANCELLED_ORDERS) await expect(pendingOrder(page, order.id)).toBeVisible();
    expect(handovers).toEqual([]);
    expect(pins).toEqual([
      { market_id: "201", pin: "111111" },
      { market_id: "201", pin: MARKET_PIN },
    ]);
    expect(scanned).toEqual([]);

    await scanOrders(page, CANCELLED_ORDERS.map((order) => order.id), handovers);
    expect(handovers).toEqual(
      CANCELLED_ORDERS.map((order) => ({ order_ids: [order.id], authorization_token: "auth-pin-e2e" })),
    );
    await expect(page.getByTestId("handed-over-card").getByText("Parol orqali").first()).toBeVisible();
    await expect(page.getByText("Hammasi topshirildi")).toBeVisible();
    expect(leaked).toEqual([]);
  });
});
