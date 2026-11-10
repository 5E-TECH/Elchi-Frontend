import { expect, test, type Page, type Route } from "@playwright/test";

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
 *   `disabled` (503, funksiya o'chiq).
 *
 * Boshqa yozish so'rovlari taqiqlangan (`leaked`).
 */

type Source = { tool: string; period: { from: string; to: string } | null; records: number; truncated: boolean; ok: boolean };
type Message = { id: string; role: "user" | "assistant"; text: string; created_at: string; sources?: Source[]; stop?: string };
type Conversation = { id: string; title: string; turns: number; created_at: string; last_message_at: string; cost_usd: number; messages: Message[] };
export type MessageMode = "answer" | "pending" | "cut" | "limit" | "disabled";

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
  }: { role?: string; theme?: "light" | "dark"; conversations?: "seeded" | "none"; mode?: MessageMode } = {},
) => {
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

  return { state, leaked };
};

/** Sahifa ochildi va holat (`access/me`) keldi. */
export const openAiAssistant = async (page: Page, path = "/ai-assistant") => {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: "AI moliyaviy yordamchi" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("textbox", { name: "Savolingiz" })).toBeVisible();
};

export const composer = (page: Page) => page.getByRole("textbox", { name: "Savolingiz" });

export const expectNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};
