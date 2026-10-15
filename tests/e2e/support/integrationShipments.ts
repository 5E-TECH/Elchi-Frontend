import { expect, type Page, type Route } from "@playwright/test";

/**
 * Integratsiya → Posilkalar / Hodisalar (tokhPLMP) — soxta backend.
 *
 * Ikki ulanish: #7 "Elchi" — status xaritasi BOR (`counts.mismatch` son),
 * #8 "Xaritasiz kargo" — xarita YO'Q (`counts.mismatch: null`).
 * Backend kabi: `filter` / `invalid_signature` parametrlari bo'yicha qatorlar
 * serverda filtrlanadi, sanoqlar BITTA javobdagi `counts` da keladi.
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

const integration = (id: number, name: string) => ({
  id,
  name,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  type: "api",
  role: "carrier",
  category: "cargo",
  is_active: true,
  base_url: "https://api.example.uz",
  auth_type: "api_key",
  last_sync_at: "2026-10-13T10:00:00.000Z",
});

const shipment = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  order_id: String(1250 + id),
  integration_id: "7",
  provider_slug: "elchi",
  external_ref: `EXT-${id}`,
  tracking_number: `ELC${100200 + id}`,
  provider_status: "in_transit",
  internal_status: "on_the_road",
  status_changed_at: "2026-10-13T09:30:00.000Z",
  send_attempts: 1,
  last_error: null,
  order: {
    id: String(1250 + id),
    order_number: String(1250 + id),
    status: "on_the_road",
    total_price: 1250000 + id * 1000,
    customer_name: `Mijoz ${id} Aliyev`,
    customer_phone: `+99890123${String(4560 + id)}`,
    region_name: "Toshkent shahri",
    district_name: "Chilonzor tumani",
  },
  ...over,
});

/** 4 ta posilka: #2 da biz/ular statusi AJRALGAN (ular "delivered", biz "waiting"), #3 da xato. */
export const SHIPMENTS = [
  shipment(1),
  shipment(2, { provider_status: "delivered", internal_status: "waiting", mismatch: true }),
  shipment(3, { last_error: "HTTP 502 Bad Gateway", send_attempts: 3, provider_status: null, internal_status: "new" }),
  shipment(4, { provider_status: "delivered", internal_status: "sold" }),
];

const webhook = (id: number, signatureValid: boolean, over: Record<string, unknown> = {}) => ({
  id: String(id),
  createdAt: "2026-10-13T09:00:00.000Z",
  integration_id: "7",
  provider_slug: "elchi",
  delivery_id: `dlv-${id}`,
  event_type: "status.updated",
  signature_valid: signatureValid,
  status: signatureValid ? "processed" : "rejected",
  error: signatureValid ? "apply: status_applied" : "signature mismatch (HMAC)",
  processed_at: null,
  trace_id: null,
  ...over,
});
export const WEBHOOKS = [webhook(1, true), webhook(2, false), webhook(3, true), webhook(4, false, { event_type: "order.cancelled" })];

export const mockShipmentsApi = async (page: Page, profile: Record<string, unknown> = { id: "1", role: "superadmin" }) => {
  const leaked: string[] = [];
  const requests: string[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    requests.push(`${request.method()} ${path}${url.search}`);

    if (path === "auth/my-profile") return reply(route, wrap({ name: "E2E", status: "active", ...profile }));
    if (path === "admin/partners") return reply(route, wrap([]));
    if (path === "integrations") {
      return reply(
        route,
        wrap({ items: [integration(7, "Elchi"), integration(8, "Xaritasiz kargo")], meta: { total: 2, page: 1, limit: 100, totalPages: 1 } }),
      );
    }
    const shipments = /^integrations\/(7|8)\/shipments$/.exec(path);
    if (shipments) {
      const withMap = shipments[1] === "7";
      const filter = url.searchParams.get("filter") ?? "all";
      const items = SHIPMENTS.filter((row) =>
        filter === "mismatch"
          ? row.mismatch === true
          : filter === "failed"
            ? Boolean(row.last_error)
            : filter === "delivered"
              ? row.internal_status === "sold"
              : filter === "not_sent"
                ? false
                : true,
      );
      return reply(
        route,
        wrap({
          items,
          pagination: { page: 1, limit: 20, total: items.length, totalPages: 1 },
          counts: { all: 4, not_sent: 0, failed: 1, delivered: 1, mismatch: withMap ? 1 : null },
        }),
      );
    }
    if (path === "integrations/webhook-logs") {
      const invalid = url.searchParams.get("invalid_signature") === "true";
      const items = invalid ? WEBHOOKS.filter((row) => !row.signature_valid) : WEBHOOKS;
      return reply(
        route,
        wrap({
          items,
          meta: { page: 1, limit: 20, total: items.length, totalPages: 1 },
          counts: { all: 4, processed: 2, verified: 0, rejected: 2, invalid_signature: 2 },
        }),
      );
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
  return { leaked, requests };
};

export const openShipments = async (page: Page, id = 7) => {
  await page.goto(`/integrations/connections?scope=external&c=integration:${id}&t=shipments`);
  await expect(page.locator(".ant-table-tbody tr.ant-table-row").first()).toBeVisible({ timeout: 60_000 });
};

/** Posilka qatori — mijoz ismi bo'yicha. */
export const shipmentRow = (page: Page, name: string) =>
  page.locator(".ant-table-tbody tr.ant-table-row").filter({ hasText: name });

/**
 * Qotirilgan ustunlar ("Buyurtma" chapda, "Amal" o'ngda — sarlavha va
 * katakchalar): foni to'liq shaffofmas, ostidan boshqa ustun matni ko'rinmaydi.
 */
export const fixedActionColumnProblems = (page: Page) =>
  page.evaluate(() => {
    const problems: string[] = [];
    const alpha = (color: string) => {
      const m = /rgba?\(([^)]+)\)/.exec(color);
      if (!m) return color === "transparent" ? 0 : 1;
      const parts = m[1].split(/[\s,/]+/).filter(Boolean);
      return parts.length > 3 ? Number(parts[3]) : 1;
    };
    const right = document.querySelectorAll(".ant-table-cell-fix-right, .ant-table-cell-fix-end");
    const left = document.querySelectorAll(".ant-table-cell-fix-left, .ant-table-cell-fix-start");
    if (!right.length) problems.push("qotirilgan o'ng ustun yo'q");
    if (!left.length) problems.push("qotirilgan chap ustun yo'q");
    const cells = [...Array.from(right), ...Array.from(left)] as HTMLElement[];
    for (const cell of cells) {
      const bg = getComputedStyle(cell).backgroundColor;
      if (alpha(bg) < 1) problems.push(`${cell.tagName} "${cell.textContent?.trim()}" fon=${bg}`);
    }
    return problems;
  });
