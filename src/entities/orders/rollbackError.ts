import { getBackendErrorMessage } from "../../shared/lib/backendError";
import { ROLLBACK_CODES } from "./rollbackEligibility";

/**
 * QAYTARISH XATOSI turlari (BE #738) — oyna xatoni ichida ko'rsatadi va qayta urinish yo'lini tanlaydi:
 *  - `state_changed` — 400 `STATE_CHANGED`: qaror va tranzaksiya orasida to'lov / holat o'zgardi; «Qayta urinish»
 *    avval buyurtmani qayta o'qiydi (yangi ruxsat), so'ng ayni kalit bilan yuboradi;
 *  - `unavailable` — 503: tashqi xizmat javob bermadi, pul ko'chmagan; qayta urinish mumkin;
 *  - `in_progress` — 409 `IDEMPOTENCY_IN_PROGRESS`: ayni kalitli so'rov hali bajarilmoqda — kutib, ayni kalit bilan;
 *  - `key_mismatch` — 422 `IDEMPOTENCY_KEY_MISMATCH`: kalit boshqa tanaga bog'langan — yangi kalit bilan qayta;
 *  - `no_response` — javob kelmadi (tarmoq, vaqt tugadi) yoki 502 / 504: rollback bajarilgan bo'lishi MUMKIN — ayni
 *    kalit bilan qayta urinish xavfsiz (bajarilgan bo'lsa saqlangan natija qaytadi);
 *  - `rejected` — boshqa 400 / 403 (`SUPERADMIN_ONLY`, `PARCEL_NOT_IN_BRANCH`, `CORRECTION_REQUIRED` …): qaror aniq,
 *    qayta urinish ma'nosiz — server matni ko'rsatiladi.
 */
export type RollbackErrorKind = "state_changed" | "unavailable" | "in_progress" | "key_mismatch" | "no_response" | "rejected";

export type RollbackErrorInfo = {
  kind: RollbackErrorKind;
  /** HTTP holati (javob kelmagan bo'lsa `null`). */
  status: number | null;
  /** Backend kodi (`code` — tana yoki `data.code`). */
  code: string | null;
  /** Backend matni (axios / kutubxona matni emas). */
  serverMessage: string | null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

/** Xato tanasidagi `code` (`{ code }` yoki `{ data: { code } }`). */
export const getRollbackErrorCode = (error: unknown): string | null => {
  const data = asRecord(asRecord(asRecord(error).response).data);
  const code = data.code ?? asRecord(data.data).code;
  return typeof code === "string" && code.trim() ? code.trim() : null;
};

export const classifyRollbackError = (error: unknown): RollbackErrorInfo => {
  const response = asRecord(error).response;
  const status = response && typeof response === "object" ? Number(asRecord(response).status) || null : null;
  const code = getRollbackErrorCode(error);
  const serverMessage = status === null ? null : (getBackendErrorMessage({ response }) ?? null);
  const info = (kind: RollbackErrorKind): RollbackErrorInfo => ({ kind, status, code, serverMessage });

  if (status === null) return info("no_response");
  if (code === ROLLBACK_CODES.STATE_CHANGED) return info("state_changed");
  if (status === 409) return info("in_progress");
  if (status === 422) return info("key_mismatch");
  if (status === 503) return info("unavailable");
  // 502 / 504 va boshqa 5xx — natija noma'lum (gateway kutib tura olmadi yoki ichki xato): ayni kalit bilan qayta.
  if (status >= 500) return info("no_response");
  return info("rejected");
};

/** Shu xatodan keyin «Qayta urinish» ma'nolimi (`rejected` dan boshqa hammasi). */
export const isRetryableRollbackError = (kind: RollbackErrorKind) => kind !== "rejected";
