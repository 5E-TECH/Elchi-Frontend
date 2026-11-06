import { getBackendErrorMessage } from "./backendError";
import { getErrorStatus } from "./errorKind";

/**
 * BACKEND RAD JAVOBI (`{ statusCode, message, data: { reason, details } }`) — mashina kodi va id'lar.
 *
 * Gateway (`publicErrorData`) faqat `data.reason` (`^[a-z][a-z0-9_]{0,63}$`), `data.usage` va tekis
 * `data.details` ni o'tkazadi; har ro'yxat ko'pi bilan 50 ta element. Shuning uchun:
 *  - sabab faqat `error.response.data.data.reason` dan o'qiladi, `message` matniga tarmoqlanilmaydi
 *    (matn PR'dan PR'ga o'zgaradi — anKpzwxk, #620/#621);
 *  - id'lar avval `details.order_ids` dan (≤ 50), u bo'lmasa — `message` dagi `#123` / `№123` dan;
 *  - `message` — tayyor o'zbekcha matn, faqat noma'lum sabab uchun zaxira.
 *
 * Namuna: `entities/orders/handoverPin.ts` (`readHandoverPinError`).
 */
export type BackendRejection = {
  /** HTTP holat kodi (axios `response.status`), bo'lmasa — `null`. */
  status: number | null;
  /** Mashina kodi (`data.reason`), bo'lmasa yoki shakli noto'g'ri bo'lsa — `null`. */
  reason: string | null;
  /** Backend matni (`response.data.message` …), bo'lmasa — `null`. axios / JS xato matni emas. */
  message: string | null;
  /** `data.details` (tekis ob'ekt), bo'lmasa — `{}`. */
  details: Record<string, unknown>;
  /** Buyurtma id'lari (satr): `details.order_ids`, bo'lmasa `message` dagi `#id` / `№id`. */
  orderIds: string[];
  /** Tuman id'lari (satr): `details.district_ids`. */
  districtIds: string[];
  /** Yetishmagan viloyatlar (`details.missing`: `destination_branch_region`, `post_region`). */
  missing: string[];
};

const REASON_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const MESSAGE_ID_PATTERN = /[#№]\s?(\d+)/g;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const toIdList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item === "number" && Number.isFinite(item)) ids.push(String(item));
    else if (typeof item === "string" && item.trim()) ids.push(item.trim());
  }
  return [...new Set(ids)];
};

const toStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];

const idsFromMessage = (message: string | null): string[] => {
  if (!message) return [];
  return [...new Set(Array.from(message.matchAll(MESSAGE_ID_PATTERN), (match) => match[1]))];
};

export const readBackendRejection = (error: unknown): BackendRejection => {
  const response = asRecord(asRecord(error).response);
  const body = asRecord(response.data);
  const data = asRecord(body.data);
  const details = asRecord(data.details);
  const reason = typeof data.reason === "string" && REASON_PATTERN.test(data.reason) ? data.reason : null;
  // Faqat server javobidagi matn: axios / JS xatosining `message` i («Request failed with status code 403»)
  // foydalanuvchiga chiqmasin.
  const message = Object.keys(response).length > 0 ? (getBackendErrorMessage({ response }) ?? null) : null;
  const detailOrderIds = toIdList(details.order_ids);

  return {
    status: getErrorStatus(error) ?? null,
    reason,
    message,
    details,
    orderIds: detailOrderIds.length > 0 ? detailOrderIds : idsFromMessage(message),
    districtIds: toIdList(details.district_ids),
    missing: toStringList(details.missing),
  };
};

/** Faqat sabab kodi (`data.reason`), bo'lmasa — `null`. */
export const getBackendReason = (error: unknown): string | null => readBackendRejection(error).reason;
