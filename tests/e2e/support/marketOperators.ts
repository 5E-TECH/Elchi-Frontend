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
  /** F2qp6FtE: `POST finance/operator-payments` tanalari va `Idempotency-Key` sarlavhalari. */
  payments: { body: unknown; key: string | null }[];
  /** F2qp6FtE: `POST finance/operator-payments/:id/cancel`. */
  cancels: { id: string; body: unknown }[];
  /** Kassa (`finance/cashbox*`) so'rovlari — operatorga to'lov Elchi kassasiga tegmasligi kerak. */
  cashboxRequests: string[];
  /** Yozish so'rovlaridan boshqa (kutilmagan) yozish so'rovlari. */
  leaked: string[];
};

/** F2qp6FtE — operatorlar hisobi (`GET finance/operator-payments/balances`). */
const BALANCES = [
  { operator_id: "41", earned: 1286500, paid: 1100000, last_paid_at: "2026-11-15" },
  { operator_id: "42", earned: 420000, paid: 450000, last_paid_at: "2026-11-10" },
  { operator_id: "43", earned: 96000, paid: 0, last_paid_at: null },
];

type PaymentRow = {
  id: string;
  operator_id: string;
  amount: number;
  paid_at: string;
  note: string | null;
  source: "market" | "elchi";
  status: "active" | "cancelled";
  cancel_reason: string | null;
};

const initialPayments = (): PaymentRow[] => [
  { id: "305", operator_id: "41", amount: 300000, paid_at: "2026-11-15", note: "Noyabr, 1-qism", source: "market", status: "active", cancel_reason: null },
  { id: "302", operator_id: "42", amount: 450000, paid_at: "2026-11-10", note: "Oktabr komissiyasi", source: "market", status: "active", cancel_reason: null },
  { id: "301", operator_id: "41", amount: 800000, paid_at: "2026-10-01", note: "Sentabr", source: "elchi", status: "active", cancel_reason: null },
];

type MockOptions = {
  empty?: boolean;
  /** Profil sozlamasidagi mavzu (sukut — yo'q, ilova sukuti kunduzgi). */
  theme?: "light" | "dark";
};

export const mockMarketOperators = async (page: Page, { empty = false, theme }: MockOptions = {}) => {
  const operators = empty ? [] : initialOperators();
  const mock: MarketOperatorsMock = { posts: [], patches: [], deletes: [], payments: [], cancels: [], cashboxRequests: [], leaked: [] };
  const payments = initialPayments();
  const nameOf = (id: string) => operators.find((item) => item.id === id)?.name ?? null;
  const paymentView = (row: PaymentRow) => ({
    ...row,
    operator_name: nameOf(row.operator_id),
    market_id: row.source === "market" ? "12" : null,
    affects_cashbox: row.source === "elchi",
    recorded_by_role: row.source === "market" ? "market" : null,
    created_at: `${row.paid_at}T09:30:00.000Z`,
    cancelled_at: row.status === "cancelled" ? new Date().toISOString() : null,
    cancelled_by_role: row.status === "cancelled" ? "market" : null,
    can_cancel: row.source === "market" && row.status === "active",
  });
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
    if (path.startsWith("finance/cashbox")) mock.cashboxRequests.push(`${method} ${path}`);
    // ── F2qp6FtE: operatorlarga to'lov (Elchi kassasiga ta'sir qilmaydi) ──
    if (path === "finance/operator-payments/balances" && method === "GET") {
      const active = payments.filter((row) => row.status === "active");
      const items = BALANCES.filter((row) => operators.some((item) => item.id === row.operator_id)).map((row) => {
        const added = active
          .filter((p) => p.operator_id === row.operator_id && !initialPayments().some((seed) => seed.id === p.id))
          .reduce((sum, p) => sum + p.amount, 0);
        const cancelled = payments
          .filter((p) => p.operator_id === row.operator_id && p.status === "cancelled")
          .reduce((sum, p) => sum + p.amount, 0);
        const paid = row.paid + added - cancelled;
        const op = operators.find((item) => item.id === row.operator_id)!;
        return {
          operator_id: row.operator_id,
          operator_name: op.name,
          status: op.status,
          earned: row.earned,
          paid,
          balance: row.earned - paid,
          payments_count: active.filter((p) => p.operator_id === row.operator_id).length,
          last_paid_at: row.last_paid_at,
        };
      });
      const sum = (key: "earned" | "paid" | "balance") => items.reduce((total, item) => total + item[key], 0);
      return reply(route, wrap({ items, totals: { earned: sum("earned"), paid: sum("paid"), balance: sum("balance") } }));
    }
    if (path === "finance/operator-payments" && method === "GET") {
      const operatorId = url.searchParams.get("operator_id");
      const rows = payments.filter((row) => !operatorId || row.operator_id === operatorId).map(paymentView);
      return reply(route, wrap({ items: rows, pagination: { total: rows.length, page: 1, limit: 20, totalPages: 1 } }));
    }
    if (path === "finance/operator-payments" && method === "POST") {
      const body = request.postDataJSON() as { operator_id: string; amount: number; paid_at: string; note?: string };
      mock.payments.push({ body, key: request.headers()["idempotency-key"] ?? null });
      const row: PaymentRow = {
        id: String(400 + mock.payments.length),
        operator_id: body.operator_id,
        amount: body.amount,
        paid_at: body.paid_at,
        note: body.note ?? null,
        source: "market",
        status: "active",
        cancel_reason: null,
      };
      payments.unshift(row);
      return reply(route, wrap({ ...paymentView(row), idempotent: false }, 201), 201);
    }
    const cancel = /^finance\/operator-payments\/(\d+)\/cancel$/.exec(path);
    if (cancel && method === "POST") {
      const body = request.postDataJSON() as { reason: string };
      mock.cancels.push({ id: cancel[1], body });
      const row = payments.find((item) => item.id === cancel[1]);
      if (row) Object.assign(row, { status: "cancelled", cancel_reason: body.reason });
      return reply(route, wrap({ ...(row ? paymentView(row) : {}), idempotent: false }));
    }
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
