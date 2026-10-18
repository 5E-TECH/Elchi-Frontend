export const RUNTIME_ERROR_PATH = "/runtime-error";
export const RUNTIME_ERROR_STORAGE_KEY = "elchi_runtime_error";
/**
 * Bir sahifa ketma-ket shuncha marta yiqilsa — takroriy xato: «Qayta urinish» yashiriladi, asosiy amal «Bosh
 * sahifaga qaytish» (L6q4DiGU — doimiy sababli xatoda qayta urinish o'sha sahifaga qaytarib, cheksiz halqa edi).
 */
export const RUNTIME_ERROR_RETRY_LIMIT = 2;
/** Ikki yiqilish orasi shundan uzoq bo'lsa — takroriy emas, yangi xato (hisoblagich 1 dan boshlanadi). */
export const RUNTIME_ERROR_REPEAT_WINDOW_MS = 5 * 60_000;

export interface RuntimeErrorPayload {
  message?: string;
  stack?: string;
  componentStack?: string | null;
  sourcePath?: string;
  occurredAt?: string;
  /** Shu `sourcePath` da ketma-ket nechanchi yiqilish (1 — birinchisi). `saveRuntimeError` o'zi hisoblaydi. */
  retryCount?: number;
}

const isRuntimeErrorPath = (path: string) =>
  path === RUNTIME_ERROR_PATH || path.startsWith(`${RUNTIME_ERROR_PATH}?`);

export const getCurrentAppPath = () => {
  if (typeof window === "undefined") return "/";

  const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return isRuntimeErrorPath(path) ? "/" : path;
};

/** Oldingi yozuv shu sahifaniki va yaqinda bo'lganmi (vaqti yo'q yozuv ham — takroriy). */
const isRepeatOf = (previous: RuntimeErrorPayload | null, next: RuntimeErrorPayload) => {
  if (!previous || previous.sourcePath !== next.sourcePath) return false;
  const previousAt = Date.parse(previous.occurredAt ?? "");
  if (Number.isNaN(previousAt)) return true;
  const nextAt = Date.parse(next.occurredAt ?? "");
  return (Number.isNaN(nextAt) ? Date.now() : nextAt) - previousAt <= RUNTIME_ERROR_REPEAT_WINDOW_MS;
};

/**
 * Xatoni saqlaydi. Yozuv «Qayta urinish» da o'chirilmaydi — shu sahifa yana yiqilsa `retryCount` oshadi;
 * «Bosh sahifaga qaytish» uni tozalaydi.
 */
export const saveRuntimeError = (payload: RuntimeErrorPayload) => {
  const previous = getRuntimeError();
  const retryCount = isRepeatOf(previous, payload) ? (previous?.retryCount ?? 1) + 1 : 1;
  window.sessionStorage.setItem(RUNTIME_ERROR_STORAGE_KEY, JSON.stringify({ ...payload, retryCount }));
};

export const getRuntimeError = (): RuntimeErrorPayload | null => {
  try {
    const payload = window.sessionStorage.getItem(RUNTIME_ERROR_STORAGE_KEY);
    return payload ? (JSON.parse(payload) as RuntimeErrorPayload) : null;
  } catch {
    return null;
  }
};

export const clearRuntimeError = () => {
  window.sessionStorage.removeItem(RUNTIME_ERROR_STORAGE_KEY);
};

/** Takroriy xato — qayta urinish foyda bermaydi. */
export const isRuntimeErrorRepeated = (payload?: RuntimeErrorPayload | null) =>
  (payload?.retryCount ?? 1) >= RUNTIME_ERROR_RETRY_LIMIT;

/**
 * Qisqa xato kodi (`ERR-7F3A`) — foydalanuvchi administratorga aytadi. Bir xil xato (xabar + sahifa yo'li,
 * so'rov qatorisiz) — doim bir xil kod, shuning uchun bir nechta murojaatni bitta xatoga bog'lash mumkin.
 */
export const getRuntimeErrorCode = (payload?: RuntimeErrorPayload | null) => {
  const source = `${payload?.message ?? ""}|${(payload?.sourcePath ?? "").split(/[?#]/)[0]}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 0x01000193);
  }
  return `ERR-${(hash >>> 16).toString(16).toUpperCase().padStart(4, "0")}`;
};

export const getRuntimeErrorRecoveryPath = (payload?: RuntimeErrorPayload | null) => {
  const sourcePath = payload?.sourcePath?.trim();
  return sourcePath &&
    sourcePath.startsWith("/") &&
    !sourcePath.startsWith("//") &&
    !isRuntimeErrorPath(sourcePath)
    ? sourcePath
    : "/";
};
