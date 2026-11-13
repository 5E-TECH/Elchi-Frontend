import { PASSWORD_CHANGE_REQUIRED_CODE, responseErrorCode } from "../../../auth/passwordChange";

/**
 * Xato → ko'rinish (maketlar `superadmin-ai-assistant-unavailable` «Boshqa holatlar», `-offline`, `-limit-reached`).
 * Toza funksiyalar: holat mashinasi (`useAiChat`) shu qarorni bajaradi.
 *
 * Backend 403 / 429 / 503 tanasida hozircha `code` YO'Q (gateway filtri AI kodlarini o'tkazmaydi —
 * `public-error-fields.ts`), shuning uchun oqim ochilmagan xato HTTP holati bo'yicha tanlanadi, 429 / 503 dan keyin
 * esa `access/me` qayta so'raladi (kunlik limitmi yoki gateway IP cheklovimi, funksiya o'chganmi).
 */

/** Javob o'rnidagi xato qutisi. Matnlar — `aiAdvisor` kalitlari (`description` — kalit yoki tayyor matn emas). */
export interface TurnErrorView {
  /** `failed` — javob olinmadi; `cut` — oqim uzildi (qisman matn qoladi); `cap` — xarajat shifti; `conversation` — suhbat. */
  variant: "failed" | "cut" | "cap" | "conversation";
  tone: "danger" | "warning";
  titleKey: string;
  descriptionKey: string;
  /** «Qayta yuborish» (yangi savol — limitdan yana bittasi). */
  canRetry: boolean;
  /** «Yangi suhbat» amali (suhbat to'lgan / topilmadi). */
  newChat: boolean;
  /** Xarajat shifti tugashi (Toshkent yarim tuni, ISO) — kiritish shu vaqtgacha o'chiq. */
  resetAt: string | null;
}

export type ChatFailure =
  /** Javob o'rnida xato qutisi (savol bubble'i qoladi). */
  | { action: "turn"; view: TurnErrorView }
  /** Savol bubble'i olinadi, matn maydonga qaytadi, xabar (`notify.warning`). */
  | { action: "notify"; titleKey: string; descriptionKey?: string; values?: Record<string, unknown> }
  /** Matn maydonga qaytadi, maydon ostida xato (400 / `invalid_message`). */
  | { action: "field"; messageKey: string }
  /** Holat `access/me` dan (limit tugagan, AI o'chiq): savol olinadi, matn maydonga qaytadi, `access/me` qayta so'raladi. */
  | { action: "access" }
  /** Sessiya / parol oynasi global hal qiladi — savol olinadi, matn qaytadi, xabarsiz. */
  | { action: "silent" };

const KNOWN_CODES = new Set([
  "role_forbidden",
  "access_disabled",
  "feature_disabled",
  "ai_disabled",
  "daily_limit",
  "assistant_usd_cap",
  "cap_exceeded",
  "busy",
  "conversation_not_found",
  "conversation_full",
  "invalid_message",
  "message_limit",
  "refused",
  "truncated",
  "network",
  "ai_error",
]);

const failedView = (afterMeta: boolean, code?: string): TurnErrorView => ({
  variant: "failed",
  tone: "danger",
  titleKey: "errors.answerFailed",
  // `meta` dan oldin savol saqlanmagan; keyin — saqlangan (limitdan ketgan), sababi kod bo'yicha.
  descriptionKey: afterMeta ? `errors.codes.${code && KNOWN_CODES.has(code) ? code : "ai_error"}` : "errors.notSaved",
  canRetry: true,
  newChat: false,
  resetAt: null,
});


/** Oqim o'rtada uzildi (`meta` dan keyin): qisman matn + «Aloqa uzildi». */
export const CUT_VIEW: TurnErrorView = {
  variant: "cut",
  tone: "danger",
  titleKey: "errors.cutTitle",
  descriptionKey: "errors.cutText",
  canRetry: true,
  newChat: false,
  resetAt: null,
};

/** SSE `error` hodisasi. */
export const classifyStreamError = (
  { code, resetAt }: { code: string; resetAt?: string | null },
  afterMeta: boolean,
): ChatFailure => {
  switch (code) {
    case "busy":
      return { action: "notify", titleKey: "errors.codes.busy" };
    case "invalid_message":
      return { action: "field", messageKey: "errors.codes.invalid_message" };
    case "daily_limit":
      return { action: "access" };
    case "feature_disabled":
    case "ai_disabled":
      return afterMeta ? { action: "turn", view: failedView(true, code) } : { action: "access" };
    case "assistant_usd_cap":
    case "cap_exceeded":
      return {
        action: "turn",
        view: {
          variant: "cap",
          tone: "warning",
          titleKey: `errors.codes.${code}`,
          descriptionKey: "errors.capText",
          canRetry: false,
          newChat: false,
          resetAt: resetAt ?? null,
        },
      };
    case "conversation_full":
    case "conversation_not_found":
      return {
        action: "turn",
        view: {
          variant: "conversation",
          tone: "warning",
          titleKey: `errors.codes.${code}`,
          // Savol `meta` gacha rad etildi (saqlanmagan) — «Yangi suhbat» uni yangi suhbatning maydoniga olib o'tadi.
          descriptionKey: "errors.notSavedNewChat",
          canRetry: false,
          newChat: true,
          resetAt: null,
        },
      };
    case "network":
      return { action: "turn", view: afterMeta ? CUT_VIEW : failedView(false) };
    default:
      return { action: "turn", view: failedView(afterMeta, code) };
  }
};

/**
 * Oqim ochilmadi (HTTP xato). 429 va 503 — `access/me` qayta so'ralgach `classifyAfterAccess` hal qiladi
 * (`needsAccessCheck`).
 */
export const classifyHttpFailure = (status: number, body: unknown): ChatFailure | { action: "check-access" } => {
  if (status === 400) return { action: "field", messageKey: "errors.codes.invalid_message" };
  if (status === 401) return { action: "silent" };
  if (status === 403) {
    if (responseErrorCode(body) === PASSWORD_CHANGE_REQUIRED_CODE) return { action: "silent" };
    return {
      action: "turn",
      view: { ...failedView(false), descriptionKey: "errors.codes.role_forbidden", canRetry: false },
    };
  }
  if (status === 429 || status === 503) return { action: "check-access" };
  return { action: "turn", view: failedView(false) };
};

/**
 * 429 / 503 dan keyin yangi `access/me` bilan: limit tugagan yoki AI o'chiq — sahifa holati (`access`); aks holda
 * 429 — gateway IP cheklovi («Juda ko'p so'rov», `Retry-After`), 503 — javob olinmadi.
 */
export const classifyAfterAccess = (
  status: number,
  access: { allowed: boolean; reason: string | null; remainingToday: number } | null,
  retryAfter: number | null,
): ChatFailure => {
  if (access && (access.remainingToday <= 0 || access.reason === "feature_disabled" || access.reason === "ai_disabled")) {
    return { action: "access" };
  }
  if (status === 429) {
    return retryAfter && retryAfter > 0
      ? { action: "notify", titleKey: "errors.throttled", descriptionKey: "errors.throttledIn", values: { count: retryAfter } }
      : { action: "notify", titleKey: "errors.throttled", descriptionKey: "errors.throttledLater" };
  }
  return { action: "turn", view: failedView(false) };
};

/** Tarmoq xatosi yoki oqim yakuniy hodisasiz yopildi. */
export const classifyNetworkFailure = (afterMeta: boolean): ChatFailure => ({
  action: "turn",
  view: afterMeta ? CUT_VIEW : failedView(false),
});
