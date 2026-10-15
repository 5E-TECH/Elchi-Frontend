import { expect, type Page, type Route } from "@playwright/test";

/**
 * Integratsiya → Ish rejimi (fG48Xv5X) — soxta backend.
 *
 * `GET /integrations/7` quyi kalitlarni beradi; `PATCH` ularni saqlaydi;
 * `POST /integrations/7/reconcile-now` — `reconcile` rejimiga qarab 200 / 409 / 400.
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
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

export type ReconcileMode = "ok" | "conflict" | "no-query";

export const mockControlApi = async (
  page: Page,
  { reconcile = "ok" as ReconcileMode, theme = "light" as "light" | "dark" } = {},
) => {
  const state = {
    integration: {
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
      webhook_enabled: true,
      reconcile_enabled: false,
      last_reconcile_at: null as string | null,
    },
  };
  const patches: Record<string, unknown>[] = [];
  const reconcileCalls: number[] = [];
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
        wrap({
          id: "1",
          role: "superadmin",
          name: "E2E",
          status: "active",
          settings: { appearance: { theme, themeChosen: true } },
        }),
      );
    }
    if (path === "admin/partners") return reply(route, wrap([]));
    if (path === "integrations" && request.method() === "GET") {
      return reply(route, wrap({ items: [state.integration], meta: { total: 1, page: 1, limit: 100, totalPages: 1 } }));
    }
    if (path === "integrations/7" && request.method() === "GET") return reply(route, wrap(state.integration));
    if (path === "integrations/7" && request.method() === "PATCH") {
      const body = request.postDataJSON() as Record<string, unknown>;
      patches.push(body);
      Object.assign(state.integration, body);
      return reply(route, wrap(state.integration));
    }
    if (path === "integrations/7/reconcile-now" && request.method() === "POST") {
      reconcileCalls.push(Date.now());
      if (reconcile === "conflict") return reply(route, { statusCode: 409, message: "Reconcile already running" }, 409);
      if (reconcile === "no-query") return reply(route, { statusCode: 400, message: "status_query is not configured" }, 400);
      state.integration.last_reconcile_at = "2026-10-15T09:45:00.000Z";
      return reply(route, wrap({ checked: 1200, applied: 3, failed: 1 }));
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, wrap([]));
  });
  await page.addInitScript((t) => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
    window.localStorage.setItem("theme", t);
    window.localStorage.setItem("theme-version", "2");
  }, theme);
  return { state, patches, reconcileCalls, leaked };
};

export const openControl = async (page: Page) => {
  await page.goto("/integrations/connections?scope=external&c=integration:7&t=control");
  await expect(page.getByTestId("ctl-row-reconcile")).toBeVisible({ timeout: 60_000 });
};
