import { expect, type Page, type Route } from "@playwright/test";

/**
 * Menejer — marketga (ega 2026-11-11, BeePost kabi) e2e uchun soxta backend: Urgut filiali menejeri, ochiq smena,
 * filial kassasi va 2 ta karta, marketlar ro'yxati («Berilishi kerak»), market va kuryer kassalari. To'lov POST lari
 * (`payment/market`, `payment/courier`) yoziladi; `backend: "today"` — hozirgi backend (menejerga 403 «Forbidden
 * resource»), `"future"` — backend menejerga ochgandagi holat. Ruxsatsiz boshqa yozish — `leaked`.
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

export const MANAGER_MARKETS = [
  { id: "2", name: "Baraka Shop", status: "active", phone_number: "+998901112233", cashbox: { balance: 4_820_000 } },
  { id: "3", name: "Ipak Yo'li Savdo", status: "active", phone_number: "+998901112244", cashbox: { balance: 1_250_000 } },
];

type Payment = { path: string; body: Record<string, unknown> };

export const mockManagerMarketPayments = async (
  page: Page,
  { theme = "light", backend = "future" }: { theme?: "light" | "dark"; backend?: "future" | "today" } = {},
) => {
  const payments: Payment[] = [];
  const leaked: string[] = [];
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
        wrap({
          id: "42",
          role: "manager",
          name: "Ravshan Ortiqov",
          status: "active",
          branch_id: "16",
          branch_type: "REGIONAL",
          branch: { id: "16", name: "Urgut filiali", type: "REGIONAL" },
          settings: { appearance: { theme, themeChosen: true } },
        }),
      );
    }
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 0 }));
    if (method === "POST" && (path === "finance/cashbox/payment/market" || path === "finance/cashbox/payment/courier")) {
      payments.push({ path, body: request.postDataJSON() as Record<string, unknown> });
      if (backend === "today") return reply(route, { statusCode: 403, message: "Forbidden resource", error: "Forbidden" }, 403);
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
      return reply(route, wrap({ cashbox: { id: "16", balance: 4_250_000, balance_cash: 2_800_000, balance_card: 1_450_000, cashbox_type: "branch" } }));
    }
    if (path === "finance/cashbox/cards") {
      return reply(
        route,
        wrap({
          cashbox_type: "branch",
          cards: [
            { id: "5", name: "Uzcard Kapitalbank", balance: 1_150_000, is_default: true, is_active: true, sort_order: 1 },
            { id: "6", name: "Humo Agrobank", balance: 300_000, is_default: false, is_active: true, sort_order: 2 },
          ],
          balance_card: 1_450_000,
        }),
      );
    }
    if (path === "markets") return reply(route, wrap(MANAGER_MARKETS));
    if (path === "finance/cashbox/user/2") {
      return reply(
        route,
        wrap({
          cashbox: { id: "40", cashbox_type: "markets", user_id: "2", balance: 4_820_000 },
          history: [],
          user: { id: "2", name: "Baraka Shop", role: "market", phone_number: "+998901112233" },
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
  return { payments, leaked };
};

/** Market kassasida «Marketga to'lov»: summa, «O'tkazma», «Qaysi kartadan» → karta, «To'lash» → tasdiq oynasi. */
export const fillMarketTransfer = async (page: Page, amount: string, card: RegExp) => {
  await expect(page.getByRole("heading", { name: "Marketga to'lov" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("textbox", { name: /^Summa/ }).fill(amount);
  await page.getByRole("radio", { name: "O'tkazma", exact: true }).click();
  await page.getByRole("combobox", { name: /Qaysi kartadan/ }).click();
  await page.getByRole("option", { name: card }).click();
  await page.getByRole("button", { name: "To'lash" }).click();
  const confirm = page.getByRole("alertdialog", { name: "To'lovni tasdiqlang" });
  await expect(confirm).toBeVisible();
  return confirm;
};

export const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
