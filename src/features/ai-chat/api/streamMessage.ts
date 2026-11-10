import { authFetch, isAbortError, noteFetchNetworkFailure } from "../../../auth/authFetch";
import { API_ENDPOINTS } from "../../../shared/api/endpoints";
import { normalizeAssistantEvent, type AiAssistantEvent } from "../../../entities/ai-advisor";
import { createSseParser } from "../lib/sseParser";

/**
 * `POST ai/assistant/messages` → SSE. Natija turlari (chaqiruvchi holat mashinasi uchun):
 *
 *   - `ended`   — oqim yopildi; `terminal` — oxirgi `done` / `error` hodisasi (yo'q — oqim yarim uzilgan);
 *   - `http`    — oqim ochilmadi: 400 (DTO), 403, 429 (kunlik limit YOKI gateway IP cheklovi), 503, 5xx …
 *                 (`body` — JSON yoki `null`, `retryAfter` — `Retry-After` soniyalari);
 *   - `network` — javob kelmadi yoki oqim o'rtada uzildi (`TypeError`);
 *   - `aborted` — «To'xtatish» / sahifadan chiqish (`AbortController`).
 *
 * Hodisalar `onEvent` ga kelish tartibida beriladi (`meta` → `step`/`delta`/`tool_*` → `done` | `error`).
 */
export type StreamOutcome =
  | { kind: "ended"; terminal: "done" | "error" | null }
  | { kind: "http"; status: number; body: unknown; retryAfter: number | null }
  | { kind: "network"; error: unknown }
  | { kind: "aborted" };

export interface StreamMessageInput {
  message: string;
  conversationId?: string | null;
}

export interface StreamMessageOptions {
  signal?: AbortSignal;
  onEvent: (event: AiAssistantEvent) => void;
}

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

/** `Retry-After`: soniyalar yoki HTTP sana → soniya (yo'q / noto'g'ri — `null`). */
export const parseRetryAfter = (value: string | null, now = Date.now()): number | null => {
  if (!value) return null;
  const seconds = Number(value.trim());
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.max(0, Math.ceil((at - now) / 1000)) : null;
};

export const streamAssistantMessage = async (
  { message, conversationId }: StreamMessageInput,
  { signal, onEvent }: StreamMessageOptions,
): Promise<StreamOutcome> => {
  let response: Response;
  try {
    response = await authFetch(API_ENDPOINTS.AI_ASSISTANT.MESSAGES, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(conversationId ? { message, conversation_id: conversationId } : { message }),
      signal,
    });
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) return { kind: "aborted" };
    return { kind: "network", error };
  }

  if (!response.ok || !response.body) {
    return {
      kind: "http",
      status: response.status,
      body: await readJson(response),
      retryAfter: parseRetryAfter(response.headers.get("Retry-After")),
    };
  }

  const parser = createSseParser();
  const reader = response.body.getReader();
  let terminal: "done" | "error" | null = null;

  const emit = (messages: ReturnType<typeof parser.push>) => {
    for (const item of messages) {
      const event = normalizeAssistantEvent(item.event, item.data);
      if (!event) continue;
      if (event.type === "done" || event.type === "error") terminal = event.type;
      onEvent(event);
    }
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) emit(parser.push(value));
      // Yakuniy hodisadan keyin oqim ochiq qolsa ham kutilmaydi (gateway `end()` qiladi, lekin proksi ushlab qolishi mumkin).
      if (terminal) break;
    }
    if (!terminal) emit(parser.flush());
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) return { kind: "aborted" };
    noteFetchNetworkFailure(error);
    return { kind: "network", error };
  } finally {
    if (terminal) void reader.cancel().catch(() => undefined);
  }

  return { kind: "ended", terminal };
};
