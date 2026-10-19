import type { Page, Route } from "@playwright/test";

/**
 * BEKOR BOSQICHI (Trello vOczoOUE, 1-bosqich) e2e uchun soxta backend: `GET /orders` ro'yxati, `GET /orders/:id`
 * va `GET /orders/:id/tracking`. Hech qanday so'rov serverga ketmaydi; yozuvchi so'rov `leaked` ga tushadi.
 * Maydonlar backend javobidagidek (`order-service` `enrichOrders`): `holder_*`, `branch`, `courier`,
 * `last_handover_at`; kuryer ro'yxati shaklidagi `transport_status: "cancelled (sent)"`.
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

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY - 3_600_000).toISOString();

const base = (id: string, name: string) => ({
  id,
  where_deliver: "address",
  total_price: 96000,
  to_be_paid: 96000,
  paid_amount: 0,
  comment: null,
  address: "Lutfiy ko'chasi, 14-uy",
  createdAt: "2026-10-04T09:15:00.000Z",
  customer: { id: `c-${id}`, name, phone_number: "+998901234567" },
  market: { id: "m7", name: "Baraka Shop", phone_number: "+998992222222" },
  district: { id: "d1", name: "Sergeli tumani", region: { id: "r1", name: "Toshkent sh." } },
  items: [],
});

/** «Bekor · HQ'da» — HQ qabul qilgan, 2 kundan beri. */
export const ORDER_AT_HQ = {
  ...base("10235", "Malika Yusupova"),
  status: "cancelled",
  holder_type: "HQ",
  holder_branch_id: null,
  holder_courier_id: null,
  canceled_post_id: null,
  branch: { id: "1", name: "Toshkent HQ" },
  return_reason: "CUSTOMER_REFUSED",
  last_handover_at: ago(2),
};

/** «Bekor · yo'lda» — qaytarish pochtasida, HQ'ga ketmoqda. */
export const ORDER_IN_TRANSIT = {
  ...base("10231", "Shahnoza Ergasheva"),
  status: "cancelled (sent)",
  holder_type: "HQ",
  canceled_post_id: "2098",
  branch: { id: "1", name: "Toshkent HQ" },
  last_handover_at: ago(0),
};

/** «Marketga topshirildi» — zanjir yopildi. */
export const ORDER_HANDED = {
  ...base("10241", "Dilnoza Karimova"),
  status: "returned_to_market",
  holder_type: "MARKET",
  branch: { id: "1", name: "Toshkent HQ" },
  last_handover_at: "2026-10-06T06:20:00.000Z",
};

const event = (id: string, at: string, fields: Record<string, unknown>) => ({
  id,
  order_id: "10235",
  changed_by: "1",
  changed_by_role: "system",
  created_at: at,
  ...fields,
});

/** HQ'dagi buyurtma tarixi: kuryer bekor qildi → HQ'ga jo'natdi → HQ qabul qildi. */
export const AT_HQ_TRACKING = [
  event("t3", "2026-10-06T20:05:00+05:00", {
    action: "cancelled_post_received",
    from_status: "cancelled (sent)",
    to_status: "cancelled",
    old_value: { status: "cancelled (sent)", canceled_post_id: "2098" },
    new_value: { status: "cancelled" },
    changed_by: "9",
    changed_by_role: "registrator",
    actor: { name: "Bobur Xolmatov", role: "registrator" },
    metadata: { canceled_post_id: "2098", destination_branch: null, received_by_hq: true },
    note: "Canceled order received by HQ and held for market handover",
  }),
  event("c2", "2026-10-06T19:15:01+05:00", {
    event_type: "custody",
    action: "custody_changed",
    old_value: { holder_type: "COURIER", holder_courier: "Akmal Rahimov, role: courier, ID: 26" },
    new_value: { holder_type: "HQ", holder_branch: null },
  }),
  event("t2", "2026-10-06T19:15:00+05:00", {
    action: "cancelled_sent",
    from_status: "cancelled",
    to_status: "cancelled (sent)",
    old_value: { status: "cancelled" },
    new_value: { status: "cancelled (sent)" },
    changed_by: "26",
    changed_by_role: "courier",
    actor: { name: "Akmal Rahimov", role: "courier" },
    note: "Canceled post created",
  }),
  event("t1", "2026-10-06T16:40:00+05:00", {
    action: "cancelled",
    from_status: "waiting",
    to_status: "cancelled",
    old_value: { status: "waiting" },
    new_value: { status: "cancelled" },
    changed_by: "26",
    changed_by_role: "courier",
    actor: { name: "Akmal Rahimov", role: "courier" },
  }),
];

/** Topshirilgan buyurtma tarixi: yuqoridagi + QR bilan topshirish. */
export const HANDED_TRACKING = [
  event("t4", "2026-10-07T11:20:00+05:00", {
    order_id: "10241",
    action: "returned_to_market",
    from_status: "cancelled",
    to_status: "returned_to_market",
    old_value: { status: "cancelled" },
    new_value: { status: "returned_to_market" },
    changed_by: "9",
    changed_by_role: "registrator",
    actor: { name: "Bobur Xolmatov", role: "registrator" },
    note: "Bekor qilingan order market m7ga QR tasdiqi bilan topshirildi",
  }),
  ...AT_HQ_TRACKING.map((item) => ({ ...item, order_id: "10241" })),
];

export const SUPERADMIN = { id: "1", role: "superadmin", name: "Bosh admin", status: "active" };
export const MANAGER = {
  id: "501",
  role: "manager",
  name: "Ravshan Ortiqov",
  status: "active",
  branch_id: "12",
  branch: { id: "12", name: "Urgut filiali", type: "REGIONAL" },
};

export const mockCancelStagesApi = async (
  page: Page,
  options: {
    profile?: Record<string, unknown>;
    list?: Record<string, unknown>[];
    details?: Record<string, unknown>[];
    tracking?: Record<string, unknown[]>;
  } = {},
) => {
  const leaked: string[] = [];
  const listQueries: URLSearchParams[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") return reply(route, wrap(options.profile ?? SUPERADMIN));
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    if (path === "orders") {
      listQueries.push(url.searchParams);
      const items = options.list ?? [];
      return reply(route, { statusCode: 200, data: items, total: items.length, page: 1, limit: 25 });
    }
    const tracking = /^orders\/([^/]+)\/tracking$/.exec(path);
    if (tracking) {
      const events = options.tracking?.[tracking[1]] ?? [];
      return reply(route, { data: events, total: events.length, page: 1, limit: 100 });
    }
    const detail = /^orders\/([^/]+)$/.exec(path);
    const found = detail ? options.details?.find((item) => String(item.id) === detail[1]) : undefined;
    if (found) return reply(route, wrap(found));
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
  return { leaked, listQueries };
};
