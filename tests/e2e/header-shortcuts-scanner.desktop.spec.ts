import { expect, test, type Page } from "@playwright/test";
import { SCANNER_KEY_GAP_MS } from "../../src/shared/lib/useKeyboardScanner";
import {
  CANCELLED_ORDERS,
  mockCancelledApi,
  openHandover,
  pendingOrder,
  usbScan,
  type HandoverBody,
} from "./support/cancelledHandover";

/** Kartadagi takrorlash: bekor buyurtma QR'i `CANCEL-…-3g5o4c` (+ yonma-yon «go» — skaner tezligi sharti uchun). */
const ORDER_TOKEN_WITH_GO = "CANCEL-10235-go-3g5o4c";

/**
 * №10235 ning QR tokeni «…go…g5o…» — ro'yxat shu bilan keladi (`page.route` umumiy soxta backend'dan ustun);
 * topshirilgani ro'yxatdan chiqadi (umumiy soxta backend kabi). GET'dan boshqasi (OPTIONS) — umumiy ishlovchiga.
 */
const withGoOrderToken = (page: Page, handovers: HandoverBody[]) =>
  page.route(/\/orders\/markets\/201\/cancelled(\?|$)/, (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const handed = new Set(handovers.flatMap((body) => body.order_ids));
    const data = CANCELLED_ORDERS.filter((order) => !handed.has(order.id)).map((order) =>
      order.id === "10235" ? { ...order, qr_code_token: ORDER_TOKEN_WITH_GO } : order,
    );
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "http://127.0.0.1:4173", "access-control-allow-credentials": "true" },
      body: JSON.stringify({ statusCode: 200, message: "ok", data }),
    });
  });

/**
 * Ovozsiz: birinchi `keydown` skan ovozini «ochadi» (`shared/lib/scanner/feedback.ts` — `AudioContext` yaratiladi),
 * headless Chromium'da bu bosh oqimni ~100 ms band qiladi va skan oqimining 1-belgisi bilan 2-si orasida skaner
 * oralig'idan katta tanaffus paydo bo'ladi (sahifa skaneri 1-belgini tashlab yuboradi). Test tezkor tugmalar haqida —
 * ovozni o'chirib, vaqt aniq bo'ladi.
 */
const withoutAudio = (page: Page) =>
  page.addInitScript(() => {
    for (const key of ["AudioContext", "webkitAudioContext"]) {
      Object.defineProperty(window, key, { value: undefined, configurable: true, writable: true });
    }
  });

/**
 * SARLAVHA TEZKOR TUGMALARI va USB SKANER (XctTEplG) — 1440px, haqiqiy shell (`widgets/header/ui/Header.tsx`).
 *
 * Muammo (prod, 2026-10-26): skaner kodni klaviatura kabi «yozadi»; QR matnida «g» dan keyin «o» bo'lsa, G → O
 * tezkor tugmasi ishlab, sahifa skan o'rtasida `/orders` ga sakrardi (market QR — `MCR-` + base64url, tasodifiy
 * harflar). Endi skaner tezligida (`SCANNER_KEY_GAP_MS` dan tez) kelgan belgi tezkor tugma emas
 * (`widgets/header/model/headerShortcuts.ts`), odam tezligidagi G → O esa avvalgidek ishlaydi.
 *
 * Sahifa — «Bekor qilinganlar → marketga topshirish» (`/new-orders/cancelled/:marketId`): market QR'i shu yerda
 * sahifada (maydonsiz) USB skaner bilan o'qiladi. Superadmin — buyurtmalar ochiladigan rol (G → O ruxsat).
 */
test.describe("Sarlavha tezkor tugmalari va USB skaner — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  /** «G»+«O», «g»+«o» va kartadagi «…g5o…» — hammasi bitta skaner oqimida. */
  const MARKET_QR_WITH_GO = "MCR-201-GOgo-3g5o4c";

  test("⭐ skaner oqimidagi «G» → «O» sahifani o'zgartirmaydi; skan o'tadi, buyurtma tanlanadi", async ({ page }) => {
    await withoutAudio(page);
    const { leaked, scanned, handovers } = await mockCancelledApi(page);
    await withGoOrderToken(page, handovers);
    await openHandover(page);
    await expect(page.getByText("Market QR kerak")).toBeVisible();

    // Oqim «g» → «o» bilan BOSHLANADI: 1-belgi odam tezligida kelgandek (G kutiladi), 2-si esa skaner tezligida.
    await usbScan(page, "go-3g5o4c");
    await expect(page.getByText("Bu marketning bekorlarida yo'q").first()).toBeVisible();
    await expect(page).toHaveURL(/\/new-orders\/cancelled\/201$/);

    await usbScan(page, MARKET_QR_WITH_GO);

    // Skan sahifaning o'zida qayta ishlandi (sakrab ketgan sahifa uni ko'rsatmasdi).
    await expect(page.getByText("Market QR skanerlandi")).toBeVisible();
    expect(scanned).toEqual([MARKET_QR_WITH_GO]);
    await expect(page).toHaveURL(/\/new-orders\/cancelled\/201$/);
    await expect(page.getByRole("heading", { level: 1, name: "Baraka Shop" })).toBeVisible();
    await expect(pendingOrder(page, "10235")).toBeVisible();

    // Buyurtma QR'i ham «…go…g5o…» (kartadagi takrorlash): sahifa joyida, buyurtma tanlanadi — skan = topshirish.
    await usbScan(page, ORDER_TOKEN_WITH_GO);
    await expect(pendingOrder(page, "10235")).toHaveCount(0);
    await expect(page.getByTestId("handed-over-card").getByText(/№10235(?!\d)/).first()).toBeVisible();
    expect(handovers.map((body) => body.order_ids)).toEqual([["10235"]]);
    await expect(page).toHaveURL(/\/new-orders\/cancelled\/201$/);
    expect(leaked).toEqual([]);
  });

  test("⭐ odam tezligida G, keyin O — buyurtmalar ochiladi (skandan keyin ham)", async ({ page }) => {
    await withoutAudio(page);
    await mockCancelledApi(page);
    await openHandover(page);

    // Avval skan (oqim tezkor tugma holatini «qotirib» qo'ymasin), so'ng odam tezligida «g» → «o».
    await usbScan(page, MARKET_QR_WITH_GO);
    await expect(page.getByText("Market QR skanerlandi")).toBeVisible();
    await expect(page).toHaveURL(/\/new-orders\/cancelled\/201$/);

    // Odam skandan keyin darhol (skaner oralig'i ichida) tugma bosmaydi — aks holda «g» oqimning davomi sanalardi.
    await page.waitForTimeout(SCANNER_KEY_GAP_MS + 150);
    await page.keyboard.type("go", { delay: SCANNER_KEY_GAP_MS + 150 });
    await expect(page).toHaveURL(/\/orders$/);
  });
});
