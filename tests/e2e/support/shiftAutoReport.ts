import { test, type Page, type Route } from "@playwright/test";

/**
 * y8Tqm9Ap + gWI4gYkw e2e yordamchisi (superadmin). Soxta gateway:
 *  - `GET finance/shift/settings` — kartalar tekshiruvi o'chiq + `auto_close` (o'chiq, 23:00) va `report`
 *    (superadmin × ikkala kanal, kuryer/market o'chiq, PDF); `PATCH` — tanasi yoziladi (`patches`) va qo'llanadi;
 *  - `GET finance/shift/31/report` — avtomatik yopilgan smena (`close_reason: auto`), hisobot 1-raund yuborilgan:
 *    superadmin (Telegram + tizim), 2 kuryer (bittasida «Telegram ulanmagan»), market guruhi;
 *  - `POST finance/shift/31/report/resend` — yoziladi (`resends`), raund oshadi;
 *  - boshqa yozish so'rovlari taqiqlangan (`leaked`).
 */
const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4194").origin;
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

const delivery = (round: number, over: Record<string, unknown>) => ({
  round,
  status: "sent",
  failed_reason: null,
  sent_at: "2026-10-26T18:01:00.000Z",
  created_at: "2026-10-26T18:00:20.000Z",
  ...over,
});

const roundDeliveries = (round: number) => [
  delivery(round, { recipient_id: "42", recipient_name: "Bosh admin", recipient_kind: "superadmin", channel: "telegram" }),
  delivery(round, { recipient_id: "42", recipient_name: "Bosh admin", recipient_kind: "superadmin", channel: "in_app" }),
  delivery(round, {
    recipient_id: "7",
    recipient_name: "Bekzod Aliyev",
    recipient_kind: "courier",
    channel: "telegram",
    status: "failed",
    failed_reason: "Telegram ulanmagan",
    sent_at: null,
  }),
  delivery(round, { recipient_id: "7", recipient_name: "Bekzod Aliyev", recipient_kind: "courier", channel: "in_app" }),
  delivery(round, { recipient_id: "8", recipient_name: "Ali Valiyev", recipient_kind: "courier", channel: "telegram" }),
  delivery(round, { recipient_id: "8", recipient_name: "Ali Valiyev", recipient_kind: "courier", channel: "in_app" }),
  delivery(round, { recipient_id: "21", recipient_name: "Baraka Shop", recipient_kind: "market", channel: "telegram_group" }),
  delivery(round, { recipient_id: "21", recipient_name: "Baraka Shop", recipient_kind: "market", channel: "in_app" }),
];

export const mockShiftAutoReport = async (page: Page) => {
  const origin = appOrigin();
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
  const reply = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  const state = {
    settings: {
      account_check_enabled: false,
      photo_required: false,
      ai_check_enabled: false,
      cashbox_user_id: "0",
      cashbox_type: "main",
      cards: [] as unknown[],
      auto_close: { enabled: false, times: ["23:00"], scope: "main", warn_before_min: 15 },
      report: {
        recipients: {
          superadmin: { telegram: true, in_app: true },
          couriers: { telegram: false, in_app: false },
          markets: { telegram: false, in_app: false },
        },
        format: "pdf",
      },
    },
    round: 1,
    patches: [] as unknown[],
    resends: 0,
    leaked: [] as string[],
  };

  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");

    if (path === "auth/my-profile") {
      return reply(route, wrap({ id: "42", role: "superadmin", name: "Bosh admin", status: "active" }));
    }
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 0 }));
    if (path === "finance/shift/settings" && request.method() === "PATCH") {
      const body = request.postDataJSON() as {
        auto_close?: Record<string, unknown>;
        report?: { recipients?: Record<string, Record<string, boolean>>; format?: string };
      };
      state.patches.push(body);
      if (body.auto_close) state.settings.auto_close = { ...state.settings.auto_close, ...body.auto_close } as never;
      if (body.report?.recipients) {
        for (const [group, channels] of Object.entries(body.report.recipients)) {
          const recipients = state.settings.report.recipients as Record<string, Record<string, boolean>>;
          recipients[group] = { ...recipients[group], ...channels };
        }
      }
      if (body.report?.format) state.settings.report.format = body.report.format;
      return reply(route, wrap(state.settings));
    }
    if (path === "finance/shift/31/report/resend" && request.method() === "POST") {
      state.resends += 1;
      state.round += 1;
      return reply(route, wrap({ round: state.round, status: "sent", deliveries: roundDeliveries(state.round) }), 201);
    }
    if (request.method() !== "GET") {
      state.leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    if (path === "finance/shift/settings") return reply(route, wrap(state.settings));
    if (path === "finance/shift/31/report") {
      return reply(
        route,
        wrap({
          shift: {
            id: "31",
            status: "closed",
            opened_at: "2026-10-26T09:05:00.000Z",
            closed_at: "2026-10-26T18:00:00.000Z",
            opened_by_name: "Shodiyor Ergashev",
            closed_by_name: null,
          },
          close_reason: "auto",
          closed_by_system: true,
          auto_close: { closed_at: "2026-10-26T18:00:00.000Z", label: "Avtomatik yopildi — 23:00, kassir yopmagan" },
          report: {
            status: "sent",
            round: state.round,
            file_format: "pdf",
            has_file: true,
            file_url: "https://files.example/shift-31.pdf",
          },
          deliveries: roundDeliveries(state.round),
          cashbox_type: "main",
          cash: {
            opening_balance: 11_270_000,
            total_income: 6_970_000,
            total_expense: 0,
            expected_balance: 18_240_000,
            closing_balance: null,
            discrepancy: null,
          },
          card: {
            opening_balance: 3_590_000,
            total_income: 0,
            total_expense: 0,
            expected_balance: 3_590_000,
            closing_balance: null,
            discrepancy: null,
          },
          accounts: [],
          accounts_summary: null,
          operations: [{ operation_type: "income", payment_method: "cash", count: 4, total: 6_970_000 }],
        }),
      );
    }
    return reply(route, wrap({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }));
  });

  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return state;
};
