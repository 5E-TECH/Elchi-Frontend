import { expect, type Page, type Route } from "@playwright/test";

/**
 * `/market-operators` (MO-1) — soxta backend: MARKET («Baraka Shop»), 5 ta operator (biri nofaol, ikkitasi
 * komissiyasiz). `POST` / `PATCH :id/commission` / `DELETE :id` tanalarini yozib oladi va ro'yxatni yangilaydi.
 * Serverga so'rov ketmaydi (jonli kanal WebSocket'i ham yopiladi).
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
const wrap = (data: unknown, statusCode = 200) => ({ statusCode, message: "ok", data });

type Operator = {
  id: string;
  name: string;
  phone_number: string;
  role: "market_operator";
  status: "active" | "inactive";
  market_id: string;
  commission_type: "percent" | "fixed" | null;
  commission_value: number | null;
  /** XtcEyQjb: «Ombordagi qoldiqni ko'radi» (sukut `false`). */
  can_view_warehouse_stock: boolean;
  createdAt: string;
};

const operator = (id: string, name: string, phone: string, extra: Partial<Operator> = {}): Operator => ({
  id,
  name,
  phone_number: phone,
  role: "market_operator",
  status: "active",
  market_id: "12",
  commission_type: null,
  commission_value: null,
  can_view_warehouse_stock: false,
  createdAt: "2026-09-02T09:05:00+05:00",
  ...extra,
});

const initialOperators = (): Operator[] => [
  operator("41", "Madina Xoliqova", "+998902143658", { commission_type: "percent", commission_value: 5, createdAt: "2026-08-12T10:15:00+05:00" }),
  operator("42", "Sevara Usmonova", "+998935071244", { commission_type: "fixed", commission_value: 3000, createdAt: "2026-08-20T16:40:00+05:00" }),
  operator("43", "Kamola Rasulova", "+998916402713", { status: "inactive", commission_type: "percent", commission_value: 3.5, createdAt: "2026-09-15T11:30:00+05:00" }),
  operator("44", "Dilfuza Qodirova", "+998941187032"),
  operator("45", "Nodira Aliyeva", "+998974551820"),
];

export type MarketOperatorsMock = {
  posts: unknown[];
  patches: { id: string; body: unknown }[];
  deletes: string[];
  /** Yozish so'rovlaridan boshqa (kutilmagan) yozish so'rovlari. */
  leaked: string[];
};

type MockOptions = {
  empty?: boolean;
  /** Profil sozlamasidagi mavzu (sukut — yo'q, ilova sukuti kunduzgi). */
  theme?: "light" | "dark";
};

export const mockMarketOperators = async (page: Page, { empty = false, theme }: MockOptions = {}) => {
  const operators = empty ? [] : initialOperators();
  const mock: MarketOperatorsMock = { posts: [], patches: [], deletes: [], leaked: [] };
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    const method = request.method();
    if (path === "auth/my-profile") {
      return reply(
        route,
        wrap({
          id: "12",
          role: "market",
          name: "Baraka Shop",
          status: "active",
          ...(theme ? { settings: { appearance: { theme, themeChosen: true } } } : {}),
        }),
      );
    }
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 0 }));
    if (path === "market-operators" && method === "GET") {
      const status = url.searchParams.get("status");
      const items = status ? operators.filter((item) => item.status === status) : operators;
      return reply(route, wrap({ items, meta: { page: 1, limit: 20, total: items.length, totalPages: 1 } }));
    }
    if (path === "market-operators" && method === "POST") {
      const body = request.postDataJSON() as { name: string; phone_number: string };
      mock.posts.push(body);
      const created = operator(String(46 + mock.posts.length), body.name, body.phone_number, {
        createdAt: new Date().toISOString(),
      });
      operators.unshift(created);
      return reply(route, wrap(created, 201), 201);
    }
    const commission = /^market-operators\/(\d+)\/commission$/.exec(path);
    if (commission && method === "PATCH") {
      const body = request.postDataJSON() as Pick<Operator, "commission_type" | "commission_value">;
      mock.patches.push({ id: commission[1], body });
      const target = operators.find((item) => item.id === commission[1]);
      if (target) Object.assign(target, body);
      return reply(route, wrap(target ?? {}));
    }
    // XtcEyQjb: «Ombordagi qoldiqni ko'radi» kaliti — `{ can_view_warehouse_stock }`, javob — yangilangan qator.
    const access = /^market-operators\/(\d+)\/warehouse-access$/.exec(path);
    if (access && method === "PATCH") {
      const body = request.postDataJSON() as Pick<Operator, "can_view_warehouse_stock">;
      mock.patches.push({ id: access[1], body });
      const target = operators.find((item) => item.id === access[1]);
      if (target) Object.assign(target, body);
      return reply(route, wrap(target ?? {}));
    }
    const byId = /^market-operators\/(\d+)$/.exec(path);
    if (byId && method === "DELETE") {
      mock.deletes.push(byId[1]);
      const index = operators.findIndex((item) => item.id === byId[1]);
      if (index >= 0) operators.splice(index, 1);
      return reply(route, wrap({ id: byId[1] }));
    }
    if (method !== "GET") {
      mock.leaked.push(`${method} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, wrap({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }));
  });
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return mock;
};

export const openMarketOperators = async (page: Page, options: MockOptions = {}) => {
  const mock = await mockMarketOperators(page, options);
  await page.goto("/market-operators");
  await expect(page.getByRole("heading", { level: 1, name: "Operatorlar" })).toBeVisible({ timeout: 90_000 });
  if (!options.empty) await expect(page.getByText("Madina Xoliqova").first()).toBeVisible({ timeout: 30_000 });
  return mock;
};

/** Sahifada gorizontal oqib ketish yo'q (hujjat ham, shell kontenti ham). */
export const expectNoHorizontalOverflow = async (page: Page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(
    await page.locator("[data-shell-slot=content]").evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
};
