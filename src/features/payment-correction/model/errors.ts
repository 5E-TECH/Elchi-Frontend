import { getApiErrorCode, isUncertainWriteError } from "../../../entities/warehouse";
import {
  PAYMENT_NOT_CORRECTABLE_REASONS,
  type PaymentNotCorrectableReason,
} from "../../../entities/payments/paymentCorrection";
import { getErrorStatus } from "../../../shared/lib/errorKind";

/**
 * T6 N2 — `POST finance/history/:id/reverse` va `…/correct-amount` xatolari (backend `PAYMENT_CORRECTION_ERROR_CODES`,
 * `libs/common/src/filters/public-error-fields.ts`). Konvert: `{ statusCode, message, code, …maydonlar, trace_id }` —
 * qo'shimcha maydonlar **yuqori darajada** va faqat ro'yxatdagi kodlar uchun:
 *   NOT_CORRECTABLE → `reason`; WINDOW_EXPIRED → `deadline`, `window_days`; INSUFFICIENT_BALANCE → `required`;
 *   AMOUNT_EXCEEDS → `max` (`mapMoneyError` zaxirasida `max` siz). Qolganlari — maydonsiz.
 * Xabar matni (`message`) hech qachon solishtirilmaydi — faqat `code`.
 *
 * Natija noma'lum (`uncertain`): javob umuman kelmadi (tarmoq, vaqt tugadi, bekor) yoki 502/503/504. 504 da tuzatish
 * **bajarilgan bo'lishi mumkin** — o'sha `Idempotency-Key` va o'sha tana bilan qayta yuborilsa backend 200
 * `idempotent: true` qaytaradi; ro'yxatlar baribir yangilanadi.
 */

export const PAYMENT_CORRECTION_ERROR_CODES = [
  "NOT_FOUND",
  "NOT_CORRECTABLE",
  "LEGACY_UNLINKED",
  "ALREADY_CORRECTED",
  "WINDOW_EXPIRED",
  "SHIFT_REQUIRED",
  "BRANCH_SHIFT_REQUIRED",
  "INSUFFICIENT_BALANCE",
  "CARD_ARCHIVED",
  "SAME_AMOUNT",
  "AMOUNT_EXCEEDS",
  "IDEMPOTENCY_KEY_REUSED",
  "IDEMPOTENCY_KEY_REQUIRED",
  "COURIER_MOVED",
] as const;
export type PaymentCorrectionErrorCode = (typeof PAYMENT_CORRECTION_ERROR_CODES)[number];

export type CorrectionError = {
  /** HTTP holati; javob kelmagan bo'lsa — `undefined`. */
  status: number | undefined;
  /** Ma'lum kod; noma'lum yoki yo'q — `null` (umumiy matn). */
  code: PaymentCorrectionErrorCode | null;
  /** `NOT_CORRECTABLE` sababi; correct-amount gateway tekshiruvida (kuryer qabul qilinmaydi) — `null`. */
  reason: PaymentNotCorrectableReason | null;
  /** `WINDOW_EXPIRED`: qachongacha mumkin edi (ISO). */
  deadline: string | null;
  /** `WINDOW_EXPIRED`: amaldagi muddat (kun). */
  windowDays: number | null;
  /** `INSUFFICIENT_BALANCE`: kassada kerak bo'lgan summa (faqat `> 0` bo'lsa). */
  required: number | null;
  /** `AMOUNT_EXCEEDS`: yangi summa chegarasi. */
  max: number | null;
  /** Natija noma'lum — o'sha kalit bilan qayta yuborish xavfsiz, ro'yxat yangilanadi. */
  uncertain: boolean;
};

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Raw) : null;

const positiveNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

/**
 * So'rov xatosimi (axios: javobsiz tarmoq / vaqt / bekor qilish). Oddiy dastur xatosi (`TypeError`) — yo'q: u
 * «natija noma'lum» emas, umumiy matn.
 */
const isRequestError = (error: unknown) => {
  const value = asRecord(error);
  if (!value) return false;
  return value.isAxiosError === true || value.request != null || typeof value.code === "string";
};

/** Xato javobidan tuzatish xatosini o'qiydi (yuqori daraja, gateway o'rami `data` — zaxira). */
export const readCorrectionError = (error: unknown): CorrectionError => {
  const status = getErrorStatus(error);
  const body = asRecord(asRecord(asRecord(error)?.response)?.data);
  const nested = asRecord(body?.data);
  const field = (name: string): unknown => body?.[name] ?? nested?.[name];

  const rawCode = getApiErrorCode(error);
  const code = rawCode && (PAYMENT_CORRECTION_ERROR_CODES as readonly string[]).includes(rawCode)
    ? (rawCode as PaymentCorrectionErrorCode)
    : null;
  const rawReason = text(field("reason"))?.toLowerCase() ?? null;
  const reason =
    code === "NOT_CORRECTABLE" && rawReason && (PAYMENT_NOT_CORRECTABLE_REASONS as readonly string[]).includes(rawReason)
      ? (rawReason as PaymentNotCorrectableReason)
      : null;
  const days = positiveNumber(field("window_days"));

  return {
    status,
    code,
    reason,
    deadline: code === "WINDOW_EXPIRED" ? text(field("deadline")) : null,
    windowDays: code === "WINDOW_EXPIRED" && days !== null && Number.isInteger(days) ? days : null,
    required: code === "INSUFFICIENT_BALANCE" ? positiveNumber(field("required")) : null,
    max: code === "AMOUNT_EXCEEDS" ? positiveNumber(field("max")) : null,
    uncertain: status === undefined ? isRequestError(error) : isUncertainWriteError(error),
  };
};

/** Bu xatodan keyin ro'yxat va kassa qayta o'qiladi: natija noma'lum, allaqachon tuzatilgan yoki yozuv yo'q. */
export const correctionErrorNeedsRefresh = (info: CorrectionError) =>
  info.uncertain || info.code === "ALREADY_CORRECTED" || info.code === "NOT_FOUND";

/**
 * Kalitlar tashlanadi: kalit boshqa tana bilan ishlatilgan / yuborilmagan (hech qachon bo'lmasligi kerak) yoki to'lov
 * allaqachon tuzatilgan (oqim yopiladi). Aniq 4xx dan keyin kalitni saqlash xavfsiz (backend hech narsa yozmagan).
 */
export const correctionErrorResetsKeys = (info: CorrectionError) =>
  info.code === "IDEMPOTENCY_KEY_REUSED" || info.code === "IDEMPOTENCY_KEY_REQUIRED" || info.code === "ALREADY_CORRECTED";
