import { type Page, type Route } from "@playwright/test";

/**
 * «Kuryerdagi buyurtmalar» (onXzDc5n) uchun soxta backend: `GET /orders?courier_hold=…` (kuryer bo'yicha ham
 * filtrlaydi) va `GET orders/courier-hold/summary`. Har ro'yxat so'rovi `listQueries` ga, yozuvchi so'rov — `leaked` ga.
 */
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

const HOUR = 3_600_000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR - 60_000).toISOString();

type Courier = { id: string; name: string; phone: string | null };
const COURIERS: Courier[] = [
  { id: "26", name: "Aziz Karimov", phone: "+998901112233" },
  { id: "27", name: "Bobur Aliyevich Abdurahmonov", phone: "+998935554433" },
];

const order = (id: number, hours: number, courier: Courier, extra: Record<string, unknown> = {}) => ({
  id: String(id),
  order_number: `EL-${100000 + id}`,
  status: hours > 60 ? "waiting" : "on the road",
  total_price: 1_250_000,
  market_id: "37",
  customer_id: String(id),
  region_id: "1",
  holder_type: "COURIER",
  holder_courier_id: courier.id,
  last_handover_at: ago(hours),
  created_at: ago(hours + 5),
  market: { id: "37", name: "Ipak Yo'li Savdo Markazi" },
  customer: { id: String(id), name: "Feruza Mirzayeva Abdulla qizi", phone_number: "+998993057164" },
  courier: { id: courier.id, name: courier.name },
  district: { id: "3", name: "Yangiyo'l tumani", region: { id: "1", name: "Toshkent viloyati" } },
  ...extra,
});

const ORDERS = [
  order(81, 98, COURIERS[0]),
  order(82, 80, COURIERS[1]),
  order(83, 40, COURIERS[0]),
  order(84, 50, COURIERS[1]),
  order(85, 10, COURIERS[0]),
];

const bucketOf = (hours: number) => (hours >= 72 ? "over_72" : hours >= 48 ? "over_48" : hours >= 36 ? "near_48" : "under_36");
const hoursOf = (row: (typeof ORDERS)[number]) => Math.floor((Date.now() - Date.parse(row.last_handover_at)) / HOUR);

const summary = (rows: typeof ORDERS) => {
  const couriers = COURIERS.map((courier) => {
    const own = rows.filter((row) => row.holder_courier_id === courier.id);
    const count = (bucket: string) => own.filter((row) => bucketOf(hoursOf(row)) === bucket).length;
    const oldest = own.reduce((max, row) => Math.max(max, hoursOf(row)), 0);
    return {
      courier_id: courier.id,
      total: own.length,
      under_36: count("under_36"),
      near_48: count("near_48"),
      over_48: count("over_48"),
      over_72: count("over_72"),
      oldest_hours: own.length ? oldest : null,
      oldest_since: own.length ? ago(oldest) : null,
      cancelled_held: courier.id === "27" ? 1 : 0,
      courier: { id: courier.id, name: courier.name, phone_number: courier.phone },
    };
  }).filter((row) => row.total > 0);
  const sum = (key: "total" | "under_36" | "near_48" | "over_48" | "over_72" | "cancelled_held") =>
    couriers.reduce((acc, row) => acc + row[key], 0);
  return {
    couriers,
    totals: {
      couriers: couriers.length,
      total: sum("total"),
      under_36: sum("under_36"),
      near_48: sum("near_48"),
      over_48: sum("over_48"),
      over_72: sum("over_72"),
      cancelled_held: sum("cancelled_held"),
      oldest_hours: Math.max(0, ...couriers.map((row) => row.oldest_hours ?? 0)),
    },
    thresholds: { near_from: 36, deadline: 48, over: 72 },
  };
};

export interface CourierHoldOptions {
  role?: string;
  theme?: "light" | "dark";
  language?: "uz" | "ru" | "en";
}

export const mockCourierHold = async (page: Page, { role = "superadmin", theme = "light", language = "uz" }: CourierHoldOptions = {}) => {
  const leaked: string[] = [];
  const listQueries: URLSearchParams[] = [];
  const summaryQueries: URLSearchParams[] = [];
  // Kuryer — faqat o'zi (backend doirasi tokendan).
  const visible = role === "courier" ? ORDERS.filter((row) => row.holder_courier_id === "26") : ORDERS;
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (request.method() !== "GET") leaked.push(`${request.method()} ${path}`);
    if (path === "auth/my-profile") {
      return reply(
        route,
        wrap({
          id: role === "courier" ? "26" : role === "market" ? "37" : "1",
          role,
          name: "E2E",
          status: "active",
          settings: { appearance: { theme, themeChosen: true, language } },
        }),
      );
    }
    if (path === "orders/courier-hold/summary") {
      summaryQueries.push(url.searchParams);
      return reply(route, wrap(summary(visible)));
    }
    if (path === "orders" && request.method() === "GET") {
      listQueries.push(url.searchParams);
      const hold = url.searchParams.get("courier_hold");
      const courierId = url.searchParams.get("courier_id");
      const rows = visible
        .filter((row) => {
          if (!hold) return true;
          const bucket = bucketOf(hoursOf(row));
          return hold === "any" || bucket === hold;
        })
        .filter((row) => !courierId || row.holder_courier_id === courierId)
        .sort((a, b) => Date.parse(a.last_handover_at) - Date.parse(b.last_handover_at));
      return reply(route, { statusCode: 200, data: rows, total: rows.length, page: 1, limit: 25 });
    }
    if (path === "orders/courier/orders/counts") return reply(route, wrap({ waiting: 0, all: 0, cancelled: 0 }));
    if (path === "orders/courier/orders") return reply(route, { statusCode: 200, data: [], total: 0, page: 1, limit: 25 });
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
  return { leaked, listQueries, summaryQueries };
};
