import type { Page, Route } from "@playwright/test";

/**
 * «Mahsulotlar» (`/products`, `/products/create-product/:id`) e2e — soxta backend (3qDsJpfW, MH-1).
 * Market (id 7, «Baraka Shop») — 14 mahsulot, boshqa market (id 3, «Nur Savdo») — 15; har 5-mahsulot narxsiz.
 * `GET product/my-products` (market / market operatori; `unassigned()` → 400), `GET product`, `GET product/market/3`
 * serverdek sahifalanadi (`search` / `page` / `limit` ≤ 500, sukut 10); `PATCH product/:id` yoziladi (`patches`).
 */
/** Dev server manzili (worktree probe'larida boshqa port — `E2E_ORIGIN`). */
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4173";
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

const product = (n: number, marketId: string) => ({
  id: String((marketId === "7" ? 100 : 200) + n),
  name: `Mahsulot ${String(n).padStart(2, "0")}`,
  image_url: null,
  // Har 5-mahsulot narxsiz (`null`) — ro'yxatda «—».
  price: n % 5 === 0 ? null : 10_000 * n,
  user_id: marketId,
  market: {
    id: marketId,
    name: marketId === "7" ? "Baraka Shop" : "Nur Savdo",
    phone_number: "+998901234567",
    status: "active",
  },
  createdAt: "2026-10-01T09:00:00.000Z",
});

const page = (items: unknown[], params: URLSearchParams) => {
  const search = (params.get("search") ?? "").toLowerCase();
  const filtered = search
    ? items.filter((item) => (item as { name: string }).name.toLowerCase().includes(search))
    : items;
  const limit = Math.min(500, Number(params.get("limit")) || 10);
  const current = Number(params.get("page")) || 1;
  return {
    statusCode: 200,
    data: filtered.slice((current - 1) * limit, current * limit),
    total: filtered.length,
    page: current,
    limit,
  };
};

export type ProductsRole = "market" | "superadmin" | "market_operator";

export const mockProductsApi = async (
  p: Page,
  role: ProductsRole,
  options: { unassigned?: () => boolean } = {},
) => {
  const requests: URLSearchParams[] = [];
  const patches: { path: string; body: string }[] = [];
  const marketItems = Array.from({ length: 14 }, (_, i) => product(i + 1, "7"));
  const otherItems = Array.from({ length: 15 }, (_, i) => product(i + 1, "3"));
  const profileId = role === "market" ? "7" : role === "market_operator" ? "31" : "1";
  const profileName =
    role === "market" ? "Baraka Shop" : role === "market_operator" ? "Operator" : "E2E";
  await p.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, {
        statusCode: 200,
        data: { id: profileId, role, name: profileName, status: "active", add_order: true },
      });
    }
    if (path === "product/my-products") {
      requests.push(url.searchParams);
      if (options.unassigned?.()) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          headers: cors,
          body: JSON.stringify({
            statusCode: 400,
            message: "Operator hech qaysi marketga biriktirilmagan",
          }),
        });
      }
      return reply(route, page(marketItems, url.searchParams));
    }
    if (path === "product") {
      requests.push(url.searchParams);
      return reply(route, page([...marketItems, ...otherItems], url.searchParams));
    }
    if (path === "product/market/3") {
      requests.push(url.searchParams);
      return reply(route, page(otherItems, url.searchParams));
    }
    if (request.method() === "PATCH" && path.startsWith("product/")) {
      patches.push({ path, body: request.postDataBuffer()?.toString("utf8") ?? "" });
      return reply(route, { statusCode: 200, data: marketItems[0] });
    }
    if (/^product\/\d+$/.test(path)) {
      return reply(route, {
        statusCode: 200,
        data: [...marketItems, ...otherItems].find((item) => item.id === path.slice(8)),
      });
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await p.addInitScript(() => {
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
  return { requests, patches };
};
