import { expect, type Page, type Route } from "@playwright/test";

/**
 * Integratsiya → Hisob-kitob (IS-1, N3yNa6rO; IS-2 utIffRFx) — soxta backend.
 *
 * Qoldiq `payable_amount` / `advance_balance` bilan (maket: 4 860 000 qarz − 350 000 avans = 4 510 000);
 * `POST integrations/7/remittances` tanasi `remittances` ga yoziladi, javobi — `remittanceResponse` (sukut: qarzga
 * aniq tushgan va kassaga yozilgan to'lov; `OVERPAID_RESPONSE` — maketdagi ortiqcha to'lov). Qarz yozuvlarida bitta
 * yopilgan qator (`To'lov №82`). Boshqa yozuvchi so'rov — `leaked`.
 * IS-3: «Olingan to'lovlar» — `GET integrations/7/remittances` (`REMITTANCES`, maket qatorlari; `status` filtri
 * hisobga olinadi, so'rov parametrlari `remittanceQueries` ga), bekor qilish `POST …/remittances/:id/cancel` —
 * tanasi `cancels` ga, javobi `cancelResponse` (status bilan).
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
  { id: 4, order_id: "10209", integration_id: "7", provider_slug: "tez-yetkaz", external_ref: "TY-447738", amount: "1150000.00", status: "settled", remittance_id: "82", settled_at: "2026-10-14T06:20:00.000Z" },
  { id: 1, order_id: "10233", integration_id: "7", provider_slug: "tez-yetkaz", external_ref: "TY-448097", amount: "410000.00", status: "pending", remittance_id: null, settled_at: null },
  { id: 2, order_id: "10227", integration_id: "7", provider_slug: "tez-yetkaz", external_ref: "TY-447990", amount: "640000.00", status: "pending", remittance_id: null, settled_at: null },
  { id: 3, order_id: "10215", integration_id: "7", provider_slug: "tez-yetkaz", external_ref: "TY-447811", amount: "232500.00", status: "pending", remittance_id: null, settled_at: null },
];

/** Qarzga aniq tushgan va kassaga yozilgan to'lov — natija oynasisiz, faqat xabar. */
/** Qarzga aniq tushgan to'lov (backend shakli: `unapplied = amount + advance_applied − settled` = 0). */
export const EXACT_RESPONSE = {
  remittance_id: "82",
  integration_id: "7",
  remitted_amount: 1_500_000,
  settled_amount: 1_500_000,
  settled_count: 3,
  unapplied_amount: 0,
  advance_applied: 0,
  advance_balance: 350_000,
  cashbox_posted: true,
};
/** Maket `*-pay-result-dialog`: 5 000 000 olindi, 23 ta qarz yopildi, ortig'i avansga (backend shakli). */
export const OVERPAID_RESPONSE = {
  remittance_id: 84,
  integration_id: "7",
  remitted_amount: 5_000_000,
  settled_amount: 4_860_000,
  settled_count: 23,
  unapplied_amount: 140_000,
  advance_applied: 0,
  advance_balance: 490_000,
  warning: "To'lovning 140000 so'mi hech bir qarz qatoriga sig'madi",
  cashbox_posted: true,
};

/** Maket «Olingan to'lovlar» (backend `listRemittances` shakli). */
export const REMITTANCES = [
  { id: 82, integration_id: "7", created_at: "2026-10-14T06:20:00.000Z", amount: 1500000, settled_count: 1, settled_amount: 1150000, unapplied_amount: 350000, advance_applied: 0, reference: "To'lov topshiriqnomasi №4518", note: "Oktyabr, 2-hafta COD", created_by: "1", status: "active", cashbox_posted: true, cancelled_at: null, cancelled_by: null, cancel_reason: null },
  { id: 79, integration_id: "7", created_at: "2026-10-13T12:45:00.000Z", amount: 2000000, settled_count: 6, settled_amount: 2000000, unapplied_amount: 0, advance_applied: 0, reference: "PAY-2026-10-18-002", note: null, created_by: "2", status: "active", cashbox_posted: false, cancelled_at: null, cancelled_by: null, cancel_reason: null },
  { id: 77, integration_id: "7", created_at: "2026-10-12T10:10:00.000Z", amount: 5000000, settled_count: 7, settled_amount: 5000000, unapplied_amount: 0, advance_applied: 0, reference: "To'lov topshiriqnomasi №4497", note: null, created_by: "1", status: "cancelled", cashbox_posted: true, cancelled_at: "2026-10-12T10:32:00.000Z", cancelled_by: "2", cancel_reason: "Summa xato: 500 000 o'rniga 5 000 000" },
  { id: 61, integration_id: "7", created_at: "2026-10-02T07:00:00.000Z", amount: 2300000, settled_count: 9, settled_amount: null, unapplied_amount: null, advance_applied: null, reference: null, note: "Sentabr hisob-kitobi", created_by: "1", status: "active", cashbox_posted: null, cancelled_at: null, cancelled_by: null, cancel_reason: null },
];

/** Bekor qilish javobi (backend `cancelRemittance`): №82 — 1 qarz qayta ochildi, kassadan qaytarildi. */
export const CANCEL_RESPONSE = {
  remittance_id: "82",
  integration_id: "7",
  amount: 1500000,
  status: "cancelled",
  reopened_count: 1,
  reopened_order_ids: ["10209"],
  cashbox_reversed: true,
  settlement_reverted: true,
};

export const mockSettlementApi = async (
  page: Page,
  {
    role = "superadmin" as "superadmin" | "admin",
    theme = "light" as "light" | "dark",
    remittanceResponse = EXACT_RESPONSE as Record<string, unknown>,
    remittanceRows = REMITTANCES as Record<string, unknown>[],
    cancelResponse = { status: 200, body: wrap(CANCEL_RESPONSE) as unknown },
  } = {},
) => {
  const remittances: Record<string, unknown>[] = [];
  const cancels: { id: string; body: Record<string, unknown> }[] = [];
  const remittanceQueries: Record<string, string>[] = [];
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
    if (path === "integrations/7/remittances" && request.method() === "GET") {
      const params = Object.fromEntries(url.searchParams.entries());
      remittanceQueries.push(params);
      const items = remittanceRows.filter((r) => !params.status || r.status === params.status);
      return reply(route, wrap({ items, pagination: { total: items.length, page: 1, limit: 10, totalPages: 1 } }));
    }
    const cancelMatch = /^integrations\/7\/remittances\/(\d+)\/cancel$/.exec(path);
    if (cancelMatch && request.method() === "POST") {
      cancels.push({ id: cancelMatch[1], body: request.postDataJSON() as Record<string, unknown> });
      return reply(route, cancelResponse.body, cancelResponse.status);
    }
    if (path === "integrations/7/remittances" && request.method() === "POST") {
      remittances.push(request.postDataJSON() as Record<string, unknown>);
      return reply(route, wrap(remittanceResponse), 201);
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
  return { remittances, cancels, remittanceQueries, leaked };
};

export const openSettlement = async (page: Page) => {
  await page.goto("/integrations/connections?scope=external&c=integration:7&t=settlement");
  // Sovuq dev serverda sahifa chunk'lari birinchi marta kompilyatsiya qilinadi.
  await expect(page.getByText("To'lov asosiy kassaga o'zi yoziladi")).toBeVisible({ timeout: 60_000 });
};

/** Haqiqiy skroll konteyneri — `<main>`: ijobiy son = gorizontal skroll bor. */
export const mainHorizontalOverflow = (page: Page) =>
  page.locator("main:has([data-shell-slot=content])").evaluate((main) => main.scrollWidth - main.clientWidth);
