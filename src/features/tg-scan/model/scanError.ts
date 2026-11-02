// dizayn-v2: courier-scan-other-courier
import { getBackendMessage, getErrorKind, getErrorStatus } from "../../../shared/lib/errorKind";

/**
 * Mini App so'rovi xatosining turi:
 *   session — 401 (JWT 30 daqiqada tugadi yoki imzo noto'g'ri): sahifa «Mini App'ni qayta oching» deydi;
 *   offline / timeout — javob kelmadi;
 *   message — backend xabari (boshqa filial, boshqa kuryerniki, noto'g'ri holat, topilmadi …) — aynan
 *             shu matn ko'rsatiladi;
 *   unknown — xabarsiz xato (5xx va h.k.).
 */
export type TgScanErrorInfo =
  | { kind: "session"; message: string | null }
  | { kind: "offline" | "timeout" | "unknown"; message: null }
  | { kind: "message"; message: string };

export const describeTgScanError = (error: unknown): TgScanErrorInfo => {
  const status = getErrorStatus(error);
  const message = getBackendMessage(error) ?? null;
  if (status === 401) return { kind: "session", message };
  const kind = getErrorKind(error);
  if (kind === "offline" || kind === "timeout") return { kind, message: null };
  if (status != null && status < 500 && message) return { kind: "message", message };
  return { kind: "unknown", message: null };
};

/** BOT-2: Mini App kirishi faqat kuryerga — boshqa rol `POST /auth/telegram` da 403 `TELEGRAM_COURIER_ONLY`. */
export const TELEGRAM_COURIER_ONLY_CODE = "TELEGRAM_COURIER_ONLY";

export const isTelegramCourierOnlyError = (error: unknown): boolean => {
  if (getErrorStatus(error) !== 403) return false;
  const data = (error as { response?: { data?: { code?: unknown; data?: { code?: unknown } | null } } } | null)
    ?.response?.data;
  return (data?.code ?? data?.data?.code) === TELEGRAM_COURIER_ONLY_CODE;
};
