import { test, type Page, type Route } from "@playwright/test";
import { ean13Modules } from "../../../src/test/barcodeFixtures";
import { rawProduct, rawWarehouse } from "../../../src/test/warehouseFixtures";
import { setupShellSession } from "./shellSession";

/**
 * Zavod shtrix kodi — kamera (Trello CO66kcoB) e2e yordamchilari.
 *
 * Soxta kamera: `getUserMedia` haqiqiy kadr oqimini beradi — kanvas (720 × 1280, telefon orqa kamerasi kabi tik),
 * markazida EAN-13. Kod «Qo'lda kiritish» bilan EMAS, kamera kadridan o'qiladi: `qr-scanner` → skan hududi →
 * shtrix kod dvigateli (Linux Chromium'da `BarcodeDetector` yo'q — ZXing zaxirasi) → nazorat raqami → sahifa.
 */

export const FACTORY_EAN = "4780123450017";
/** Nazorat raqami xato (to'g'risi …0017). */
export const BROKEN_EAN = "4780123450018";

/** Kanvas oqimi: fon, markazda shtrix kod; har 100 ms qayta chiziladi (kadr kelib tursin — `requestVideoFrameCallback`). */
export const mockBarcodeCamera = (page: Page, digits: string) =>
  page.addInitScript((modules: string) => {
    const devices = navigator.mediaDevices;
    if (!devices?.getUserMedia) return;
    const original = devices.getUserMedia.bind(devices);
    devices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
      if (!constraints?.video) return original(constraints);
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 1280;
      const context = canvas.getContext("2d");
      if (!context) return original(constraints);
      const moduleWidth = 4;
      const left = Math.round((canvas.width - modules.length * moduleWidth) / 2);
      let tick = 0;
      const draw = () => {
        tick += 1;
        context.fillStyle = "rgb(236, 236, 236)";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "rgb(24, 24, 24)";
        for (let index = 0; index < modules.length; index += 1) {
          if (modules[index] === "1") context.fillRect(left + index * moduleWidth, 540, moduleWidth, 200);
        }
        // Kadr o'zgarib tursin (aks holda kanvas oqimi yangi kadr bermaydi).
        context.fillRect(tick % 2, 0, 1, 1);
      };
      draw();
      window.setInterval(draw, 100);
      return canvas.captureStream(15);
    };
  }, ean13Modules(digits));

const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4194").origin;

const QUVVAT = rawProduct({
  id: "202",
  name: "Quvvatlagich 20 W",
  barcode: FACTORY_EAN,
  code: { value: FACTORY_EAN, kind: "barcode", format: "EAN-13" },
});

/**
 * Superadmin, `/warehouses/3` — ombor tafsiloti va kirim oynasi uchun soxta backend (ombor javoblari o'ramsiz).
 * `lookups` — `GET warehouses/3/lookup` ga kelgan kodlar (kamera nimani yuborganini tekshirish uchun).
 */
export const mockWarehouseCameraApi = async (page: Page) => {
  const { leaked } = await setupShellSession(page, "superadmin", "E2E Superadmin");
  const origin = appOrigin();
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
  const reply = (route: Route, body: unknown) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  const lookups: string[] = [];
  await page.route(/\/warehouses(\/3(\/[a-z-]+)?)?(\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.fallback();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (request.method() !== "GET") return route.fallback();
    const path = url.pathname.replace(/^\//, "");
    if (path === "warehouses") return reply(route, { data: [rawWarehouse()], total: 1, page: 1, limit: 20 });
    if (path === "warehouses/3") return reply(route, rawWarehouse());
    if (path === "warehouses/3/stock") {
      return reply(route, {
        warehouse: { id: "3", name: "Samarqand filiali ombori", status: "ACTIVE" },
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        facets: { levels: { all: 0, ok: 0, low: 0, out: 0 }, markets: [] },
      });
    }
    if (path === "warehouses/3/movements") return reply(route, { data: [], total: 0, page: 1, limit: 5 });
    if (path === "warehouses/3/lookup") {
      const code = url.searchParams.get("code") ?? "";
      lookups.push(code);
      const data =
        code === FACTORY_EAN
          ? [
              {
                product: QUVVAT,
                market: { id: "121", name: "Baraka Shop" },
                stock: { on_hand: 9, reserved: 2, available: 7, threshold: 10, level: "low" },
              },
            ]
          : [];
      return reply(route, { code, matched_by: data.length ? "barcode" : null, data });
    }
    return route.fallback();
  });
  return { leaked, lookups };
};
