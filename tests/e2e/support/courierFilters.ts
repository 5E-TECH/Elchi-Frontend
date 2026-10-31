import type { Page, Route } from "@playwright/test";

/**
 * Kuryer buyurtmalari filtrlari (yKtzKXeM) — soxta backend `GET orders/courier/orders` ni o'zi filtrlaydi
 * (`search` — ism, telefon, raqam; `startDate`/`endDate` — kun; sahifalash) va har so'rov parametrlarini saqlaydi.
 */
const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: cors,
    body: JSON.stringify(body),
  });

/** Toshkent kuni — ilova `startDate` ni shu bo'yicha yuboradi. */
export const tashkentToday = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);

const order = (id: number, name: string, phone: string, day: string) => ({
  id: String(id),
  created_at: `${day}T08:00:00.000Z`,
  status: "waiting",
  total_price: 310_000,
  to_be_paid: 280_000,
  where_deliver: "address",
  product_quantity: 1,
  market: { name: "Ipak Yo'li Savdo" },
  customer: { name, phone_number: phone },
  district: { name: "Toshkent tumani" },
  region: { name: "Toshkent viloyati" },
  items: [],
});

export const OLD_DAY = "2026-01-15";

const ORDERS = [
  order(10234, "Feruza Mirzayeva", "+998993057164", tashkentToday()),
  order(10235, "Jasur Karimov", "+998901112233", OLD_DAY),
  ...Array.from({ length: 21 }, (_, i) =>
    order(11000 + i, `Mijoz ${i + 1}`, `+9989055500${String(i).padStart(2, "0")}`, OLD_DAY),
  ),
];

const matches = (row: (typeof ORDERS)[number], params: URLSearchParams) => {
  const search = params.get("search")?.toLowerCase() ?? "";
  const hay = `${row.customer.name} ${row.customer.phone_number} ${row.id}`.toLowerCase();
  const day = row.created_at.slice(0, 10);
  return (
    hay.includes(search) &&
    day >= (params.get("startDate") ?? "0000") &&
    day <= (params.get("endDate") ?? "9999")
  );
};

export const mockCourierFilters = async (page: Page) => {
  const requests: URLSearchParams[] = [];
  const leaked: string[] = [];
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, {
        statusCode: 200,
        data: { id: "26", role: "courier", name: "Kuryer", status: "active" },
      });
    }
    if (path === "orders/courier/orders/counts") {
      return reply(route, { statusCode: 200, data: { waiting: 23, all: 23, cancelled: 0 } });
    }
    if (path === "orders/courier/orders") {
      requests.push(url.searchParams);
      const found = ORDERS.filter((row) => matches(row, url.searchParams));
      const current = Number(url.searchParams.get("page") ?? 1);
      const limit = Number(url.searchParams.get("limit") ?? 10);
      return reply(route, {
        statusCode: 200,
        data: found.slice((current - 1) * limit, current * limit),
        total: found.length,
        page: current,
        limit,
      });
    }
    if (request.method() !== "GET") leaked.push(`${request.method()} ${path}`);
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({
        accessTokenExpiresAt: far,
        refreshTokenExpiresAt: far,
        refreshTokenWarnAt: far,
      }),
    );
  });
  return { requests, leaked };
};
