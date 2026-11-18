import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  AiAdvisorAlertDetail,
  AiAdvisorAlertListItem,
  AiAdvisorOverview,
} from "../../../src/entities/ai-advisor";
import { createAdvisorFixtures, type AdvisorFixtures } from "../../../src/test/aiAdvisorFixtures";

/**
 * F7PWp6cK — AI moliyaviy yordamchi (`/ai-assistant`, faqat superadmin). Soxta gateway backend kabi:
 *
 * - `GET ai/assistant/access/me` — `{allowed, reason, feature_enabled, daily_limit, used_today, remaining_today, reset_at}`;
 * - `GET ai/assistant/conversations?limit&offset` — o'z suhbatlari, yangisi birinchi; `GET …/conversations/:id` —
 *   xabarlar (`role`, `text`, `sources`, `stop`), yo'q — 404 «Suhbat topilmadi»;
 * - `POST ai/assistant/messages` `{message, conversation_id?}` — DTO (1..2000, `^\d{1,19}$`) — 400; SSE javob
 *   (`event: <type>\ndata: <json>\n\n`, `: ping`): `meta` → `step` → `delta` → `tool_call` → `tool_result` → … →
 *   `done` (yoki `error`). Rejimlar: `answer` (to'liq), `pending` (javob kelmaydi — «To'xtatish»), `cut` (meta + delta,
 *   keyin uziladi; to'liq javob 1 s dan keyin suhbatga yoziladi — ai-service kabi), `limit` (429, limit tugadi),
 *   `disabled` (503, funksiya o'chiq), `cap` (SSE `error` `assistant_usd_cap` `meta` gacha — xarajat shifti, savol
 *   saqlanmaydi, limitdan ketmaydi).
 *
 * - `ai/advisor/*` — maslahatchi (60PWUbgC): sukut `advisor: "off"` — 404 (bugungi prod), `on` — fixture'lar holat
 *   bilan, `forbidden` — 403 (pastda, `createAdvisorMock`). Har so'rov `advisor.requests` ga yoziladi.
 *
 * Boshqa yozish so'rovlari taqiqlangan (`leaked`); ruxsat: maslahatchi `PATCH alerts/:id`, `POST alerts/:id/explain`,
 * `PATCH settings`.
 */

type Source = { tool: string; period: { from: string; to: string } | null; records: number; truncated: boolean; ok: boolean };
type Message = { id: string; role: "user" | "assistant"; text: string; created_at: string; sources?: Source[]; stop?: string };
type Conversation = { id: string; title: string; turns: number; created_at: string; last_message_at: string; cost_usd: number; messages: Message[] };
export type MessageMode = "answer" | "pending" | "cut" | "limit" | "disabled" | "cap";

const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4173").origin;
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const ANSWER_MARKDOWN = [
  "Oktabr boshidan barcha kassalarga **286,4 mln so'm** tushdi — o'tgan oyning shu kunlaridan 7,2% ko'p.",
  "",
  "### Eng ko'p qarzi bor kuryerlar",
  "",
  "| Kuryer | Filial | Qarz |",
  "|---|---|---:|",
  "| Jasur Tursunov | Toshkent HQ | 2 840 000 so'm |",
  "| Sherzod Nazarov | Samarqand filiali | 2 160 000 so'm |",
  "",
  "- Eng katta qarz — Toshkent HQ kuryerlarida.",
].join("\n");

export const ANSWER_SOURCES: Source[] = [
  { tool: "get_cashbox_history", period: { from: "2026-10-01", to: "2026-10-23" }, records: 1284, truncated: false, ok: true },
  { tool: "get_courier_debts", period: null, records: 37, truncated: false, ok: true },
];

const SEEDED: Conversation[] = [
  {
    id: "41",
    title: "Marketlarga to'lanmagan summa",
    turns: 1,
    created_at: minutesAgo(600),
    last_message_at: minutesAgo(600),
    cost_usd: 0.03,
    messages: [
      { id: "501", role: "user", text: "Marketlarga to'lanmagan summa qancha?", created_at: minutesAgo(600) },
      {
        id: "502",
        role: "assistant",
        text: "Hozir marketlarga to'lanmagan jami **18,4 mln so'm**.\n\n| Market | Summa |\n|---|---:|\n| Mebel Plus | 6 200 000 so'm |",
        created_at: minutesAgo(600),
        sources: [{ tool: "get_market_payables", period: null, records: 12, truncated: false, ok: true }],
        stop: "end_turn",
      },
    ],
  },
];

const frame = (event: string, data: Record<string, unknown>) => `event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`;

export const mockAiAssistantApi = async (
  page: Page,
  {
    role = "superadmin",
    theme,
    conversations = "seeded",
    mode = "answer",
    advisor = "off",
    settings = "on",
    explain = "queued",
    patch = "ok",
    settingsPatch = "ok",
    explainReadyAfter = 2,
  }: {
    role?: string;
    theme?: "light" | "dark";
    conversations?: "seeded" | "none";
    mode?: MessageMode;
    advisor?: AdvisorMode;
    settings?: "on" | "off";
    explain?: AdvisorExplainMode;
    patch?: AdvisorPatchMode;
    /** `PATCH settings`: `invalid_rule` — 400 `INVALID_RULE` (`rules.R1.consecutive_negative`), `error` — 500. */
    settingsPatch?: AdvisorSettingsPatchMode;
    /** `pending` izoh nechta `GET :id` dan keyin `ready` bo'ladi. */
    explainReadyAfter?: number;
  } = {},
) => {
  const advisorMock = createAdvisorMock({ mode: advisor, settings, explain, patch, settingsPatch, explainReadyAfter });
  const origin = appOrigin();
  const corsFor = (route: Route) => ({
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": route.request().headers()["access-control-request-headers"] ?? "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "access-control-expose-headers": "Retry-After",
  });
  const reply = (route: Route, body: unknown, status = 200, extra: Record<string, string> = {}) =>
    route.fulfill({ status, contentType: "application/json", headers: { ...corsFor(route), ...extra }, body: JSON.stringify(body) });

  const state = {
    mode,
    access: {
      allowed: true,
      reason: null as string | null,
      feature_enabled: true,
      daily_limit: 100,
      used_today: 38,
      remaining_today: 62,
      reset_at: "2026-11-11T00:00:00+05:00",
    },
    conversations: conversations === "seeded" ? structuredClone(SEEDED) : ([] as Conversation[]),
    nextConversation: 77,
    nextMessage: 900,
    posts: [] as Array<Record<string, unknown>>,
    /** `pending` rejimidagi ochiq so'rovlar soni (javob kelmaydi). */
    hanging: 0,
  };
  const leaked: string[] = [];

  const ask = (body: Record<string, unknown>) => {
    const question = String(body.message ?? "").trim();
    let conversation = state.conversations.find((item) => item.id === body.conversation_id);
    if (!conversation) {
      conversation = {
        id: String(state.nextConversation++),
        title: question.slice(0, 80),
        turns: 0,
        created_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        cost_usd: 0,
        messages: [],
      };
      state.conversations.unshift(conversation);
    }
    const questionId = String(state.nextMessage++);
    conversation.messages.push({ id: questionId, role: "user", text: question, created_at: new Date().toISOString() });
    conversation.turns += 1;
    conversation.last_message_at = new Date().toISOString();
    state.access.used_today += 1;
    state.access.remaining_today = Math.max(0, state.access.daily_limit - state.access.used_today);
    return { conversation, questionId };
  };

  const answerRow = (): Message => ({
    id: String(state.nextMessage++),
    role: "assistant",
    text: ANSWER_MARKDOWN,
    created_at: new Date().toISOString(),
    sources: ANSWER_SOURCES,
    stop: "end_turn",
  });

  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsFor(route) });
    const path = url.pathname.replace(/^\//, "");
    const method = request.method();

    if (path === "auth/my-profile") {
      const settings = theme ? { settings: { appearance: { theme, themeChosen: true } } } : {};
      return reply(route, wrap({ id: "1", role, name: "Shodiyor Ergashev", status: "active", ...settings }));
    }
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 0 }));

    if (path.startsWith("ai/advisor/")) {
      const body = method === "GET" ? undefined : (request.postDataJSON() ?? {});
      const result = advisorMock.handle(method, path, url.searchParams, body);
      return reply(route, result.body, result.status);
    }

    if (path === "ai/assistant/access/me" && method === "GET") {
      if (role !== "superadmin" && role !== "admin") return reply(route, { statusCode: 403, message: "Forbidden" }, 403);
      return reply(route, wrap(state.access));
    }
    if (path === "ai/assistant/conversations" && method === "GET") {
      const limit = Number(url.searchParams.get("limit") ?? 20);
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const items = state.conversations
        .slice(offset, offset + limit)
        .map(({ id, title, turns, created_at, last_message_at, cost_usd }) => ({ id, title, turns, created_at, last_message_at, cost_usd }));
      return reply(route, wrap({ items, total: state.conversations.length, limit, offset }));
    }
    const detail = /^ai\/assistant\/conversations\/([^/]+)$/.exec(path);
    if (detail && method === "GET") {
      if (!/^\d{1,19}$/.test(detail[1])) return reply(route, { statusCode: 400, message: "Suhbat ID si noto'g'ri" }, 400);
      const conversation = state.conversations.find((item) => item.id === detail[1]);
      if (!conversation) return reply(route, { statusCode: 404, message: "Suhbat topilmadi" }, 404);
      return reply(route, wrap(conversation));
    }

    if (path === "ai/assistant/messages" && method === "POST") {
      const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      state.posts.push(body);
      const message = typeof body.message === "string" ? body.message.trim() : "";
      const badId = body.conversation_id !== undefined && !/^\d{1,19}$/.test(String(body.conversation_id));
      if (!message || message.length > 2000 || badId) {
        return reply(route, { statusCode: 400, message: ["message should not be empty"] }, 400);
      }
      if (state.mode === "disabled") {
        state.access = { ...state.access, allowed: false, reason: "feature_disabled", feature_enabled: false };
        return reply(route, { statusCode: 503, message: "AI yordamchi hozircha o'chirilgan" }, 503);
      }
      if (state.mode === "limit") {
        state.access = { ...state.access, used_today: 100, remaining_today: 0 };
        return reply(route, { statusCode: 429, message: "Bugungi savollar limiti tugadi" }, 429, { "retry-after": "60" });
      }
      if (state.mode === "pending") {
        state.hanging += 1;
        return; // Javob kelmaydi — «To'xtatish» bilan uziladi.
      }
      if (state.mode === "cap") {
        return route.fulfill({
          status: 200,
          headers: { ...corsFor(route), "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform" },
          body: frame("error", {
            code: "assistant_usd_cap",
            message: "AI yordamchining bugungi xarajat shifti tugadi",
            reset_at: new Date(Date.now() + 3_600_000).toISOString(),
          }),
        });
      }
      const { conversation, questionId } = ask(body);
      const head =
        frame("meta", { conversation_id: conversation.id, message_id: questionId, model: "claude-sonnet-5", max_steps: 6 }) +
        ": ping\n\n" +
        frame("step", { step: 1 }) +
        frame("delta", { step: 1, text: "Kassa tarixini ko'ryapman." }) +
        frame("tool_call", { step: 1, id: "toolu_1", tool: "get_cashbox_history", input: { from: "2026-10-01", to: "2026-10-23" } }) +
        frame("tool_result", { step: 1, id: "toolu_1", tool: "get_cashbox_history", ok: true, records: 1284, period: { from: "2026-10-01", to: "2026-10-23" }, truncated: false });
      if (state.mode === "cut") {
        // Oqim uziladi, ai-service esa javobni baribir saqlaydi (1 s dan keyin).
        setTimeout(() => {
          conversation.messages.push(answerRow());
        }, 1_000);
        return route.fulfill({
          status: 200,
          headers: { ...corsFor(route), "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform" },
          body: head + frame("step", { step: 2 }) + frame("delta", { step: 2, text: "Hozir marketlarga to'lanmagan jami" }),
        });
      }
      const row = answerRow();
      conversation.messages.push(row);
      return route.fulfill({
        status: 200,
        headers: { ...corsFor(route), "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform" },
        body:
          head +
          frame("step", { step: 2 }) +
          frame("delta", { step: 2, text: "Oktabr boshidan " }) +
          frame("done", {
            conversation_id: conversation.id,
            message_id: row.id,
            answer: ANSWER_MARKDOWN,
            stop: "end_turn",
            steps: 2,
            sources: ANSWER_SOURCES,
            usage: { input_tokens: 4200, output_tokens: 600, cache_read_tokens: 3800, cache_creation_tokens: 0, cost_usd: 0.021 },
            limits: { daily_limit: state.access.daily_limit, used_today: state.access.used_today, remaining_today: state.access.remaining_today },
          }),
      });
    }

    if (method !== "GET") {
      leaked.push(`${method} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
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

  return { state, leaked, advisor: advisorMock.state, advisorFixtures: advisorMock.fixtures };
};

/** Sahifa ochildi va holat (`access/me`) keldi. */
export const openAiAssistant = async (page: Page, path = "/ai-assistant") => {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: "AI moliyaviy yordamchi" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("textbox", { name: "Savolingiz" })).toBeVisible();
};

export const composer = (page: Page) => page.getByRole("textbox", { name: "Savolingiz" });

/** Maketdagi birinchi qator (R2, «Jiddiy», «Yangi»). */
export const FIRST_ALERT_TITLE = "Jasur Tursunov kassasida 2 840 000 so'm — 4 kundan beri topshirilmagan";

/** «Ogohlantirishlar» tabi ochildi va ro'yxat keldi (`advisor: "on"`). */
export const openAiAlerts = async (page: Page, path = "/ai-assistant?tab=alerts") => {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: "AI moliyaviy yordamchi" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(FIRST_ALERT_TITLE)).toBeVisible();
};

/** Maslahatchi so'rovlari (yo'l bo'yicha). */
export const advisorCalls = (state: { requests: AdvisorRequest[] }, path: string, method = "GET") =>
  state.requests.filter((request) => request.path === path && request.method === method);

export const expectNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

// ── 60PWUbgC — AI maslahatchi (`ai/advisor/*`) ─────────────────────────────────────────────────────────────

/**
 * Maslahatchi backend'i (shartnoma v0.3 + backend dev: #644, #651–#657 va review tuzatishlari — tekshiruv tartibi va
 * kodlar `advisor-alerts.service.ts` / `advisor-settings.rules.ts` dagidek):
 * - `off` (sukut, bugungi prod) — har `ai/advisor/*` → 404: sahifa avvalgidek faqat suhbat;
 * - `forbidden` — 403 (ruxsat yo'q — ham faqat suhbat);
 * - `on` — fixture'lar (`src/test/aiAdvisorFixtures.ts`) holat bilan: ro'yxat 22 ta (maketdagi 8 + 14 ta yopilgan),
 *   filtr (`status`, `severity`, `rule_key`), sahifalash, `counts.by_status` (status filtrisiz); `overview` — joriy
 *   holatdan; `GET alerts/:id` — `new` → `seen` (yon ta'sir); izohda `pending` → `explainReadyAfter` ta so'rovdan
 *   keyin `ready` (`stuck` — hech qachon); `PATCH alerts/:id` — izoh 3–500 («Hal qilindi»), `closed` rejimida 409;
 *   `GET/PATCH settings` (`settings: "off"` — 404), `version` bilan (eskisi — 409; `severity` / `telegram` / boshqa
 *   kalit — 400 `INVALID_SETTING`; `settingsPatch`: `invalid_rule` — 400 `INVALID_RULE`, `error` — 500).
 */
export type AdvisorMode = "off" | "on" | "forbidden";
export type AdvisorExplainMode = "queued" | "cached" | "stuck" | "budget_month" | "budget_global" | "disabled";
export type AdvisorPatchMode = "ok" | "closed";
export type AdvisorSettingsPatchMode = "ok" | "invalid_rule" | "error";
export type AdvisorRequest = { method: string; path: string; query: Record<string, string>; body: unknown };

const ADVISOR_STATUSES = ["new", "seen", "resolved", "dismissed"] as const;
const ADVISOR_RULES = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"] as const;

/** Maketdagi 8 qatordan keyin — eski yopilgan ogohlantirishlar (jami 22: yangi 3, ko'rildi 3, hal 12, ahamiyatsiz 4). */
const paddedAlerts = (fx: AdvisorFixtures): AiAdvisorAlertDetail[] => {
  const base = fx.items.map((item) => ({ ...(fx.details[item.id] ?? fx.detail.r1), ...item }) as AiAdvisorAlertDetail);
  const extras = Array.from({ length: 14 }, (_, index) => {
    const source = index % 2 === 0 ? fx.detail.r1 : fx.detail.r3;
    const dismissed = index >= 11;
    const lastAt = fx.at(-5 - index, 10, 0);
    return {
      ...source,
      id: String(1000 - index),
      status: dismissed ? "dismissed" : "resolved",
      occurrences: 1,
      first_at: lastAt,
      last_at: lastAt,
      seen_at: lastAt,
      resolved_at: lastAt,
      resolved_by: { id: "1", name: "Shodiyor Ergashev" },
      resolution_note: dismissed ? null : "Tekshirildi, tartibda.",
    } as AiAdvisorAlertDetail;
  });
  return [...base, ...extras];
};

const listItemOf = (detail: AiAdvisorAlertDetail, keys: readonly string[]): AiAdvisorAlertListItem =>
  Object.fromEntries(keys.map((key) => [key, (detail as unknown as Record<string, unknown>)[key]])) as unknown as AiAdvisorAlertListItem;

export const createAdvisorMock = ({
  mode,
  settings,
  explain,
  patch,
  settingsPatch = "ok",
  explainReadyAfter,
}: {
  mode: AdvisorMode;
  settings: "on" | "off";
  explain: AdvisorExplainMode;
  patch: AdvisorPatchMode;
  settingsPatch?: AdvisorSettingsPatchMode;
  explainReadyAfter: number;
}) => {
  const fx = createAdvisorFixtures();
  const listKeys = Object.keys(fx.items[0]);
  const state = {
    mode,
    settingsMode: settings,
    explain,
    patch,
    /** Test o'rtasida o'zgartirsa bo'ladi (`advisor.settingsPatch = "ok"`). */
    settingsPatch,
    explainReadyAfter,
    alerts: paddedAlerts(fx),
    settings: structuredClone(fx.settings),
    /** `pending` izohli ogohlantirish → `GET :id` so'rovlari soni. */
    polls: new Map<string, number>(),
    requests: [] as AdvisorRequest[],
  };

  const overview = (): AiAdvisorOverview => {
    const isNew = (alert: AiAdvisorAlertDetail) => alert.status === "new";
    const isOpen = (alert: AiAdvisorAlertDetail) => alert.status === "new" || alert.status === "seen";
    // Shartnoma / BE: MAX(last_at) DESC, keyin rule_key.
    const keys = (pick: (alert: AiAdvisorAlertDetail) => boolean) => {
      const newest = new Map<string, number>();
      for (const alert of state.alerts) {
        if (alert.severity !== "critical" || !pick(alert)) continue;
        newest.set(alert.rule_key, Math.max(newest.get(alert.rule_key) ?? -Infinity, Date.parse(alert.last_at)));
      }
      return ADVISOR_RULES.filter((rule) => newest.has(rule)).sort(
        (a, b) => newest.get(b)! - newest.get(a)! || a.localeCompare(b),
      );
    };
    return {
      ...fx.overview,
      alerts: {
        new: state.alerts.filter(isNew).length,
        open: state.alerts.filter(isOpen).length,
        critical: state.alerts.filter((alert) => isNew(alert) && alert.severity === "critical").length,
        critical_open: state.alerts.filter((alert) => isOpen(alert) && alert.severity === "critical").length,
        critical_rule_keys: keys(isNew),
        critical_open_rule_keys: keys(isOpen),
      },
      generated_at: new Date().toISOString(),
    };
  };

  type Reply = { status: number; body: unknown };
  type ErrorBody = { statusCode: number } & Record<string, unknown>;
  const ok = (data: unknown, status = 200, message = "OK"): Reply => ({ status, body: { statusCode: status, message, data } });
  const fail = (body: ErrorBody): Reply => ({ status: body.statusCode, body });
  const badRequest = (message: string): Reply => fail({ statusCode: 400, message });
  const notFound = (method: string, path: string): Reply => fail({ statusCode: 404, message: `Cannot ${method} /${path}`, error: "Not Found" });

  const handle = (method: string, path: string, query: URLSearchParams, body: unknown): Reply => {
    state.requests.push({ method, path, query: Object.fromEntries(query), body });
    if (state.mode === "off") return notFound(method, path);
    if (state.mode === "forbidden") return fail(fx.errors.forbidden);

    if (path === "ai/advisor/overview" && method === "GET") return ok(overview(), 200, "AI advisor overview");

    if (path === "ai/advisor/alerts" && method === "GET") {
      const status = query.get("status");
      const severity = query.get("severity");
      const rule = query.get("rule_key");
      const page = Number(query.get("page") ?? 1);
      const limit = Number(query.get("limit") ?? 10);
      if (status && status !== "open" && !(ADVISOR_STATUSES as readonly string[]).includes(status)) return badRequest("status noto'g'ri");
      if (severity && severity !== "warning" && severity !== "critical") return badRequest("severity noto'g'ri");
      if (rule && !(ADVISOR_RULES as readonly string[]).includes(rule)) return badRequest("rule_key noto'g'ri");
      if (!Number.isInteger(page) || page < 1 || ![1, 10, 25, 50, 100].includes(limit)) return badRequest("page/limit noto'g'ri");
      const scoped = state.alerts.filter((alert) => (!severity || alert.severity === severity) && (!rule || alert.rule_key === rule));
      const matches = scoped.filter((alert) =>
        !status ? true : status === "open" ? alert.status === "new" || alert.status === "seen" : alert.status === status,
      );
      const by_status = Object.fromEntries(ADVISOR_STATUSES.map((value) => [value, scoped.filter((alert) => alert.status === value).length]));
      const total = matches.length;
      return ok({
        items: matches.slice((page - 1) * limit, page * limit).map((alert) => listItemOf(alert, listKeys)),
        meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        counts: { by_status },
      });
    }

    const one = /^ai\/advisor\/alerts\/([^/]+)(\/explain)?$/.exec(path);
    if (one) {
      const [, id, explainPath] = one;
      if (!/^\d{1,18}$/.test(id)) return badRequest("Ogohlantirish ID si noto'g'ri");
      const alert = state.alerts.find((item) => item.id === id);
      if (!alert) return fail(fx.errors.notFound);
      const closed = alert.status === "resolved" || alert.status === "dismissed";

      if (!explainPath && method === "GET") {
        if (alert.status === "new") Object.assign(alert, { status: "seen", seen_at: new Date().toISOString(), seen_by: { id: "1", name: "Shodiyor Ergashev" } });
        if (alert.explanation_status === "pending") {
          const polls = (state.polls.get(id) ?? 0) + 1;
          state.polls.set(id, polls);
          if (state.explain !== "stuck" && polls >= state.explainReadyAfter) {
            Object.assign(alert, {
              explanation_status: "ready",
              explanation_md: fx.explain.cached.explanation_md,
              explained_at: new Date().toISOString(),
              explanation_poll_after_ms: null,
            });
          }
        }
        return ok(alert);
      }

      if (explainPath && method === "POST") {
        if (closed) return fail(fx.errors.explainClosed);
        if (state.explain === "budget_month") return fail(fx.errors.budgetAdvisorMonth);
        if (state.explain === "budget_global") return fail(fx.errors.budgetGlobalDay);
        if (state.explain === "disabled") return fail(fx.errors.aiDisabled);
        if (alert.explanation_status === "ready" || state.explain === "cached") {
          Object.assign(alert, {
            explanation_status: "ready",
            explanation_md: alert.explanation_md ?? fx.explain.cached.explanation_md,
            explained_at: alert.explained_at ?? new Date().toISOString(),
          });
          return ok({ ...fx.explain.cached, alert_id: id, explanation_md: alert.explanation_md, explained_at: alert.explained_at }, 202, "Explanation queued");
        }
        state.polls.set(id, 0);
        Object.assign(alert, {
          explanation_status: "pending",
          explanation_md: null,
          explanation_error: null,
          explanation_requested_at: new Date().toISOString(),
          explanation_poll_after_ms: fx.explain.queued.poll_after_ms,
        });
        return ok({ ...fx.explain.queued, alert_id: id }, 202, "Explanation queued");
      }

      if (!explainPath && method === "PATCH") {
        // Backend `AdvisorAlertsService.update` tartibi: holat (kodsiz 400) → ayni foydalanuvchi ayni holat — 200
        // o'zgarishsiz → yopilgan — 409 (izoh xatosidan oldin) → izoh (`normalizeNote`: matn emas — `required`,
        // boshqaruv belgisi — kodsiz 400, avval `too_long`, keyin «Hal qilindi» uchun `required` / `too_short`).
        const { status, note } = (body ?? {}) as { status?: string; note?: unknown };
        if (status !== "resolved" && status !== "dismissed") return badRequest("status noto'g'ri");
        if (state.patch !== "closed" && alert.status === status && alert.resolved_by?.id === "1") return ok(alert, 200, "AI advisor alert");
        if (state.patch === "closed") return fail(fx.errors.closed);
        if (closed) return fail({ ...fx.errors.closed, alert_status: alert.status });
        if (note !== undefined && note !== null && typeof note !== "string") {
          return fail({ ...fx.errors.noteRequired, message: "Izoh matn bo'lishi kerak" });
        }
        // eslint-disable-next-line no-control-regex -- backend `CONTROL_CHARS` (\n, \t dan tashqari) bilan bir xil
        if (typeof note === "string" && /[\u0000-\u0008\u000b-\u001f\u007f]/.test(note)) {
          return badRequest("Izohda ruxsat etilmagan belgi bor");
        }
        const text = typeof note === "string" ? note.trim() : "";
        if (text.length > 500) return fail(fx.errors.noteTooLong);
        if (status === "resolved") {
          if (!text) return fail(fx.errors.noteRequired);
          if (text.length < 3) return fail(fx.errors.noteTooShort);
        }
        Object.assign(alert, {
          status,
          resolved_at: new Date().toISOString(),
          resolved_by: { id: "1", name: "Shodiyor Ergashev" },
          resolution_note: text || null,
        });
        return ok(alert, 200, "AI advisor alert");
      }
    }

    if (path === "ai/advisor/settings") {
      if (state.settingsMode === "off") return notFound(method, path);
      if (method === "GET") return ok(state.settings);
      if (method === "PATCH") {
        // Backend `parseSettingsPatch` + `AdvisorSettingsService.update` tartibi: noma'lum top kalit → `version` →
        // `telegram`/`budget`/`schedule` (BE-1 gacha) → qoidalar (noma'lum qoida / maydon, `severity`, boolean
        // `enabled`/`telegram`, chegara `limits` bo'yicha — 400 `INVALID_RULE {field, min, max}`) → versiya (409);
        // qisman birlashtirish (yuborilmagan maydon, masalan R8 `min_count`, o'zgarmaydi); o'zgarishsiz PATCH
        // versiyani oshirmaydi.
        const patchBody = (body ?? {}) as Record<string, unknown>;
        const unknownKey = Object.keys(patchBody).find((key) => !["version", "rules", "telegram", "budget", "schedule"].includes(key));
        if (unknownKey) return fail({ ...fx.errors.invalidSetting, field: unknownKey });
        const { version } = patchBody;
        if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return fail(fx.errors.invalidSetting);
        const notOwned = (["telegram", "budget", "schedule"] as const).find((key) => patchBody[key] !== undefined && patchBody[key] !== null);
        if (notOwned) return fail({ ...fx.errors.invalidSetting, field: notOwned });
        const rules = (patchBody.rules ?? undefined) as Record<string, Record<string, unknown>> | undefined;
        for (const [rule, patchRule] of Object.entries(rules ?? {})) {
          if (!(ADVISOR_RULES as readonly string[]).includes(rule)) return fail({ ...fx.errors.invalidSetting, field: `rules.${rule}` });
          const limits = (state.settings.limits.rules as Record<string, Record<string, { min: number; max: number; step: number }>>)[rule] ?? {};
          for (const [field, value] of Object.entries(patchRule)) {
            const path = `rules.${rule}.${field}`;
            if (field === "severity") return fail({ ...fx.errors.invalidSetting, field: path });
            if (field === "enabled" || field === "telegram") {
              if (typeof value !== "boolean") return fail({ ...fx.errors.invalidSetting, field: path });
              continue;
            }
            const limit = Object.hasOwn(limits, field) ? limits[field] : undefined;
            if (!limit) return fail({ ...fx.errors.invalidSetting, field: path });
            const onStep = limit.step >= 1 ? Number.isInteger(value) : Math.abs((value as number) / limit.step - Math.round((value as number) / limit.step)) < 1e-9;
            if (typeof value !== "number" || !Number.isFinite(value) || value < limit.min || value > limit.max || !onStep) {
              return fail({ ...fx.errors.invalidRule, field: path, min: limit.min, max: limit.max });
            }
          }
        }
        if (state.settingsPatch === "invalid_rule") return fail(fx.errors.invalidRule);
        if (state.settingsPatch === "error") return fail({ statusCode: 500, message: "Internal server error" });
        if (version !== state.settings.version) return fail({ ...fx.errors.settingsConflict, version: state.settings.version });
        const next = structuredClone(state.settings);
        let changed = false;
        for (const [rule, patchRule] of Object.entries(rules ?? {})) {
          const target = next.rules[rule as (typeof ADVISOR_RULES)[number]] as unknown as Record<string, unknown>;
          for (const [field, value] of Object.entries(patchRule)) {
            if (target[field] === value) continue;
            target[field] = value;
            changed = true;
          }
        }
        if (changed) state.settings = { ...next, version: next.version + 1, updated_at: new Date().toISOString() };
        return ok(state.settings);
      }
    }

    return notFound(method, path);
  };

  return { state, handle, fixtures: fx };
};
