import { describe, expect, it } from "vitest";
import {
  normalizeAccessList,
  normalizeAccessState,
  normalizeAssistantEvent,
  normalizeConversation,
  normalizeConversationList,
} from "./normalize";

describe("AI yordamchi javoblari → tiplar", () => {
  it("access/me: o'ram `data`, sabab va limit", () => {
    expect(
      normalizeAccessState({
        statusCode: 200,
        data: { allowed: false, reason: "feature_disabled", feature_enabled: false, daily_limit: 100, used_today: 38, remaining_today: 62, reset_at: "2026-11-11T00:00:00+05:00" },
      }),
    ).toEqual({
      allowed: false,
      reason: "feature_disabled",
      featureEnabled: false,
      dailyLimit: 100,
      usedToday: 38,
      remainingToday: 62,
      resetAt: "2026-11-11T00:00:00+05:00",
    });
    expect(normalizeAccessState({ data: { allowed: true, reason: "boshqa", daily_limit: 10, used_today: 4 } })).toMatchObject({
      reason: null,
      remainingToday: 6,
    });
  });

  it("suhbatlar ro'yxati: ID siz qator tashlanadi, son ID satrga", () => {
    expect(
      normalizeConversationList({
        data: { items: [{ id: 41, title: " Oktabr ", turns: 2, last_message_at: "2026-11-10T09:12:00Z" }, { title: "ID yo'q" }], total: 7, limit: 50, offset: 0 },
      }),
    ).toEqual({
      items: [{ id: "41", title: "Oktabr", turns: 2, lastMessageAt: "2026-11-10T09:12:00Z", createdAt: null }],
      total: 7,
      limit: 50,
      offset: 0,
    });
  });

  it("suhbat: user qatorida `sources`/`stop` yo'q, assistant qatorida bor", () => {
    const conversation = normalizeConversation({
      data: {
        id: "41",
        title: "t",
        turns: 1,
        messages: [
          { id: "1", role: "user", text: "Savol", created_at: "2026-11-10T09:12:00Z", sources: [{ tool: "x" }] },
          { id: "2", role: "assistant", text: "Javob", created_at: null, stop: "end_turn", sources: [{ tool: "get_order_flow", period: null, records: "5", ok: true }] },
        ],
      },
    });
    expect(conversation?.messages).toEqual([
      { id: "1", role: "user", text: "Savol", createdAt: "2026-11-10T09:12:00Z", sources: [], stop: null },
      { id: "2", role: "assistant", text: "Javob", createdAt: null, sources: [{ tool: "get_order_flow", period: null, records: 5, truncated: false, ok: true }], stop: "end_turn" },
    ]);
    expect(normalizeConversation({ data: null })).toBeNull();
  });

  it("SSE hodisasi: nom `event:` dan yoki `data.type` dan; buzilgan JSON va noma'lum hodisa — `null`", () => {
    expect(normalizeAssistantEvent("message", '{"type":"step","step":2}')).toEqual({ type: "step", step: 2 });
    expect(normalizeAssistantEvent("delta", '{"step":1,"text":"a"}')).toEqual({ type: "delta", step: 1, text: "a" });
    expect(normalizeAssistantEvent("delta", "{buzilgan")).toBeNull();
    expect(normalizeAssistantEvent("future", '{"a":1}')).toBeNull();
    expect(normalizeAssistantEvent("meta", '{"conversation_id":"1"}')).toBeNull();
    expect(normalizeAssistantEvent("error", '{"message":"x"}')).toEqual({ type: "error", code: "ai_error", message: "x", conversationId: null, resetAt: null });
  });
});

describe("AI yordamchi ruxsatlari (GET ai/assistant/access, F7PWp6cK)", () => {
  it("o'ram `data`; ID'siz qator tashlanadi; limit null — sukut; sukut kelmasa 100", () => {
    expect(
      normalizeAccessList({
        statusCode: 200,
        data: {
          feature_enabled: true,
          default_daily_limit: 80,
          items: [
            { user_id: 7, enabled: true, daily_limit: "30", effective_daily_limit: 30, updated_at: "2026-11-23T10:00:00Z" },
            { user_id: "8", enabled: false, daily_limit: null, effective_daily_limit: 80 },
            { enabled: true },
          ],
        },
      }),
    ).toEqual({
      featureEnabled: true,
      defaultDailyLimit: 80,
      items: [
        { userId: "7", enabled: true, dailyLimit: 30, effectiveDailyLimit: 30, updatedAt: "2026-11-23T10:00:00Z" },
        { userId: "8", enabled: false, dailyLimit: null, effectiveDailyLimit: 80, updatedAt: null },
      ],
    });
    expect(normalizeAccessList({ data: {} })).toEqual({ featureEnabled: false, defaultDailyLimit: 100, items: [] });
  });
});
