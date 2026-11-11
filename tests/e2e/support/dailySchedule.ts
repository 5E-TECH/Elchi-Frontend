import { expect, type Page, type Route } from "@playwright/test";

/**
 * Ops → «Kun tartibi» (2026-11-10) e2e uchun soxta backend (yangi backend shartnomasi — `entities/order-intake`,
 * `entities/payments` `auto_open` / `late_alert`): profil, `orders/intake-settings` GET/PATCH (`receive_*` bilan),
 * `finance/shift/settings` GET/PATCH (`auto_open`, `auto_close`, `late_alert`, `report`), qolgan GET — bo'sh.
 * PATCH lar holatga qo'shiladi (backend kabi qisman); ruxsatsiz yozuvchi so'rov `leaked` ga tushadi.
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

type Json = Record<string, unknown>;
const FAR_FUTURE = "2099-11-08T05:00:00.000Z";

/** Ichma-ich bloklar qisman yangilanadi (`late_alert.channels` …). */
const merge = (base: Json, patch: Json): Json => {
  const out: Json = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    out[key] =
      value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object"
        ? merge(base[key] as Json, value as Json)
        : value;
  }
  return out;
};

export const mockDailyScheduleApi = async (
  page: Page,
  {
    role = "superadmin",
    theme = "light",
    intake = {},
    shift = {},
  }: { role?: string; theme?: "light" | "dark"; intake?: Json; shift?: Json } = {},
) => {
  const now = Date.now();
  const state = {
    intake: {
      cutoff_time: null,
      is_open: true,
      closes_at: null,
      reopens_at: null,
      receive_cutoff_time: null,
      receive_is_open: true,
      receive_closes_at: null,
      receive_reopens_at: null,
      day_change_time: "00:00",
      // Ish kuni 2 soat oldin boshlangan (`isCutoffPassed` test vaqtiga bog'liq bo'lmasin: 02:00 dan keyingi soat o'tmagan).
      day_started_at: new Date(now - 2 * 3_600_000).toISOString(),
      next_day_change_at: new Date(now + 22 * 3_600_000).toISOString(),
      ...intake,
    } as Json,
    shift: {
      account_check_enabled: false,
      photo_required: false,
      ai_check_enabled: false,
      cashbox_user_id: "0",
      cashbox_type: "main",
      cards: [],
      auto_open: { enabled: false, times: ["08:00"], scope: "main" },
      auto_close: { enabled: false, times: ["23:00"], scope: "main", warn_before_min: 15 },
      late_alert: { enabled: false, grace_min: 15, channels: { telegram: true, in_app: true } },
      report: {
        recipients: {
          superadmin: { telegram: true, in_app: true },
          couriers: { telegram: false, in_app: false },
          markets: { telegram: false, in_app: false },
        },
        format: "pdf",
      },
      ...shift,
    } as Json,
  };
  const intakePatches: Json[] = [];
  const shiftPatches: Json[] = [];
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
        wrap({ id: "1", role, name: "Bosh admin", status: "active", settings: { appearance: { theme, themeChosen: true } } }),
      );
    }
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 0 }));
    if (path === "orders/intake-settings") {
      if (request.method() === "PATCH") {
        const body = request.postDataJSON() as Json;
        intakePatches.push(body);
        state.intake = merge(state.intake, body);
        if ("cutoff_time" in body) {
          state.intake = { ...state.intake, is_open: true, closes_at: body.cutoff_time ? FAR_FUTURE : null };
        }
        if ("receive_cutoff_time" in body) {
          state.intake = { ...state.intake, receive_is_open: true, receive_closes_at: body.receive_cutoff_time ? FAR_FUTURE : null };
        }
      }
      return reply(route, wrap(state.intake));
    }
    if (path === "finance/shift/settings") {
      if (request.method() === "PATCH") {
        const body = request.postDataJSON() as Json;
        shiftPatches.push(body);
        state.shift = merge(state.shift, body);
      }
      return reply(route, wrap(state.shift));
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, wrap([]));
  });
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.addInitScript((value) => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
    window.localStorage.setItem("elchi_had_session", "1");
    window.localStorage.setItem("theme-version", "2");
    window.localStorage.setItem("theme", value);
  }, theme);
  return { state, intakePatches, shiftPatches, leaked };
};

export const openDailySchedule = async (page: Page) => {
  await page.goto("/ops?tab=daily-schedule");
  await expect(page.getByRole("region", { name: "Buyurtma qabuli" })).toBeVisible({ timeout: 60_000 });
};

/** Sahifada gorizontal toshish yo'q. */
export const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
