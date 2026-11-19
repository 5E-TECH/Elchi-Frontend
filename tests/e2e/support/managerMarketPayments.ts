import { expect, type Page, type Route } from "@playwright/test";

/**
 * Menejer — marketga (ega 2026-11-11, BeePost kabi) e2e uchun soxta backend: Urgut filiali menejeri, ochiq smena,
 * filial kassasi — P0 63HO6cBU (ega 2026-11-17, BE PR-A): bitta jami (`balance_cash` = `balance`, `balance_card` 0),
 * kartalar o'chiq (`cards_disabled: true`), market va kuryer kassalari. Pul POST lari (`payment/market`,
 * `payment/courier`, `cards/transfer`, `cards/convert`) yoziladi; ruxsatsiz boshqa yozish — `leaked`.
 *
 * 63HO6cBU (BE PR-C) — menejer faqat o'z filiali marketlariga, «To'lash mumkin» (`payable`) doirasida:
 *  - `GET finance/cashbox/manager/markets` — `{ branch_id, items: [{ market_id, name, status, branch_share, payable }],
 *    total_share, total_payable, pagination }`; `list: "503"` — birinchi so'rov(lar) 503, «Qayta urinish» dan keyin
 *    ro'yxat; `list: "empty"` — bo'sh;
 *  - `GET finance/cashbox/user/:marketId` — `{ cashbox: { id: null, balance: <ulush> }, branch_share, payable, user,
 *    history: [] }`; `view: "403" | "503"`;
 *  - `POST finance/cashbox/payment/market` — `pay: "403" | "400" | "503"` (backend matnlari).
 * `GET /markets` menejerda so'ralmasligi kerak — `marketsListCalls`. `role: "superadmin"` — HQ yo'li (o'zgarmagan):
 * `GET /markets`, `payment_method` bilan to'lov.
 */
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });
const fail = (route: Route, status: number, message: string) =>
  reply(route, { statusCode: status, message, error: status === 403 ? "Forbidden" : "Error" }, status);

/** Superadmin «Berilishi kerak» — `GET /markets` (HQ yo'li, o'zgarmagan). */
export const MANAGER_MARKETS = [
  { id: "2", name: "Baraka Shop", status: "active", phone_number: "+998901112233", cashbox: { balance: 4_820_000 } },
  { id: "3", name: "Ipak Yo'li Savdo", status: "active", phone_number: "+998901112244", cashbox: { balance: 1_250_000 } },
];

/**
 * Menejer filiali marketlari (ulush bo'yicha kamayib): Baraka Shop — ulush 4,82 mln, «To'lash mumkin» 1,25 mln
 * (marketga qarz kamroq); Oila Market — ulush bor, «To'lash mumkin» 0 (HQ oldindan to'lagan) — tanlanmaydi.
 */
export const BRANCH_MARKETS = [
  { market_id: "2", name: "Baraka Shop", status: "active", branch_share: 4_820_000, payable: 1_250_000 },
  { market_id: "3", name: "Ipak Yo'li Savdo", status: "active", branch_share: 900_000, payable: 900_000 },
  { market_id: "7", name: "Oila Market", status: "active", branch_share: 300_000, payable: 0 },
];

export const SHARE_CHECK_FAILED = "Filial ulushini tekshirib bo'lmadi — birozdan so'ng qayta urinib ko'ring";
export const NOT_BRANCH_MARKET = "Bu market sizning filialingizga buyurtma topshirmaydi — to'lov HQ orqali";
export const PAYABLE_EXCEEDED = "Summa to'lash mumkin bo'lgan summadan oshib ketdi (To'lash mumkin: 1 250 000 so'm)";

type Payment = { path: string; body: Record<string, unknown>; idempotencyKey?: string };

export type ManagerMarketPaymentsMock = {
  theme?: "light" | "dark";
  role?: "manager" | "superadmin";
  list?: "ok" | "503" | "empty";
  view?: "ok" | "403" | "503";
  pay?: "ok" | "403" | "400" | "503";
};

const managerMarketsBody = (empty: boolean) => {
  const items = empty ? [] : BRANCH_MARKETS;
  return wrap({
    branch_id: "16",
    items,
    total_share: items.reduce((sum, item) => sum + item.branch_share, 0),
    total_payable: items.reduce((sum, item) => sum + item.payable, 0),
    pagination: { total: items.length, page: 1, limit: 100, totalPages: items.length ? 1 : 0 },
  });
};

export const mockManagerMarketPayments = async (
  page: Page,
  { theme = "light", role = "manager", list = "ok", view = "ok", pay = "ok" }: ManagerMarketPaymentsMock = {},
) => {
  const payments: Payment[] = [];
  const leaked: string[] = [];
  const managerMarketsQueries: string[] = [];
  let marketsListCalls = 0;
  let listFailuresLeft = list === "503" ? 2 : 0; // 5xx — ilova bir marta o'zi qayta so'raydi.
  const isManager = role === "manager";
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    const method = request.method();
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");

    if (path === "auth/my-profile") {
      return reply(
        route,
        wrap(
          isManager
            ? {
                id: "42",
                role: "manager",
                name: "Ravshan Ortiqov",
                status: "active",
                branch_id: "16",
                branch_type: "REGIONAL",
                branch: { id: "16", name: "Urgut filiali", type: "REGIONAL" },
                settings: { appearance: { theme, themeChosen: true } },
              }
            : {
                id: "1",
                role: "superadmin",
                name: "Shodiyor Ergashev",
                status: "active",
                settings: { appearance: { theme, themeChosen: true } },
              },
        ),
      );
    }
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 0 }));
    if (
      method === "POST" &&
      (path === "finance/cashbox/payment/market" ||
        path === "finance/cashbox/payment/courier" ||
        path === "finance/cashbox/cards/transfer" ||
        path === "finance/cashbox/cards/convert")
    ) {
      payments.push({
        path,
        body: request.postDataJSON() as Record<string, unknown>,
        idempotencyKey: (await request.allHeaders())["idempotency-key"],
      });
      if (path === "finance/cashbox/payment/market") {
        if (pay === "403") return fail(route, 403, NOT_BRANCH_MARKET);
        if (pay === "400") return fail(route, 400, PAYABLE_EXCEEDED);
        if (pay === "503") return fail(route, 503, SHARE_CHECK_FAILED);
      }
      return reply(route, { statusCode: 201, message: "ok", data: { id: `p${payments.length}` } }, 201);
    }
    if (method !== "GET") {
      leaked.push(`${method} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    if (path === "finance/shift/current") {
      return reply(route, wrap({ shift: { id: "91", status: "open", opened_by: "42", opened_at: new Date().toISOString() }, required: true }));
    }
    if (path === "finance/cashbox/main") {
      return reply(route, wrap({ cashbox: { id: "16", balance: 4_250_000, balance_cash: 4_250_000, balance_card: 0, cashbox_type: "branch" } }));
    }
    if (path === "finance/cashbox/cards") {
      return reply(
        route,
        wrap({
          cashbox_type: "branch",
          cards: [],
          balance_card: 0,
          total_card: 0,
          default_balance: 0,
          in_sync: true,
          cards_disabled: true,
        }),
      );
    }
    if (path === "markets") {
      marketsListCalls += 1;
      return reply(route, wrap(MANAGER_MARKETS));
    }
    if (path === "finance/cashbox/manager/markets") {
      managerMarketsQueries.push(url.search);
      if (!isManager) return fail(route, 403, "Forbidden resource");
      if (listFailuresLeft > 0) {
        listFailuresLeft -= 1;
        return fail(route, 503, SHARE_CHECK_FAILED);
      }
      return reply(route, managerMarketsBody(list === "empty"));
    }
    if (path === "finance/cashbox/user/2") {
      if (!isManager) {
        return reply(
          route,
          wrap({
            cashbox: { id: "40", cashbox_type: "markets", user_id: "2", balance: 4_820_000 },
            history: [],
            user: { id: "2", name: "Baraka Shop", role: "market", phone_number: "+998901112233" },
          }),
        );
      }
      if (view === "403") return fail(route, 403, NOT_BRANCH_MARKET);
      if (view === "503") return fail(route, 503, SHARE_CHECK_FAILED);
      return reply(
        route,
        wrap({
          cashbox: {
            id: null,
            user_id: "2",
            cashbox_type: "markets",
            balance: 4_820_000,
            balance_cash: 4_820_000,
            balance_card: 0,
          },
          branch_id: "16",
          branch_share: 4_820_000,
          payable: 1_250_000,
          user: { id: "2", name: "Baraka Shop", status: "active" },
          history: [],
          cashboxHistory: [],
        }),
      );
    }
    if (path === "finance/cashbox/user/209") {
      return reply(
        route,
        wrap({
          cashbox: { id: "60", cashbox_type: "couriers", user_id: "209", balance: 1_280_000 },
          history: [],
          user: { id: "209", name: "Bekzod Normurodov", phone_number: "+998902145508", role: "courier" },
        }),
      );
    }
    return reply(route, wrap({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }));
  });
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.addInitScript((value) => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
    window.localStorage.setItem("theme-version", "2");
    window.localStorage.setItem("theme", value);
  }, theme);
  return {
    payments,
    leaked,
    managerMarketsQueries,
    marketsListCalls: () => marketsListCalls,
  };
};

/**
 * Market kassasida «Marketga to'lov»: summa, «To'lash» → tasdiq oynasi. P0 63HO6cBU (ega 2026-11-17, Q1): menejerda
 * faqat summa — «To'lov turi» va karta tanlovi yo'q (filial kassasi bitta jami).
 */
export const fillMarketTransfer = async (page: Page, amount: string) => {
  await expect(page.getByRole("heading", { name: "Marketga to'lov" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("textbox", { name: /^Summa/ }).fill(amount);
  await expect(page.getByRole("radio", { name: "O'tkazma", exact: true })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Naqd", exact: true })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /Qaysi kartadan/ })).toHaveCount(0);
  await page.getByRole("button", { name: "To'lash" }).click();
  const confirm = page.getByRole("alertdialog", { name: "To'lovni tasdiqlang" });
  await expect(confirm).toBeVisible();
  return confirm;
};

export const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
