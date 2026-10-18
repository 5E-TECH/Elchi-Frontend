import { expect, type Page, type Route } from "@playwright/test";

/**
 * Faoliyat jurnali (y8CxCtcK) — soxta backend. Kontrakt: FRONTEND_CHANGELOG 2026-10-14
 * (`GET /activity-logs/actions` → `data` + `registry` + `categories`; qatorda `action_meta`, `actor_status`).
 * Server kabi: `action` / `service` / `entity_type` / `user_id` bo'yicha qatorlar filtrlanadi.
 */
const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const meta = (action: string, label: string, category: string, tone: string) => ({
  action,
  label,
  category,
  category_label: category,
  icon: "dot",
  tone,
  known: true,
});

/** So'rov konteksti (f2Ud5tju): backend `metadata` ga `ip`, `user_agent`, `device_id`, `device_name` yozadi. */
export const UA_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.100 Mobile Safari/537.36";
export const UA_WINDOWS_EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.2792.79";
export const IPV6 = "2001:0db8:85a3:0000:0000:8a2e:0370:7334";

const row = (id: string, over: Record<string, unknown>) => ({
  id,
  entity_type: "Order",
  entity_id: "10227",
  action: "status_change",
  service: "order",
  created_at: "2026-10-16T09:32:00.000Z",
  actor: { id: "7", name: "Jasur Tursunov", role: "courier" },
  actor_status: "snapshot",
  action_meta: meta("status_change", "Holat o'zgardi", "order", "slate"),
  entity: { name: "Sardor Qodirov" },
  old_value: { status: "on the road" },
  new_value: { status: "sold" },
  metadata: {
    source: "Kuryer ilovasi",
    branch_name: "Toshkent HQ",
    device_name: "Android",
    ip: "10.24.6.118",
    user_agent: UA_ANDROID,
    device_id: "3f1c9a2e-55b1-4b8e-9d0a-1f2e3d4c5b6a",
  },
  trace_id: "4f9c2a7e81d34b6a9e05c3d17a2b8f64",
  ...over,
});

export const LOGS = [
  row("1", {}),
  row("2", {
    action: "finance.manual_expense",
    action_meta: meta("finance.manual_expense", "Qo'lda chiqim", "finance", "rose"),
    service: "finance",
    entity_type: "Payment",
    entity_id: "5521",
    entity: { name: "Asosiy kassa" },
    actor: { id: "3", name: "Nilufar Rashidova", role: "admin" },
    old_value: null,
    new_value: { amount: 150000 },
    // HTTP bo'lmagan oqim (cron): so'rov konteksti yo'q.
    metadata: { reason: "Ofis ijarasi" },
    trace_id: null,
  }),
  row("3", {
    action: "login",
    action_meta: meta("login", "Tizimga kirdi", "auth", "slate"),
    service: "identity",
    entity_type: "User",
    entity_id: "31",
    entity: { name: "Ravshan Ortiqov" },
    actor: { id: "5", name: "Ravshan Ortiqov", role: "manager" },
    old_value: null,
    new_value: null,
    metadata: null,
    trace_id: null,
  }),
  row("4", {
    action: "order.batch_sent",
    action_meta: { action: "order.batch_sent", label: "Order batch sent", icon: "dot", tone: "slate", known: false },
    entity_id: "10230",
    actor: { id: "44", name: null, role: null },
    user_id: "44",
    actor_status: "unresolved",
    // `device_name` yo'q — qurilma `user_agent` dan; IPv6 uzun satr (390px da sig'ishi kerak).
    metadata: { source: "Ochiq API", ip: IPV6, user_agent: UA_WINDOWS_EDGE },
  }),
];

export const CATALOG = {
  data: ["status_change", "finance.manual_expense", "login", "order.batch_sent"],
  registry: [
    meta("status_change", "Holat o'zgardi", "order", "slate"),
    meta("finance.manual_expense", "Qo'lda chiqim", "finance", "rose"),
    meta("login", "Tizimga kirdi", "auth", "slate"),
  ],
  categories: [
    { key: "order", label: "Buyurtma" },
    { key: "finance", label: "Moliya" },
    { key: "auth", label: "Kirish" },
    { key: "branch", label: "Filial" },
    { key: "integration", label: "Integratsiya" },
    { key: "logistics", label: "Logistika" },
  ],
};

export const mockActivityLogsApi = async (page: Page, role = "superadmin") => {
  const leaked: string[] = [];
  const requests: URLSearchParams[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: "1", role, name: "Sinov xodimi", status: "active" } });
    }
    if (path === "activity-logs/actions") return reply(route, { statusCode: 200, ...CATALOG });
    if (path === "activity-logs") {
      requests.push(url.searchParams);
      const q = url.searchParams;
      const items = LOGS.filter(
        (log) =>
          (!q.get("action") || log.action === q.get("action")) &&
          (!q.get("service") || log.service === q.get("service")) &&
          (!q.get("entity_type") || log.entity_type === q.get("entity_type")),
      );
      return reply(route, { statusCode: 200, data: { items, meta: { page: 1, limit: 20, total: items.length, totalPages: 1 } } });
    }
    if (request.method() !== "GET") leaked.push(`${request.method()} ${path}`);
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return { leaked, requests };
};

export const openActivityLogs = async (page: Page) => {
  await page.goto("/activity-logs");
  await expect(page.getByRole("heading", { level: 1, name: "Faoliyat jurnali" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Jasur Tursunov").first()).toBeVisible({ timeout: 60_000 });
};
