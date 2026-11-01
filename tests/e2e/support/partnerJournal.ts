import { type Page, type Route } from "@playwright/test";

/**
 * Hamkorlar konsoli (umumiy webhook jurnali va eski `/integrations/partners` amallari, Dj70iDbD) uchun soxta backend.
 * Hech qanday so'rov serverga ketmaydi: jurnal so'rovlari `journal` ga, ruxsat berilgan yozuv tanasi bilan `writes`
 * ga, boshqa yozuv `leaked` ga tushadi.
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

const PARTNERS = [
  { id: "1", name: "BeePost", webhook_url: null, is_active: true, createdAt: "2026-09-10T00:00:00.000Z" },
  {
    id: "2",
    name: "Baraka Shop",
    webhook_url: "https://barakashop.uz/elchi/status",
    is_active: true,
    createdAt: "2026-09-10T00:00:00.000Z",
  },
];

/** Yozuvlar uchun tashuvchi ulanish — «Ish rejimi» panelidagi navbat shu orqali sinaladi. */
const CARRIER = {
  id: 7,
  name: "Elchi",
  slug: "elchi",
  type: "api",
  role: "carrier",
  category: "cargo",
  is_active: true,
  base_url: "https://api.elchi.uz",
  auth_type: "api_key",
};

const LONG_NAME = "Toshkent shahar Yunusobod tumani katta savdo markazi va omborlar tarmog'i";
const LONG_ERROR = "HTTP 503 — hamkor serveri javob bermadi, ulanish uzildi va qayta urinishlar tugadi ".repeat(3).trim();

const row = (id: string, partner_id: string, status: string, last_error: string | null) => ({
  id,
  partner_id,
  order_id: `10${id}`,
  external_order_id: `EX-${id}`,
  event_type: "order.status_changed",
  new_status: "sold",
  status,
  attempts: status === "permanently_failed" ? 8 : 1,
  max_attempts: 8,
  last_error,
  next_retry_at: null,
  delivered_at: null,
  created_at: "2026-10-30T09:00:00.000Z",
  payload: { event: "order.status_changed", external_order_id: `EX-${id}`, status: "sold" },
});

const ROWS = [
  row("1", "1", "permanently_failed", "HTTP 500 — qabul qiluvchi server xatosi"),
  row("2", "1", "completed", null),
  row("3", "2", "permanently_failed", "Javob kelmadi (10 000 ms)"),
];

export const CONSOLE_LOG = "/integrations/connections?scope=partner&c=partner:1&t=log";

export interface PartnerJournalOptions {
  role?: "superadmin" | "admin";
  language?: "uz" | "ru" | "en";
  /** Uzun hamkor nomi va xato matni — jadval kengligini sinash uchun. */
  long?: boolean;
}

/** Bajarilgan yozuvchi so'rovlar: `POST admin/partners/1/status` → tanasi. */
const WRITE_REPLIES: [RegExp, unknown][] = [
  [/^admin\/partners\/webhooks\/\d+\/retry$/, { id: "1" }],
  [/^admin\/partners\/\d+\/rotate-key$/, { id: "1", api_key: "elc_rotated_key" }],
  [/^admin\/partners\/\d+\/status$/, { id: "1" }],
  [/^admin\/partners\/\d+\/webhook-test$/, { ok: true, http_status: 200, duration_ms: 84, secret_configured: true, url: "https://partner.example.com/hook", target: "main" }],
  [/^admin\/partners\/\d+$/, { id: "1", requeued_webhooks: 3 }],
  [/^admin\/partners$/, { id: "9", api_key: "elc_once_key" }],
  [/^integrations\/\d+\/sync$/, { ok: true }],
];

export const mockPartnerJournal = async (page: Page, { role = "superadmin", language = "uz", long = false }: PartnerJournalOptions = {}) => {
  const leaked: string[] = [];
  const writes: { call: string; body: unknown }[] = [];
  const journal: URLSearchParams[] = [];
  const partners = long ? PARTNERS.map((item) => ({ ...item, name: `${item.name} — ${LONG_NAME}` })) : PARTNERS;
  const rowsAll = long ? ROWS.map((item) => ({ ...item, last_error: item.last_error ? LONG_ERROR : null })) : ROWS;
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
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
        wrap({ id: "1", role, name: "E2E", status: "active", settings: { appearance: { theme: "light", themeChosen: true, language } } }),
      );
    }
    if (path === "admin/partners/webhooks") {
      journal.push(url.searchParams);
      const partner = url.searchParams.get("partner_id");
      const rows = rowsAll.filter((item) => !partner || item.partner_id === partner);
      return reply(route, wrap({ data: rows, total: rows.length, page: 1, limit: 20, totalPages: 1 }));
    }
    if (request.method() !== "GET") {
      const answer = WRITE_REPLIES.find(([pattern]) => pattern.test(path));
      if (answer) {
        writes.push({ call: `${request.method()} ${path}`, body: request.postDataJSON() });
        return reply(route, wrap(answer[1]));
      }
    }
    if (path === "admin/partners") return reply(route, wrap(partners));
    if (path === "integrations") {
      return reply(route, wrap({ items: [CARRIER], meta: { total: 1, page: 1, limit: 100, totalPages: 1 } }));
    }
    if (path === "integrations/metrics") {
      return reply(route, wrap({ window_hours: 24, totals: { events: 0, failed: 0, queued: 0 }, connections: [] }));
    }
    if (request.method() !== "GET") leaked.push(`${request.method()} ${path}`);
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
  return { leaked, writes, journal };
};
