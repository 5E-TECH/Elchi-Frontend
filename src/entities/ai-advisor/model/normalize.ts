import type {
  AiAccessReason,
  AiAccessState,
  AiAssistantEvent,
  AiConversation,
  AiConversationList,
  AiConversationSummary,
  AiLimits,
  AiMessage,
  AiSource,
  AiSourcePeriod,
} from "./types";

/**
 * API javoblari → tiplar. Backend `bigint` ID'larni satr qilib beradi (son ham kelsa — satrga). Noto'g'ri qator
 * (ID siz) tashlanadi; sonlar — chekli bo'lmasa 0.
 */

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Raw) : null;

const idOf = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
};

const textOf = (value: unknown): string => (typeof value === "string" ? value : "");

const numberOf = (value: unknown, fallback = 0): number => {
  const num = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(num) ? num : fallback;
};

const dateOf = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);

const ACCESS_REASONS: readonly AiAccessReason[] = ["role_forbidden", "access_disabled", "feature_disabled", "ai_disabled"];

/** `{statusCode, message, data}` o'rami — `data` (o'ramsiz javob ham qabul qilinadi). */
export const unwrapData = (payload: unknown): unknown => {
  const record = asRecord(payload);
  return record && "data" in record ? record.data : payload;
};

export const normalizeAccessState = (payload: unknown): AiAccessState => {
  const raw = asRecord(unwrapData(payload)) ?? {};
  const reason = ACCESS_REASONS.find((item) => item === raw.reason) ?? null;
  const dailyLimit = Math.max(0, numberOf(raw.daily_limit));
  const usedToday = Math.max(0, numberOf(raw.used_today));
  return {
    allowed: raw.allowed === true,
    reason,
    featureEnabled: raw.feature_enabled === true,
    dailyLimit,
    usedToday,
    remainingToday: Math.max(0, numberOf(raw.remaining_today, dailyLimit - usedToday)),
    resetAt: dateOf(raw.reset_at),
  };
};

const normalizePeriod = (value: unknown): AiSourcePeriod | null => {
  const raw = asRecord(value);
  const from = textOf(raw?.from).trim();
  const to = textOf(raw?.to).trim();
  return from && to ? { from, to } : null;
};

export const normalizeSource = (value: unknown): AiSource | null => {
  const raw = asRecord(value);
  const tool = textOf(raw?.tool).trim();
  if (!raw || !tool) return null;
  return {
    tool,
    period: normalizePeriod(raw.period),
    records: Math.max(0, numberOf(raw.records)),
    truncated: raw.truncated === true,
    ok: raw.ok !== false,
  };
};

const normalizeSources = (value: unknown): AiSource[] =>
  Array.isArray(value) ? value.map(normalizeSource).filter((item): item is AiSource => item !== null) : [];

export const normalizeConversationSummary = (value: unknown): AiConversationSummary | null => {
  const raw = asRecord(value);
  const id = idOf(raw?.id);
  if (!raw || !id) return null;
  return {
    id,
    title: textOf(raw.title).trim(),
    turns: Math.max(0, numberOf(raw.turns)),
    lastMessageAt: dateOf(raw.last_message_at),
    createdAt: dateOf(raw.created_at),
  };
};

export const normalizeConversationList = (payload: unknown): AiConversationList => {
  const raw = asRecord(unwrapData(payload)) ?? {};
  const items = Array.isArray(raw.items)
    ? raw.items.map(normalizeConversationSummary).filter((item): item is AiConversationSummary => item !== null)
    : [];
  return {
    items,
    total: Math.max(items.length, numberOf(raw.total, items.length)),
    limit: numberOf(raw.limit, items.length),
    offset: numberOf(raw.offset),
  };
};

export const normalizeMessage = (value: unknown): AiMessage | null => {
  const raw = asRecord(value);
  const id = idOf(raw?.id);
  if (!raw || !id) return null;
  const role = raw.role === "user" ? "user" : "assistant";
  return {
    id,
    role,
    text: textOf(raw.text),
    createdAt: dateOf(raw.created_at),
    sources: role === "assistant" ? normalizeSources(raw.sources) : [],
    stop: role === "assistant" && typeof raw.stop === "string" ? raw.stop : null,
  };
};

export const normalizeConversation = (payload: unknown): AiConversation | null => {
  const raw = asRecord(unwrapData(payload));
  const id = idOf(raw?.id);
  if (!raw || !id) return null;
  return {
    id,
    title: textOf(raw.title).trim(),
    turns: Math.max(0, numberOf(raw.turns)),
    createdAt: dateOf(raw.created_at),
    lastMessageAt: dateOf(raw.last_message_at),
    messages: Array.isArray(raw.messages)
      ? raw.messages.map(normalizeMessage).filter((item): item is AiMessage => item !== null)
      : [],
  };
};

const normalizeLimits = (value: unknown): AiLimits | null => {
  const raw = asRecord(value);
  if (!raw) return null;
  const dailyLimit = numberOf(raw.daily_limit, NaN);
  const usedToday = numberOf(raw.used_today, NaN);
  if (!Number.isFinite(dailyLimit) || !Number.isFinite(usedToday)) return null;
  return {
    dailyLimit: Math.max(0, dailyLimit),
    usedToday: Math.max(0, usedToday),
    remainingToday: Math.max(0, numberOf(raw.remaining_today, dailyLimit - usedToday)),
  };
};

/**
 * SSE hodisasi (`event` nomi + `data` JSON) → tip. Hodisa nomi bo'lmasa — `data.type`. Noma'lum hodisa yoki buzilgan
 * JSON — `null` (e'tiborsiz: backend keyin yangi hodisa qo'shsa, eski FE yiqilmaydi).
 */
export const normalizeAssistantEvent = (eventName: string, data: string): AiAssistantEvent | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  const raw = asRecord(parsed);
  if (!raw) return null;
  const type = eventName && eventName !== "message" ? eventName : textOf(raw.type);
  const step = numberOf(raw.step);
  switch (type) {
    case "meta": {
      const conversationId = idOf(raw.conversation_id);
      const messageId = idOf(raw.message_id);
      if (!conversationId || !messageId) return null;
      const maxSteps = numberOf(raw.max_steps, NaN);
      return { type, conversationId, messageId, maxSteps: Number.isFinite(maxSteps) ? maxSteps : null };
    }
    case "step":
      return { type, step };
    case "delta":
      return { type, step, text: textOf(raw.text) };
    case "tool_call":
      return { type, step, id: textOf(raw.id), tool: textOf(raw.tool) };
    case "tool_result":
      return { type, step, id: textOf(raw.id), tool: textOf(raw.tool), ok: raw.ok !== false };
    case "done":
      return {
        type,
        conversationId: idOf(raw.conversation_id) ?? "",
        messageId: idOf(raw.message_id) ?? "",
        answer: textOf(raw.answer),
        stop: textOf(raw.stop) || "end_turn",
        sources: normalizeSources(raw.sources),
        limits: normalizeLimits(raw.limits),
      };
    case "error":
      return {
        type,
        code: textOf(raw.code) || "ai_error",
        message: textOf(raw.message),
        conversationId: idOf(raw.conversation_id),
        resetAt: dateOf(raw.reset_at),
      };
    default:
      return null;
  }
};
