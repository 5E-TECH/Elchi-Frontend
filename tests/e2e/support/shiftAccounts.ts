import { test, type Page, type Route } from "@playwright/test";

/**
 * kiZgTybn e2e yordamchisi — smena yopishda kartalar qoldig'ini tasdiqlash (superadmin, asosiy kassa). Soxta gateway:
 *  - `GET finance/shift/current` — ochiq smena #31 (yopilgach `null`);
 *  - `GET finance/shift/settings` — tasdiqlash yoqiq: «Asosiy karta» (rasm + AI), «Hisob raqam» (rasm ixtiyoriy, AI o'chiq);
 *  - `GET finance/cashbox/cards` — jonli qoldiq; `GET finance/shift/31/report` — qoralamalar / yakuniy hisobot;
 *  - `POST finance/shift/account-photo` — rasm qabul qilinadi, AI natijasi keyingi o'qishda `match`;
 *  - `POST finance/shift/close` — tanasi yoziladi (`closes`), javobda `accounts_check`;
 *  - boshqa yozish so'rovlari taqiqlangan (`leaked`).
 */
const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4194").origin;
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

const CARDS = [
  { card_id: "1", name: "Asosiy karta", bank_name: "Agrobank", last4: "1234", is_default: true, flags: true },
  { card_id: "3", name: "Hisob raqam", bank_name: "Ipoteka bank", last4: "2205", is_default: false, flags: false },
];
const BALANCES: Record<string, number> = { "1": 2_140_000, "3": 1_450_000 };

export const mockShiftAccounts = async (page: Page) => {
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
    open: true,
    drafts: {} as Record<string, Record<string, unknown>>,
    uploads: 0,
    closes: [] as unknown[],
    leaked: [] as string[],
  };
  const cardView = (cardId: string) => {
    const card = CARDS.find((item) => item.card_id === cardId)!;
    return { id: card.card_id, name: card.name, bank_name: card.bank_name, last4: card.last4, is_default: card.is_default };
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
    if (path === "finance/shift/account-photo" && request.method() === "POST") {
      state.uploads += 1;
      // Rasm yuklandi — AI tekshiruvi tugagan holat keyingi o'qishda (realtime / 5 s so'rov o'rnida).
      state.drafts["1"] = {
        card_id: "1",
        card: cardView("1"),
        expected_balance: BALANCES["1"],
        entered_balance: 2_140_000,
        has_photo: true,
        photo_url: "https://files.example/signed/1",
        photo_uploaded_at: new Date().toISOString(),
        ai_status: "match",
        ai_read_balance: 2_140_000,
        ai_entered_ok: true,
      };
      return reply(route, wrap({ check: { ...state.drafts["1"], ai_status: "pending" }, ai_enabled: true }), 201);
    }
    if (path === "finance/shift/close" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.closes.push(body);
      state.open = false;
      for (const account of (body.accounts as Array<Record<string, unknown>>) ?? []) {
        const cardId = String(account.card_id);
        const entered = Number(account.entered_balance);
        state.drafts[cardId] = {
          ...(state.drafts[cardId] ?? {
            card_id: cardId,
            card: cardView(cardId),
            has_photo: false,
            photo_url: null,
            ai_status: "not_required",
            photo_required_snap: false,
            ai_enabled_snap: false,
          }),
          expected_balance: BALANCES[cardId],
          entered_balance: entered,
          difference: entered - BALANCES[cardId],
          comment: account.comment ?? null,
        };
      }
      return reply(
        route,
        wrap({
          id: "31",
          status: "closed",
          opened_by: "42",
          closed_by: "42",
          opened_at: "2026-10-26T04:05:00.000Z",
          closed_at: "2026-10-26T13:00:00.000Z",
          opening_balance_cash: 11_270_000,
          opening_balance_card: 3_590_000,
          total_income_cash: 6_970_000,
          total_income_card: 0,
          total_expense_cash: 0,
          total_expense_card: 0,
          expected_balance_cash: 18_240_000,
          expected_balance_card: 3_590_000,
          closing_balance_cash: body.closing_balance_cash,
          closing_balance_card: body.closing_balance_card,
          discrepancy_cash: Number(body.closing_balance_cash) - 18_240_000,
          discrepancy_card: Number(body.closing_balance_card) - 3_590_000,
          accounts_check: { total: 2, match: 1, not_required: 1 },
        }),
      );
    }
    if (request.method() !== "GET") {
      state.leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    if (path === "finance/shift/current") {
      return reply(
        route,
        wrap({
          shift: state.open ? { id: "31", status: "open", opened_by: "42", opened_at: "2026-10-26T04:05:00.000Z" } : null,
          required: true,
          cashbox_user_id: "0",
        }),
      );
    }
    if (path === "finance/cashbox/main") {
      return reply(route, wrap({ cashbox: { id: "1", balance: 21_830_000, balance_cash: 18_240_000, balance_card: 3_590_000 } }));
    }
    if (path === "finance/shift/settings") {
      return reply(
        route,
        wrap({
          account_check_enabled: true,
          photo_required: true,
          ai_check_enabled: true,
          cashbox_user_id: "0",
          cashbox_type: "main",
          cards: CARDS.map(({ flags, ...card }) => ({
            ...card,
            kind: "virtual_card",
            require_photo_on_shift_close: flags,
            ai_check_enabled: flags,
            photo_required: flags,
            ai_enabled: flags,
          })),
        }),
      );
    }
    if (path === "finance/cashbox/cards") {
      return reply(route, wrap({ cards: CARDS.map((card) => ({ id: card.card_id, name: card.name, balance: BALANCES[card.card_id] })) }));
    }
    if (path === "finance/shift/31/report") {
      return reply(
        route,
        wrap({
          shift: {
            id: "31",
            status: state.open ? "open" : "closed",
            opened_at: "2026-10-26T04:05:00.000Z",
            closed_at: state.open ? null : "2026-10-26T13:00:00.000Z",
          },
          cashbox_type: "main",
          cash: {
            opening_balance: 11_270_000,
            total_income: 6_970_000,
            total_expense: 0,
            expected_balance: 18_240_000,
            closing_balance: 18_240_000,
            discrepancy: 0,
          },
          card: {
            opening_balance: 3_590_000,
            total_income: 0,
            total_expense: 0,
            expected_balance: 3_590_000,
            closing_balance: 3_590_000,
            discrepancy: 0,
          },
          accounts: Object.values(state.drafts),
          accounts_summary: { total: Object.keys(state.drafts).length },
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

/** 1×1 PNG (soxta skrinshot). */
export const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
