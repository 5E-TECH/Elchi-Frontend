import type { Page, Route } from "@playwright/test";
import { ORDER_AT_HQ, ORDER_HANDED, ORDER_IN_TRANSIT, SUPERADMIN } from "./cancelStages";

/**
 * BEKOR HOLATLARI — vOczoOUE 2-bosqich + vNKGbg5q (BG1–BG4, BG7) e2e uchun soxta backend: `GET /orders`
 * (`cancel_stage` filtri), `GET /orders/markets/:id/cancelled` (`stage`, `start_day`/`end_day`). Qatorlarda backend
 * `return_stage` / `cancel_return` / `handover_*_at` maydonlari. Hech qanday so'rov serverga ketmaydi; yozuvchi so'rov
 * `leaked` ga tushadi. Worktree serverlari boshqa portda — `E2E_ORIGIN`.
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

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY - 3_600_000).toISOString();

/** «Bekor · HQ'da» 8 kundan beri: D+3 eslatma ketgan, D+7 eskalatsiya — `received_at` dan (last_handover_at emas). */
export const ORDER_HQ_ESCALATED = {
  ...ORDER_AT_HQ,
  id: "10188",
  customer: { id: "c-10188", name: "Rustam Nazarov", phone_number: "+998938701452" },
  last_handover_at: ago(1),
  return_stage: "hq",
  cancel_return: {
    stage: "hq",
    place_type: "HQ",
    place_id: 1,
    place_name: "Toshkent HQ",
    received_at: ago(8),
    sent_at: null,
    handed_over_at: null,
    handover_method: null,
  },
  handover_notified_at: ago(5),
  handover_escalated_at: ago(1),
};

/** «Bekor · filialda» 3 kun — ogohlantirish rangi, eskalatsiyasiz. */
export const ORDER_BRANCH_3D = {
  ...ORDER_AT_HQ,
  id: "10214",
  customer: { id: "c-10214", name: "Nodir Karimov", phone_number: "+998972041833" },
  holder_type: "BRANCH",
  holder_branch_id: "12",
  branch: { id: "12", name: "Farg'ona filiali" },
  return_stage: "branch",
  cancel_return: {
    stage: "branch",
    place_type: "BRANCH",
    place_id: 12,
    place_name: "Farg'ona filiali",
    received_at: ago(3),
    sent_at: null,
    handed_over_at: null,
    handover_method: null,
  },
  handover_notified_at: null,
  handover_escalated_at: null,
};

/** «Marketga topshirildi» — ro'yxatda ham vaqt va usul (BG2). */
export const ORDER_HANDED_PIN = {
  ...ORDER_HANDED,
  id: "10179",
  customer: { id: "c-10179", name: "Odil Ismoilov", phone_number: "+998991076329" },
  return_stage: "market",
  cancel_return: {
    stage: "market",
    place_type: "HQ",
    place_id: 1,
    place_name: "Toshkent HQ",
    received_at: null,
    sent_at: null,
    handed_over_at: "2026-10-03T05:20:00.000Z",
    handover_method: "pin",
  },
};

/** «Bekor · kuryerda» — market «Yo'lda» tabi uchun. */
export const ORDER_COURIER = {
  ...ORDER_IN_TRANSIT,
  id: "10241",
  status: "cancelled",
  customer: { id: "c-10241", name: "Dilnoza Karimova", phone_number: "+998901234567" },
  holder_type: "COURIER",
  canceled_post_id: null,
  return_stage: "courier",
  cancel_return: { stage: "courier", place_type: "COURIER", place_id: 26, place_name: "Akmal Rahimov" },
};

export const MARKET = {
  id: "201",
  role: "market",
  name: "Baraka Shop",
  status: "active",
  cancelled_handover_qr_required: true,
};

const STAGE_FILTER: Record<string, (order: Record<string, unknown>) => boolean> = {};
for (const stage of ["courier", "in_transit", "branch", "hq", "market"]) {
  STAGE_FILTER[stage] = (order) => order.return_stage === stage;
}

export const mockCancelStages2Api = async (
  page: Page,
  options: {
    profile?: Record<string, unknown>;
    list?: Record<string, unknown>[];
    /** Market bekorlari: `stage` siz — HQ'da turganlar; `stage=` bilan — bosqich bo'yicha. */
    marketCancelled?: Record<string, unknown>[];
  } = {},
) => {
  const leaked: string[] = [];
  const listQueries: URLSearchParams[] = [];
  const marketQueries: URLSearchParams[] = [];
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") return reply(route, wrap(options.profile ?? SUPERADMIN));
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    if (path === "orders") {
      listQueries.push(url.searchParams);
      const stages = (url.searchParams.get("cancel_stage") ?? "").split(",").filter(Boolean);
      const items = (options.list ?? []).filter(
        (order) => stages.length === 0 || stages.some((stage) => STAGE_FILTER[stage]?.(order)),
      );
      return reply(route, { statusCode: 200, data: items, total: items.length, page: 1, limit: 25 });
    }
    if (/^orders\/markets\/[^/]+\/cancelled$/.test(path)) {
      marketQueries.push(url.searchParams);
      const stages = (url.searchParams.get("stage") ?? "hq").split(",").filter(Boolean);
      const items = (options.marketCancelled ?? []).filter((order) =>
        stages.some((stage) => STAGE_FILTER[stage]?.(order)),
      );
      // Backend: `{ data, total, truncated? }` (≤ 5000).
      return reply(route, { statusCode: 200, data: items, total: items.length });
    }
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
  return { leaked, listQueries, marketQueries };
};
