import { getErrorStatus } from "../../../shared/lib/errorKind";

/**
 * Yuborish xatosi → foydalanuvchi matni (ega S4: faqat tushunarli matn — backend `message` ko'rsatilmaydi).
 *
 *   - javobsiz (tarmoq, vaqt tugadi) yoki 502–504 — `unknown`: xabar baribir yuborilgan bo'lishi mumkin, qayta
 *     yuborilmaydi (natija noma'lum kartasi);
 *   - qolgani — `notifications:dispatch.error.*` kaliti holat kodi bo'yicha.
 */
export type DispatchErrorKind = { kind: "unknown" } | { kind: "error"; messageKey: string };

const STATUS_KEYS: Record<number, string> = {
  400: "dispatch.error.badRequest",
  403: "dispatch.error.forbidden",
  404: "dispatch.error.notFound",
  409: "dispatch.error.conflict",
  413: "dispatch.error.badRequest",
  422: "dispatch.error.badRequest",
  429: "dispatch.error.tooMany",
};

export const classifyDispatchError = (error: unknown): DispatchErrorKind => {
  const status = getErrorStatus(error);
  if (!status || status >= 502) return { kind: "unknown" };
  return {
    kind: "error",
    messageKey: STATUS_KEYS[status] ?? (status >= 500 ? "dispatch.error.server" : "dispatch.error.generic"),
  };
};
