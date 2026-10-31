import { describe, expect, it } from "vitest";
import routeMap from "../../../design/kit/route-map.json";
import routesSource from "./routes.tsx?raw";

/**
 * PIJN1lGp: Telegram botining «Kabinetda …» havolalari (backend `libs/common/src/telegram/cabinet-links.ts`,
 * `WEB_ROUTES`) shu FE route'lariga olib boradi. Route nomi o'zgarsa bot havolasi «Sahifa topilmadi» ga tushadi —
 * avval backend modulini ham yangilang (va shu ro'yxatni).
 */
const BOT_ROUTES = ["/", "/orders", "/orders/edit/:orderId", "/new-orders/create", "/cash-box", "/payments/shifts/:id"];

/** Bot avval yuborgan (eski) havolalar — o'chirilmaydi, yangi joyga yo'naltiriladi. */
const LEGACY_REDIRECTS: [string, RegExp][] = [
  ["/orders/create", /\{ path: "create", element: <LegacyOrderCreateRedirect \/> \}/],
  ["/payments/shift-report/:id", /\{ path: "shift-report\/:id", element: <LegacyShiftReportRedirect \/> \}/],
];

describe("Telegram bot havolalari (PIJN1lGp)", () => {
  const mapped = new Set(routeMap.routes.map((route) => route.path));

  it("har bot yo'li route-map'da bor (routes.tsx bilan `npm run design:screens -- --check` solishtiradi)", () => {
    expect(BOT_ROUTES.filter((path) => !mapped.has(path))).toEqual([]);
  });

  it("eski bot havolalari yo'naltiriladi, 404 ga tushmaydi", () => {
    for (const [path, pattern] of LEGACY_REDIRECTS) {
      expect(routesSource, path).toMatch(pattern);
      // Yo'naltirish route-map'ga yozilmaydi (screens.mjs).
      expect(mapped.has(path), path).toBe(false);
    }
  });
});
