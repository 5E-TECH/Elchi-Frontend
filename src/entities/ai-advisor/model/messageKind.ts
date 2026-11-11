import type { AiMessage } from "./types";

/**
 * Tarixdagi assistant qatori turi. Backend javob bera olmagan savolga ham yakuniy assistant qatorini yozadi: matni —
 * o'zbekcha xato xabari, `sources: []`, `stop` — `refused | network | limit | cap_exceeded | disabled | other …`
 * (ai-service `assistant.service.ts`). Bunday qator javob emas: «Manba», ogohlantirish va «nusxalash» siz, xira
 * izoh sifatida chiziladi.
 */
export const ANSWER_STOPS = ["end_turn", "max_steps", "truncated"] as const;

export type AiMessageKind = "user" | "answer" | "failed";

/** `stop` yo'q (eski yozuv) — javob deb olinadi. */
export const isAnswerStop = (stop: string | null | undefined) =>
  stop == null || stop === "" || (ANSWER_STOPS as readonly string[]).includes(stop);

/**
 * `truncated` ikki xil qator: javob (matn bor — oxirida «_(Javob qisqartirildi.)_») va javobsiz yakun (model matnsiz
 * kesildi — backend matn o'rniga `ERROR_MESSAGES.truncated` ni, `stop_reason: truncated` bilan yozadi;
 * ai-service `assistant.service.ts`). Backend ularni alohida `stop` bilan ajratmaguncha matn bo'yicha: bo'sh yoki
 * aynan shu xato matni — javobsiz. Boshqa har matn javob (haqiqiy javobni yashirib qo'yish xato matnini javob deb
 * ko'rsatishdan yomonroq).
 */
export const TRUNCATED_FAILURE_TEXT = "Javob juda uzun chiqdi — savolni toraytiring";

const isTruncatedFailure = (text: string | null | undefined) => {
  const value = (text ?? "").replace(/\s+/g, " ").trim();
  return value === "" || value === TRUNCATED_FAILURE_TEXT;
};

export const messageKind = (message: Pick<AiMessage, "role" | "stop" | "text">): AiMessageKind => {
  if (message.role === "user") return "user";
  if (message.stop === "truncated" && isTruncatedFailure(message.text)) return "failed";
  return isAnswerStop(message.stop) ? "answer" : "failed";
};

/**
 * Javobsiz qatorning `stop` → xato kodi (ai-service `errorCode()` bilan bir xil) — matn tilga qarab
 * (`aiAdvisor:errors.codes.*`), saqlangan o'zbekcha matn o'rniga.
 */
export const failedStopCode = (stop: string | null | undefined): string => {
  switch (stop) {
    case "refused":
    case "truncated":
    case "network":
    case "cap_exceeded":
      return stop;
    case "disabled":
      return "ai_disabled";
    case "limit":
      return "message_limit";
    default:
      return "ai_error";
  }
};
