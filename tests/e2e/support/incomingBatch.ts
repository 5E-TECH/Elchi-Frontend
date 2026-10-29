import { expect, type Page, type Route } from "@playwright/test";

/**
 * Kiruvchi posilkalar (`/new-orders/incoming/:marketId`) e2e — soxta backend.
 * Andijon E2E qopi: token 30d2894f58d3f89170a612c8, 6 posilka (CbKnJLZO).
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

export const BATCH_TOKEN = "30d2894f58d3f89170a612c8";
/** Hamkor qop id'si — «Qop» ustunida ko'rinadi (IP-1). */
export const BATCH_REF = "BP-24817";
export const BATCH_ORDERS = [1251162, 1251163, 1251164, 1251165, 1251166, 1251167].map((id, index) => ({
  id: String(id),
  order_number: id,
  status: "new",
  total_price: 150000 + index * 10000,
  qr_code_token: `2afcc394ca289bf23aee44d${index}`,
  external_batch_token: BATCH_TOKEN,
  external_batch_ref: BATCH_REF,
  external_batch_size: 6,
  customer: { name: `Andijon mijoz ${index + 1}`, district: { name: "Andijon sh." } },
}));
export const OTHER_ORDER = {
  id: "1251199",
  order_number: 1251199,
  status: "new",
  total_price: 99000,
  qr_code_token: "boshqa-qop-posilka",
  customer: { name: "Boshqa qop mijozi", district: { name: "Asaka" } },
};

/**
 * `options.items` — ro'yxatni har so'rovda qaytaradigan funksiya (sukut: qop + boshqa posilka). Testda ro'yxatni
 * o'zgartirib «Yangilash» qilish uchun (masalan boshqa joyda qabul qilingan posilka chiqib ketadi).
 */
export const mockIncomingApi = async (page: Page, options: { items?: () => unknown[] } = {}) => {
  const leaked: string[] = [];
  const received: string[][] = [];
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
    if (path === "orders/external/sources") {
      return reply(route, wrap([{ market_id: "121", orders_count: 7, total_price_sum: 1299000, oldest_at: null, market: { id: "121", name: "BeePost Andijon" } }]));
    }
    if (path === "orders/external") {
      const items = options.items?.() ?? [...BATCH_ORDERS, OTHER_ORDER];
      return reply(route, { statusCode: 200, data: items, total: items.length });
    }
    if (path === "orders/external/receive-by-scan" && request.method() === "POST") {
      const tokens = (request.postDataJSON() as { tokens: string[] }).tokens;
      received.push(tokens);
      return reply(route, wrap({ received: tokens.length, unmatched: [] }));
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
  return { leaked, received };
};

export const openIncoming = async (page: Page) => {
  await page.goto("/new-orders/incoming/121");
  await expect(page.getByText("Andijon mijoz 6")).toBeVisible({ timeout: 60_000 });
};

/** Skaner klaviatura kabi: token yoziladi va Enter. */
export const scanToken = async (page: Page, token: string) => {
  const input = page.getByPlaceholder("QR kodni skanerlang yoki kiriting...");
  await input.fill(token);
  await input.press("Enter");
};

/** Belgilangan posilkalar (jadval qatorida ham, telefon kartasida ham skan belgisi `incoming-parcel`). */
export const scannedRowIds = (page: Page) =>
  page
    .locator('[data-testid="incoming-parcel"][data-scanned="true"]')
    .evaluateAll((rows) => rows.map((row) => (row as HTMLElement).dataset.orderId));

/** «Skanerlangan N / M» — chiziq (`progressbar`) qiymatlari. */
export const expectScanned = async (page: Page, scanned: number, total: number) => {
  const bar = page.getByRole("progressbar", { name: "Skanerlangan posilkalar" });
  await expect(bar).toHaveAttribute("aria-valuenow", String(scanned));
  await expect(bar).toHaveAttribute("aria-valuemax", String(total));
};
