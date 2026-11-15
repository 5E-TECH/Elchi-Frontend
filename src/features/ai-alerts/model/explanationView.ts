import {
  AI_ADVISOR_ERROR_CODES,
  isAlertOpen,
  readAdvisorError,
  type AiAdvisorAlertDetail,
  type AiAdvisorBudgetPeriod,
  type AiAdvisorBudgetScope,
} from "../../../entities/ai-advisor";

/**
 * AI izohining ko'rinishi (D15) — `explanation_status` + izoh so'rovi xatosi + 60 s kutish:
 *   ready       «AI izohi · vaqt» + matn (MiniMarkdown) + «AI xato qilishi mumkin …»
 *   none        «Izoh so'ralganda yoziladi — budjetdan sarflanadi.» + «AI izohini olish»
 *   pending     «AI izoh yozmoqda…» + 2 skelet qator (poll — `useExplanationPoll`)
 *   expired     60 s o'tdi, hali `pending` — «Izoh hali tayyor emas — keyinroq oching» + «Qayta urinish» (maket yo'q)
 *   budget      oylik (`advisor`) yoki kunlik umumiy (`global`, `advisor/day`) chegara — tugma o'chiq
 *   failed      `error` / `ai_disabled` — «Izoh yozib bo'lmadi.» + «Qayta urinish» (maket yo'q)
 *   disabled    POST 503 — «AI xizmati hozir o'chiq …» (holat o'zgarmaydi)
 *   request     POST boshqa xato — «Izohni so'rab bo'lmadi …» + «Qayta urinish»
 *   hidden      yopilgan ogohlantirish va izoh yo'q — blok chizilmaydi (D8: so'rash tugmasi faqat ochiqda)
 * 409 (yopilgan) — tafsilot qayta o'qiladi (mutatsiya), ko'rinish yangi holatdan.
 */
export type ExplanationView =
  | { kind: "ready"; markdown: string; at: string | null }
  | { kind: "none" | "pending" | "expired" | "failed" | "disabled" | "request" | "hidden" }
  | { kind: "budget"; scope: AiAdvisorBudgetScope; period: AiAdvisorBudgetPeriod | null; retryAt: string | null };

export const explanationView = (alert: AiAdvisorAlertDetail, requestError: unknown, expired: boolean): ExplanationView => {
  if (alert.explanation_status === "ready" && alert.explanation_md) {
    return { kind: "ready", markdown: alert.explanation_md, at: alert.explained_at };
  }
  if (!isAlertOpen(alert.status)) return { kind: "hidden" };
  if (requestError) {
    const { status, code, fields } = readAdvisorError(requestError);
    if (status === 429 || code === AI_ADVISOR_ERROR_CODES.BUDGET_EXCEEDED) {
      return { kind: "budget", scope: fields.scope ?? "advisor", period: fields.period, retryAt: fields.reset_at };
    }
    if (status === 503 || code === AI_ADVISOR_ERROR_CODES.AI_DISABLED) return { kind: "disabled" };
    if (status !== 409) return { kind: "request" };
  }
  switch (alert.explanation_status) {
    case "pending":
      return { kind: expired ? "expired" : "pending" };
    case "failed":
      return alert.explanation_error === "budget_exceeded"
        ? { kind: "budget", scope: alert.explanation_error_scope ?? "advisor", period: null, retryAt: alert.explanation_retry_at }
        : { kind: "failed" };
    default:
      return { kind: "none" };
  }
};

