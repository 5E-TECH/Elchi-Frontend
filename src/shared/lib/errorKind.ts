/**
 * SO'ROV XATOSI TURI — dizayn v2 xato holatlari uchun (`ErrorState`, taxta `tizim-errors` 02).
 *
 *   server    — 5xx;
 *   timeout   — vaqt chegarasi (axios `ECONNABORTED` / `ETIMEDOUT`, 20 s; «Request aborted» emas);
 *   offline   — brauzer oflayn yoki javob umuman kelmadi (tarmoq xatosi);
 *   forbidden — 403 (xato emas: kulrang, «Qayta urinish» yo'q);
 *   section   — bitta bo'lim/tab ishdan chiqdi (faqat qo'lda beriladi);
 *   generic   — boshqa 4xx va noma'lum.
 *
 * axios'ga bog'lanmaydi (shakli bo'yicha tekshiradi) — oddiy `{ status }` ob'ekti ham bo'ladi.
 */

export type ErrorKind = "server" | "timeout" | "offline" | "forbidden" | "section" | "generic";

type ErrorLike = {
  isAxiosError?: boolean;
  code?: string;
  status?: number;
  response?: { status?: number; data?: { message?: unknown; error?: unknown } };
  request?: unknown;
  message?: unknown;
};

const asErrorLike = (error: unknown): ErrorLike | null =>
  typeof error === "object" && error !== null ? (error as ErrorLike) : null;

/** HTTP holat kodi (axios `response.status` yoki `status`); bo'lmasa — `undefined`. */
export const getErrorStatus = (error: unknown): number | undefined => {
  const e = asErrorLike(error);
  const status = e?.response?.status ?? e?.status;
  return typeof status === "number" && Number.isFinite(status) ? status : undefined;
};

/**
 * Vaqt chegarasi: `ETIMEDOUT` yoki axios `ECONNABORTED` («timeout of 20000ms exceeded», «So'rov vaqti tugadi»).
 * Brauzer yoki sahifa bekor qilgan so'rov ham `ECONNABORTED`, lekin matni «Request aborted» — u vaqt emas
 * (G6F68ti6, 12-band: «Server javob bermadi» chiqmaydi, bir marta qayta urinadi).
 */
export const isRequestTimeout = (error: unknown): boolean => {
  const e = asErrorLike(error);
  if (!e) return false;
  if (e.code === "ETIMEDOUT") return true;
  if (e.code !== "ECONNABORTED") return false;
  return !/aborted/i.test(typeof e.message === "string" ? e.message : "");
};

/** Brauzer / sahifa bekor qilgan so'rov (`ECONNABORTED` «Request aborted») — xabarsiz, qayta urinsa bo'ladi. */
export const isRequestAborted = (error: unknown): boolean =>
  asErrorLike(error)?.code === "ECONNABORTED" && !isRequestTimeout(error);

/**
 * Xato turi. Tartib: brauzer oflayn → vaqt chegarasi → bekor qilingan → javobsiz so'rov (tarmoq) → 403 →
 * 5xx → qolgani.
 * axios'ga bog'lanmaydi (shakli bo'yicha tekshiradi).
 */
export const getErrorKind = (error: unknown): ErrorKind => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  const e = asErrorLike(error);
  if (!e) return "generic";
  if (isRequestTimeout(e)) return "timeout";
  // Bekor qilingan so'rov (`AbortController`, axios `ERR_CANCELED`; brauzer «Request aborted») — javobsiz, lekin
  // internet bor.
  if (e.code === "ERR_CANCELED" || isRequestAborted(e)) return "generic";
  const status = getErrorStatus(error);
  if (status == null && (e.code === "ERR_NETWORK" || (e.isAxiosError === true && e.request != null))) return "offline";
  if (status === 403) return "forbidden";
  if (status != null && status >= 500) return "server";
  return "generic";
};

/** Backend xabari (`response.data.message` / `error`), bo'lmasa — `undefined`. */
export const getBackendMessage = (error: unknown): string | undefined => {
  const data = asErrorLike(error)?.response?.data;
  for (const value of [data?.message, data?.error]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

