import { expect, type Page, type Route } from "@playwright/test";

/**
 * Bugungi qabul vaqti (2026-11-08) e2e uchun soxta backend: profil (rol, mavzu), `orders/intake-settings` GET/PATCH,
 * qolgan GET — bo'sh. Ruxsatsiz yozuvchi so'rov `leaked` ga tushadi.
 */
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    headers: cors,
    body: JSON.stringify(body),
  });

export type IntakeData = {
  cutoff_time: string | null;
  is_open: boolean;
  closes_at: string | null;
  reopens_at: string | null;
  /** Kun almashish soati (Trello #756) — Toshkent `HH:MM`, sukut `00:00`. */
  day_change_time?: string;
  day_started_at?: string | null;
  next_day_change_at?: string | null;
};

/** Ish kuni lahzalari test vaqtiga bog'liq bo'lmasin — uzoq o'tmish / kelajak. */
const DAY_WINDOW = {
  day_change_time: "00:00",
  day_started_at: "2026-01-01T19:00:00.000Z",
  next_day_change_at: "2099-11-08T19:00:00.000Z",
};

export const OPEN_UNLIMITED: IntakeData = {
  cutoff_time: null,
  is_open: true,
  closes_at: null,
  reopens_at: null,
  ...DAY_WINDOW,
};
/** 10:00 da yopilgan, kun almashishi uzoq kelajakda (test vaqtiga bog'liq bo'lmasin). */
export const CLOSED_AT_10: IntakeData = {
  cutoff_time: "10:00",
  is_open: false,
  closes_at: "2026-11-08T05:00:00.000Z",
  reopens_at: "2099-11-08T19:00:00.000Z",
  ...DAY_WINDOW,
};

export const mockOrderIntakeApi = async (
  page: Page,
  { role, theme = "light", intake }: { role: string; theme?: "light" | "dark"; intake: IntakeData },
) => {
  const leaked: string[] = [];
  const patches: unknown[] = [];
  let current = intake;
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, {
        statusCode: 200,
        data: {
          id: "1",
          role,
          name: "Sinov foydalanuvchi",
          status: "active",
          settings: { appearance: { theme, themeChosen: true } },
        },
      });
    }
    if (path === "orders/intake-settings") {
      if (request.method() === "PATCH") {
        // Backend kontrakti: `cutoff_time` va `day_change_time` alohida ham, bitta so'rovda ham keladi.
        const body = request.postDataJSON() as {
          cutoff_time?: string | null;
          day_change_time?: string | null;
        };
        patches.push(body);
        if ("cutoff_time" in body) {
          current = body.cutoff_time
            ? {
                ...current,
                cutoff_time: body.cutoff_time,
                is_open: true,
                closes_at: "2099-11-08T05:00:00.000Z",
                reopens_at: "2099-11-08T19:00:00.000Z",
              }
            : { ...current, cutoff_time: null, is_open: true, closes_at: null, reopens_at: null };
        }
        if ("day_change_time" in body) {
          current = { ...current, day_change_time: body.day_change_time ?? "00:00" };
        }
      }
      return reply(route, { statusCode: 200, data: current });
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.addInitScript((value) => {
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
    window.localStorage.setItem("elchi_had_session", "1");
    window.localStorage.setItem("theme-version", "2");
    window.localStorage.setItem("theme", value);
  }, theme);
  return { leaked, patches };
};

export const openNewOrders = async (page: Page) => {
  await page.goto("/new-orders");
  await expect(page.getByRole("heading", { level: 1, name: "Qabul va yaratish" })).toBeVisible({
    timeout: 60_000,
  });
};
