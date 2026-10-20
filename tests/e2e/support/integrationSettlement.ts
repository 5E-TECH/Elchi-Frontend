import { expect, type Page, type Route } from "@playwright/test";

/**
 * Integratsiya → Hisob-kitob (IS-1, N3yNa6rO) — soxta backend.
 *
 * Qoldiq `payable_amount` / `advance_balance` bilan (maket: 4 860 000 qarz − 350 000 avans = 4 510 000);
 * `POST integrations/7/remittances` tanasi `remittances` ga yoziladi. Boshqa yozuvchi so'rov — `leaked`.
 * ⚠️ Hech qanday so'rov serverga KETMAYDI.
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

const TEZ_YETKAZ = {
  id: 7,
  name: "Tez Yetkaz",
  slug: "tez-yetkaz",
  type: "api",
  role: "carrier",
  category: "cargo",
  is_active: true,
  base_url: "https://api.tezyetkaz.uz",
  auth_type: "api_key",
  last_sync_at: "2026-10-15T09:20:00.000Z",
};

const RECEIVABLES = [
  { id: 1, order_id: "10233", integration_id: "7", provider_slug: "tez-yetkaz", external_ref: "TY-448097", amount: "410000.00", status: "pending", remittance_id: null, settled_at: null },
  { id: 2, order_id: "10227", integration_id: "7", provider_slug: "tez-yetkaz", external_ref: "TY-447990", amount: "640000.00", status: "pending", remittance_id: null, settled_at: null },
  { id: 3, order_id: "10215", integration_id: "7", provider_slug: "tez-yetkaz", external_ref: "TY-447811", amount: "232500.00", status: "pending", remittance_id: null, settled_at: null },
];

export const mockSettlementApi = async (
  page: Page,
  { role = "superadmin" as "superadmin" | "admin", theme = "light" as "light" | "dark" } = {},
) => {
  const remittances: Record<string, unknown>[] = [];
  const leaked: string[] = [];

  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");

    if (path === "auth/my-profile") {
      return reply(
        route,
        wrap({ id: "1", role, name: "E2E", status: "active", settings: { appearance: { theme, themeChosen: true } } }),
      );
    }
    if (path === "admin/partners") return reply(route, wrap([]));
    if (path === "integrations" && request.method() === "GET") {
      return reply(route, wrap({ items: [TEZ_YETKAZ], meta: { total: 1, page: 1, limit: 100, totalPages: 1 } }));
    }
    if (path === "integrations/7" && request.method() === "GET") return reply(route, wrap(TEZ_YETKAZ));
    if (path === "integrations/7/receivable-balance") {
      return reply(
        route,
        wrap({ integration_id: "7", outstanding_amount: "4860000.00", outstanding_count: 23, advance_balance: 350000, payable_amount: 4510000 }),
      );
    }
    if (path === "integrations/receivables") {
      return reply(route, wrap({ items: RECEIVABLES, pagination: { total: RECEIVABLES.length, page: 1, limit: 20 } }));
    }
    if (path === "integrations/7/remittances" && request.method() === "POST") {
      remittances.push(request.postDataJSON() as Record<string, unknown>);
      return reply(route, wrap({ remittance_id: "82", settled_count: 3, settled_amount: 1282500, unapplied_amount: 0, cashbox_posted: true }), 201);
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, wrap([]));
  });
  await page.addInitScript(
    ({ t, r }) => {
      const far = Date.now() + 86_400_000;
      window.sessionStorage.setItem("accessToken", "e2e.local.token");
      window.sessionStorage.setItem(
        "authSessionMetadata",
        JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
      );
      window.sessionStorage.setItem("role", r);
      window.localStorage.setItem("theme", t);
      window.localStorage.setItem("theme-version", "2");
    },
    { t: theme, r: role },
  );
  return { remittances, leaked };
};

export const openSettlement = async (page: Page) => {
  await page.goto("/integrations/connections?scope=external&c=integration:7&t=settlement");
  // Sovuq dev serverda sahifa chunk'lari birinchi marta kompilyatsiya qilinadi.
  await expect(page.getByText("To'lov asosiy kassaga o'zi yoziladi")).toBeVisible({ timeout: 60_000 });
};

/** Haqiqiy skroll konteyneri — `<main>`: ijobiy son = gorizontal skroll bor. */
export const mainHorizontalOverflow = (page: Page) =>
  page.locator("main:has([data-shell-slot=content])").evaluate((main) => main.scrollWidth - main.clientWidth);
