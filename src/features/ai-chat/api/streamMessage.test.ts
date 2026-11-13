import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiAssistantEvent } from "../../../entities/ai-advisor";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn<(path: string, init: RequestInit) => Promise<Response>>() }));

vi.mock("../../../auth/authFetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../auth/authFetch")>()),
  authFetch: mocks.authFetch,
}));

import { parseRetryAfter, streamAssistantMessage } from "./streamMessage";

const encoder = new TextEncoder();

/** Bo'laklar ketma-ket; `fail` — oxirida oqim xatosi (ulanish uzildi). */
const sseResponse = (chunks: string[], { fail }: { fail?: unknown } = {}) => {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index += 1;
      } else if (fail) controller.error(fail);
      else controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
};

const frame = (event: string, data: object) => `event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`;

const run = async (input: { message: string; conversationId?: string | null }, signal?: AbortSignal) => {
  const events: AiAssistantEvent[] = [];
  const outcome = await streamAssistantMessage(input, { signal, onEvent: (event) => events.push(event) });
  return { events, outcome };
};

afterEach(() => vi.clearAllMocks());

describe("streamAssistantMessage — POST ai/assistant/messages (SSE)", () => {
  it("so'rov: JSON tanasi (birinchi savolda `conversation_id` yo'q), `Accept: text/event-stream`, signal", async () => {
    mocks.authFetch.mockResolvedValueOnce(sseResponse([frame("error", { code: "busy", message: "…" })]));
    const controller = new AbortController();
    await run({ message: "Bu oy kassaga qancha tushdi?", conversationId: null }, controller.signal);
    const [path, init] = mocks.authFetch.mock.calls[0];
    expect(path).toBe("ai/assistant/messages");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ message: "Bu oy kassaga qancha tushdi?" });
    expect(new Headers(init.headers).get("Accept")).toBe("text/event-stream");
    expect(init.signal).toBe(controller.signal);

    mocks.authFetch.mockResolvedValueOnce(sseResponse([frame("error", { code: "busy", message: "…" })]));
    await run({ message: "Davomi", conversationId: "42" });
    expect(JSON.parse(String(mocks.authFetch.mock.calls[1][1].body))).toEqual({ message: "Davomi", conversation_id: "42" });
  });

  it("hodisalar tartibda (bo'laklar orasida bo'lingan ham), noma'lum hodisa va `: ping` e'tiborsiz → `done`", async () => {
    const stream = [
      frame("meta", { conversation_id: "42", message_id: "900", model: "claude-sonnet-5", max_steps: 6 }),
      ": ping\n\n",
      frame("step", { step: 1 }),
      'event: delta\ndata: {"type":"delta","step":1,"te',
      'xt":"Kassa "}\n\n',
      frame("tool_call", { step: 1, id: "t1", tool: "get_cashbox_history", input: { from: "2026-10-01" } }),
      frame("future_event", { foo: 1 }),
      frame("tool_result", { step: 1, id: "t1", tool: "get_cashbox_history", ok: true, records: 12, period: null, truncated: false }),
      frame("done", {
        conversation_id: "42",
        message_id: "905",
        answer: "**286,4 mln so'm**",
        stop: "end_turn",
        steps: 2,
        sources: [{ tool: "get_cashbox_history", period: { from: "2026-10-01", to: "2026-10-23" }, records: 1284, truncated: false, ok: true }],
        usage: { input_tokens: 1, output_tokens: 1, cache_read_tokens: 0, cache_creation_tokens: 0, cost_usd: 0.01 },
        limits: { daily_limit: 100, used_today: 39, remaining_today: 61 },
      }),
    ];
    mocks.authFetch.mockResolvedValueOnce(sseResponse(stream));
    const { events, outcome } = await run({ message: "?" });
    expect(outcome).toEqual({ kind: "ended", terminal: "done" });
    expect(events.map((event) => event.type)).toEqual(["meta", "step", "delta", "tool_call", "tool_result", "done"]);
    expect(events[0]).toEqual({ type: "meta", conversationId: "42", messageId: "900", maxSteps: 6 });
    expect(events[2]).toEqual({ type: "delta", step: 1, text: "Kassa " });
    expect(events[5]).toMatchObject({
      type: "done",
      messageId: "905",
      answer: "**286,4 mln so'm**",
      limits: { dailyLimit: 100, usedToday: 39, remainingToday: 61 },
      sources: [{ tool: "get_cashbox_history", period: { from: "2026-10-01", to: "2026-10-23" }, records: 1284 }],
    });
  });

  it("`error` hodisasi — yakuniy (kod, xabar, `reset_at`)", async () => {
    mocks.authFetch.mockResolvedValueOnce(
      sseResponse([frame("error", { code: "assistant_usd_cap", message: "AI yordamchining …", reset_at: "2026-11-11T00:00:00+05:00" })]),
    );
    const { events, outcome } = await run({ message: "?" });
    expect(outcome).toEqual({ kind: "ended", terminal: "error" });
    expect(events).toEqual([
      { type: "error", code: "assistant_usd_cap", message: "AI yordamchining …", conversationId: null, resetAt: "2026-11-11T00:00:00+05:00" },
    ]);
  });

  it("oqim yakuniy hodisasiz yopildi — `ended` + `terminal: null`", async () => {
    mocks.authFetch.mockResolvedValueOnce(sseResponse([frame("meta", { conversation_id: "1", message_id: "2" })]));
    const { outcome } = await run({ message: "?" });
    expect(outcome).toEqual({ kind: "ended", terminal: null });
  });

  it("oqim o'rtada uzildi (`TypeError`) — `network`, kelgan hodisalar saqlanadi", async () => {
    mocks.authFetch.mockResolvedValueOnce(
      sseResponse([frame("meta", { conversation_id: "1", message_id: "2" }), frame("delta", { step: 1, text: "Hozir" })], {
        fail: new TypeError("network error"),
      }),
    );
    const { events, outcome } = await run({ message: "?" });
    expect(outcome.kind).toBe("network");
    expect(events.map((event) => event.type)).toEqual(["meta", "delta"]);
  });

  it("oqim ochilmadi: 429 + `Retry-After` / 503 — `http` (tana va soniyalar bilan)", async () => {
    mocks.authFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ statusCode: 429, message: "Too Many Requests" }), {
        status: 429,
        headers: { "Retry-After": "60", "Content-Type": "application/json" },
      }),
    );
    expect((await run({ message: "?" })).outcome).toEqual({
      kind: "http",
      status: 429,
      body: { statusCode: 429, message: "Too Many Requests" },
      retryAfter: 60,
    });
    mocks.authFetch.mockResolvedValueOnce(new Response("not json", { status: 503 }));
    expect((await run({ message: "?" })).outcome).toEqual({ kind: "http", status: 503, body: null, retryAfter: null });
  });

  it("javob kelmadi (`TypeError`) — `network`; bekor qilindi — `aborted`", async () => {
    mocks.authFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect((await run({ message: "?" })).outcome.kind).toBe("network");
    mocks.authFetch.mockRejectedValueOnce(new DOMException("aborted", "AbortError"));
    expect((await run({ message: "?" })).outcome).toEqual({ kind: "aborted" });
  });

  it("o'qish paytida «To'xtatish» — `aborted`", async () => {
    const controller = new AbortController();
    mocks.authFetch.mockResolvedValueOnce(
      sseResponse([frame("meta", { conversation_id: "1", message_id: "2" })], { fail: new DOMException("aborted", "AbortError") }),
    );
    const result = await run({ message: "?" }, controller.signal);
    expect(result.outcome).toEqual({ kind: "aborted" });
  });
});

describe("parseRetryAfter", () => {
  it("soniyalar, HTTP sana, yo'q", () => {
    expect(parseRetryAfter("60")).toBe(60);
    expect(parseRetryAfter("2.2")).toBe(3);
    expect(parseRetryAfter(new Date(Date.UTC(2026, 10, 10, 0, 1)).toUTCString(), Date.UTC(2026, 10, 10, 0, 0))).toBe(60);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("ertaga")).toBeNull();
  });
});
