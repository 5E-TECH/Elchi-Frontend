import { expect, type Page, type Route } from "@playwright/test";

/**
 * Bekor qilinganlarni marketga topshirish (`/new-orders/cancelled/:marketId`) e2e — soxta backend.
 * Biznes qoida: marketga jo'natish FAQAT market QR skanerlangach (skanerlansa — barcha bekorlar tanlanadi va
 * topshirish tokeni olinadi); buzilgan buyurtma QR — «QR buzilganini tasdiqlash» oynasi (sabab — enum kodi).
 */
const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

export const MARKET_QR = "MCR-201-e2e-0001";
export const CANCELLED_ORDERS = [
  ["10235", "Malika Yusupova", 96000],
  ["10220", "Dilfuza Hasanova", 245000],
  ["10213", "Kamron Islomov", 420000],
].map(([id, name, total]) => ({
  id,
  status: "cancelled",
  where_deliver: "center",
  total_price: total,
  paid_amount: 0,
  to_be_paid: 0,
  createdAt: "2026-10-05T08:00:00.000Z",
  comment: null,
  address: null,
  qr_code_token: `tok-${id}`,
  items: [{ id: `i-${id}`, product_id: "p1", quantity: 1, product: { id: "p1", name: "Qishki shapka" } }],
  customer: { id: `c-${id}`, name, phone_number: "+998901112233" },
  district: { id: "d1", name: "Sergeli tumani", region: { id: "r1", name: "Toshkent sh." } },
  market: { id: "201", name: "Baraka Shop", cancelled_handover_qr_required: true },
}));

export type HandoverBody = { order_ids: string[]; authorization_token?: string; manual_overrides?: unknown };

export const mockCancelledApi = async (page: Page) => {
  const leaked: string[] = [];
  const scanned: string[] = [];
  const handovers: HandoverBody[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, wrap({ id: "1", role: "superadmin", name: "Bosh admin", status: "active" }));
    }
    if (path === "orders/markets/201/cancelled") return reply(route, wrap(CANCELLED_ORDERS));
    if (path === "scan/market-cancelled" && request.method() === "POST") {
      scanned.push((request.postDataJSON() as { qr_token: string }).qr_token);
      return reply(route, wrap({ authorization_token: "auth-e2e", remaining_seconds: 300 }));
    }
    if (path === "orders/markets/201/cancelled/handover" && request.method() === "POST") {
      handovers.push(request.postDataJSON() as HandoverBody);
      return reply(route, wrap({ ok: true }));
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, wrap([]));
  });
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return { leaked, scanned, handovers };
};

export const openHandover = async (page: Page) => {
  await page.goto("/new-orders/cancelled/201");
  await expect(page.getByRole("heading", { level: 1, name: "Baraka Shop" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Kamron Islomov")).toBeVisible();
};

/** USB skaner — klaviatura kabi tez yozadi va Enter bosadi (maydonda emas, sahifada). */
export const usbScan = async (page: Page, value: string) => {
  await page.keyboard.type(value, { delay: 10 });
  await page.keyboard.press("Enter");
};
