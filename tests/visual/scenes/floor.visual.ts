import type { ApiRequest } from "../support/mockApi";
import { reply } from "../support/mockApi";
import { FIXED_NOW_MS } from "../support/stabilize";
import { defineScene, expect, fixture } from "../support/test";

/**
 * «Ish joyi» sahnasi (bosqich B): «Kuryerga biriktirish» (`/dispatch`, HQ registratori) — USB skaner bilan 3 ta
 * buyurtma qo'shilgan (hammasi tanlangan), filialda 2 ta faol kuryer. Ma'lumot sintetik
 * (`tests/visual/fixtures/dispatch/`), buyurtmalar maketdagi birinchi uchtasi.
 *
 * USB (HID) skaner — tez tugmalar + Enter (`useKeyboardScanner`, oynada tinglaydi). Skan darvozasi
 * (`useScannerGate`) `Date.now()` ga tayanadi, soat esa muzlatilgan: har skandan oldin soat 1 s oldinga
 * qo'yiladi (darvoza 150/250 ms pauzasi o'tadi), oxirida yana `FIXED_NOW` ga qaytariladi — natija doimiy.
 */

const ORDERS = fixture<Record<string, Record<string, unknown>>>("dispatch/orders.json");
const TOKENS = Object.keys(ORDERS);

defineScene({
  id: "dispatch",
  route: "/dispatch",
  role: "registrator",
  branchType: "HQ",
  maket: ["registrator-dispatch-list"],
  api: {
    // Filialga cheklangan rol: `page=1&limit=100&status=active`, `region_id` siz.
    "GET couriers": fixture("dispatch/couriers.json"),
    "GET orders/qr-code/:token": ({ params }: ApiRequest) => {
      const order = ORDERS[params.token];
      return order ? { statusCode: 200, data: order } : reply({ statusCode: 404, message: "Buyurtma topilmadi" }, 404);
    },
  },
  act: async (page) => {
    await expect(page.getByText("Skanerlangan buyurtmalar", { exact: true })).toBeVisible();
    // «USB skaner tayyor» belgisi faqat ≥ 768 da (telefonda «Kamera» pastki panelda, belgisiz).
    if ((page.viewportSize()?.width ?? 1440) >= 768) {
      await expect(page.getByText("USB skaner tayyor", { exact: true })).toBeVisible();
    }
    for (const [index, token] of TOKENS.entries()) {
      await page.clock.setFixedTime(FIXED_NOW_MS + (index + 1) * 1000);
      await page.keyboard.type(token);
      await page.keyboard.press("Enter");
      const id = String(ORDERS[token].id);
      await expect(page.getByText(`№${id}`).first()).toBeVisible();
    }
    await page.clock.setFixedTime(FIXED_NOW_MS);
    await expect(page.getByText(`${TOKENS.length} ta buyurtma tanlandi`).first()).toBeVisible();
    // «Skanerlandi» chaqnashi (`ScanFeedbackOverlay`, butun ekran, 900 ms taymer) yopilguncha — suratda bo'lmasin.
    await expect(page.getByRole("status").filter({ hasText: "Skanerlandi" })).toHaveCount(0);
  },
});
