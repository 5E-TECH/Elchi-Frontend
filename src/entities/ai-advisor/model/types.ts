/**
 * AI moliyaviy yordamchi (F7PWp6cK) — backend kontrakti `libs/common/src/ai/assistant.contract.ts` (Elchi-Backend)
 * va `docs/frontend/openapi.json` (`/ai/assistant/*`). Maydon nomlari API'dagidek (snake_case) — faqat shu yerda
 * tekshirib normallashtiriladi (`api/aiAssistantApi.ts`).
 */

/** Javob manbai bo'la oladigan 10 ta faqat o'qiydigan tool (kontrakt tartibi; yangisi — oxiriga). */
export const AI_ASSISTANT_TOOL_NAMES = [
  "get_cash_position",
  "get_cashbox_history",
  "get_courier_debts",
  "get_market_payables",
  "get_branch_settlements",
  "get_shift_summaries",
  "get_expenses_by_category",
  "get_revenue_profit",
  "get_order_flow",
  "get_receipt_checks",
] as const;
export type AiAssistantToolName = (typeof AI_ASSISTANT_TOOL_NAMES)[number];

/** Backend savol chegarasi (belgi) — DTO `@MaxLength(2000)`. Maket hisoblagichi 1000 (ega qarori kutilmoqda). */
export const AI_ASSISTANT_BACKEND_MAX_CHARS = 2000;

export type AiAccessReason = "role_forbidden" | "access_disabled" | "feature_disabled" | "ai_disabled";

/** `GET ai/assistant/access/me` → `data`. */
export interface AiAccessState {
  allowed: boolean;
  reason: AiAccessReason | null;
  featureEnabled: boolean;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  /** Keyingi Toshkent yarim tuni (ISO, +05:00). */
  resetAt: string | null;
}

/** Davr — Toshkent sanalari (`YYYY-MM-DD`); `null` — joriy holat (davrsiz tool). */
export interface AiSourcePeriod {
  from: string;
  to: string;
}

/** Javobdagi manba (har tool chaqiruvi uchun). */
export interface AiSource {
  tool: string;
  period: AiSourcePeriod | null;
  records: number;
  truncated: boolean;
  ok: boolean;
}

/** `GET ai/assistant/conversations` qatori. */
export interface AiConversationSummary {
  id: string;
  title: string;
  turns: number;
  lastMessageAt: string | null;
  createdAt: string | null;
}

export interface AiConversationList {
  items: AiConversationSummary[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Suhbat xabari. Assistant qatorida `stop`: `end_turn | max_steps | truncated` — javob; boshqasi (`refused`,
 * `network`, `limit`, `cap_exceeded`, `disabled`, `other` …) — backend xato matnini javob o'rnida saqlagan
 * (`messageKind.ts`).
 */
export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string | null;
  sources: AiSource[];
  stop: string | null;
}

/** `GET ai/assistant/conversations/:id` → `data`. */
export interface AiConversation {
  id: string;
  title: string;
  turns: number;
  createdAt: string | null;
  lastMessageAt: string | null;
  messages: AiMessage[];
}

/** SSE `error.code` (kontrakt). Noma'lum kod ham kelishi mumkin — `string`. */
export type AiAssistantErrorCode =
  | "role_forbidden"
  | "access_disabled"
  | "feature_disabled"
  | "ai_disabled"
  | "daily_limit"
  | "assistant_usd_cap"
  | "cap_exceeded"
  | "busy"
  | "conversation_not_found"
  | "conversation_full"
  | "invalid_message"
  | "message_limit"
  | "refused"
  | "truncated"
  | "network"
  | "ai_error";

export interface AiLimits {
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
}

/** SSE hodisalari (`event: <type>`, `data: JSON`). Yakuniy matn — faqat `done.answer`. */
export type AiAssistantEvent =
  | { type: "meta"; conversationId: string; messageId: string; maxSteps: number | null }
  | { type: "step"; step: number }
  | { type: "delta"; step: number; text: string }
  | { type: "tool_call"; step: number; id: string; tool: string }
  | { type: "tool_result"; step: number; id: string; tool: string; ok: boolean }
  | {
      type: "done";
      conversationId: string;
      messageId: string;
      answer: string;
      stop: string;
      sources: AiSource[];
      limits: AiLimits | null;
    }
  | {
      type: "error";
      code: string;
      message: string;
      conversationId: string | null;
      resetAt: string | null;
    };
