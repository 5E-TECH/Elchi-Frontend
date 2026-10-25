import type { Page, Route } from "@playwright/test";

/**
 * TG-B — «Telegram guruhi» kartasi va «Telegram boti» ustuni e2e: soxta backend.
 * - `GET notifications?market_id[&group_type]` — `state.rows` (market 201 guruhlari);
 * - `POST telegram/link-code` — tana yoziladi; `connectAfterPolls` berilsa, kod olingach kuzatuv (`group_type` li)
 *   so'rovlari shuncha bo'lgach shu turdagi guruh «ulanadi» (qator qo'shiladi);
 * - `GET notifications/me/telegram-groups` (TG-C, market o'zi) — `state.rows` dan ikkala tur holati; kod olingach
 *   har so'rov kuzatuv hisoblanadi (`connectAfterPolls` — o'sha qoida), `myGroupsRequests` — so'rovlar soni;
 * - `GET users/201` — market, `GET users` — ro'yxat (`telegram_linked`), `PATCH markets/201/telegram-group-pii`;
 * - `GET markets/:id/tg-token` hech qachon so'ralmasligi kerak (`tokenRequests`).
 */
/** Dev server manzili (worktree probe'larida boshqa port — `E2E_ORIGIN`). */
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

export const TG_GROUP_DEEP_LINK = "https://t.me/elchi_bot?startgroup=c0de42";

export const TG_MARKET = {
  id: "201",
  name: "Baraka Shop",
  phone_number: "+998903152241",
  username: "baraka_shop",
  role: "market",
  status: "active",
  salary: 0,
  payment_day: null,
  tariff_home: 35000,
  tariff_center: 25000,
  default_tariff: "home",
  add_order: true,
  cancelled_handover_qr_required: true,
  expense_proof_conditions: ["sell_any"],
  tg_group_show_customer_pii: true,
  telegram_linked: false,
  createdAt: "2026-09-29T09:00:00.000Z",
  updatedAt: "2026-10-05T09:00:00.000Z",
  is_deleted: false,
};

const LIST = [
  { id: "301", name: "Mehr Kosmetika", phone_number: "+998941173984", role: "market", status: "active", telegram_linked: true, createdAt: "2026-10-15T04:40:00.000Z" },
  { id: "302", name: "Jasur Tursunov", phone_number: "+998904121855", role: "courier", status: "active", telegram_linked: false, createdAt: "2026-10-06T04:30:00.000Z" },
  { id: "309", name: "Sherzod Umarov", phone_number: "+998953307146", role: "investor", status: "active", telegram_linked: false, createdAt: "2026-08-14T07:30:00.000Z" },
];

type GroupRow = {
  id: string;
  market_id: string;
  group_id: string;
  group_type: "create" | "cancel";
  is_active: boolean;
  createdAt: string;
  inactive_reason?: string | null;
};

export type MarketTgGroupOptions = {
  role: "superadmin" | "admin" | "manager" | "market";
  /** Market guruhlari (sukut: «Yangi buyurtmalar» ulangan, «Bekor qilinganlar» — yo'q). */
  rows?: GroupRow[];
  /** Kod olingach nechanchi kuzatuv so'rovida guruh ulanadi (`null` — ulanmaydi). */
  connectAfterPolls?: number | null;
  /** Havola muddati, ms (sukut 10 daqiqa). */
  expiresInMs?: number;
};

export const marketGroupRow = (group_type: "create" | "cancel", is_active = true): GroupRow => ({
  id: `n-${group_type}`,
  market_id: "201",
  group_id: "-100123",
  group_type,
  is_active,
  createdAt: "2026-10-06T09:00:00.000Z",
});

export const mockMarketTgGroupApi = async (
  page: Page,
  { role, rows = [marketGroupRow("create")], connectAfterPolls = null, expiresInMs = 10 * 60_000 }: MarketTgGroupOptions,
) => {
  const state = {
    rows: [...rows],
    linkRequests: [] as unknown[],
    tokenRequests: 0,
    notificationRequests: 0,
    myGroupsRequests: 0,
    watchPolls: 0,
    pendingType: null as "create" | "cancel" | null,
    pii: [] as unknown[],
  };
  const me =
    role === "market"
      ? TG_MARKET
      : {
          id: "1",
          role,
          name: "E2E",
          status: "active",
          phone_number: "+998900000001",
          // Menejer «Foydalanuvchilar» ni filial turi bilan ko'radi (REGIONAL — `managerCan("staff")`).
          ...(role === "manager" ? { branch: { id: "3", name: "Qarshi filiali", type: "REGIONAL" }, branch_id: "3" } : {}),
        };

  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");

    if (path === "auth/my-profile") return reply(route, wrap(me));
    if (path === "users/201") return reply(route, wrap(TG_MARKET));
    if (path === "users" && request.method() === "GET") {
      return reply(
        route,
        wrap({
          items: LIST,
          meta: { page: 1, limit: 10, total: LIST.length, totalPages: 1, totalUsers: 3, totalMarket: 1, totalEmployees: 2, countsByRole: {} },
        }),
      );
    }
    if (path.endsWith("/tg-token")) {
      state.tokenRequests += 1;
      return reply(route, wrap({}));
    }
    // Kod olingach kuzatuv so'rovi — `connectAfterPolls` dan keyin shu turdagi guruh «ulanadi».
    const watchPoll = (groupType: "create" | "cancel") => {
      if (state.pendingType !== groupType || connectAfterPolls == null) return;
      state.watchPolls += 1;
      if (state.watchPolls > connectAfterPolls && !state.rows.some((row) => row.group_type === groupType)) {
        state.rows.push({ ...marketGroupRow(groupType), createdAt: new Date().toISOString() });
      }
    };
    if (path === "notifications/me/telegram-groups" && request.method() === "GET") {
      state.myGroupsRequests += 1;
      if (state.pendingType) watchPoll(state.pendingType);
      return reply(
        route,
        wrap(
          (["create", "cancel"] as const).map((groupType) => {
            const row = state.rows.find((item) => item.group_type === groupType);
            return {
              group_type: groupType,
              linked: Boolean(row),
              is_active: row ? row.is_active : null,
              linked_at: row ? row.createdAt : null,
              inactive_reason: row && !row.is_active ? (row.inactive_reason ?? null) : null,
            };
          }),
        ),
      );
    }
    if (path === "notifications" && request.method() === "GET") {
      state.notificationRequests += 1;
      const groupType = url.searchParams.get("group_type");
      if (groupType === "create" || groupType === "cancel") watchPoll(groupType);
      const items = state.rows.filter((row) => !groupType || row.group_type === groupType);
      return reply(route, wrap({ items, meta: { total: items.length, page: 1, limit: 10 } }));
    }
    if (path === "telegram/link-code" && request.method() === "POST") {
      const body = request.postDataJSON() as { group_type?: "create" | "cancel" };
      state.linkRequests.push(body);
      state.pendingType = body.group_type ?? "create";
      state.watchPolls = 0;
      return reply(
        route,
        wrap({
          token: `c0de${state.linkRequests.length}`,
          purpose: "market_group",
          group_type: body.group_type,
          expires_at: new Date(Date.now() + expiresInMs).toISOString(),
          deep_link: TG_GROUP_DEEP_LINK,
          command: "/start c0de42",
        }),
      );
    }
    if (path === "markets/201/telegram-group-pii" && request.method() === "PATCH") {
      state.pii.push(request.postDataJSON());
      return reply(route, wrap({ ...TG_MARKET, ...(request.postDataJSON() as object) }));
    }
    if (request.method() !== "GET") return reply(route, { message: "e2e: kutilmagan yozish" }, 403);
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
  return state;
};
