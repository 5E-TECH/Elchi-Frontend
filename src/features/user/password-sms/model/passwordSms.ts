import type { PasswordMode, PasswordSms, PasswordSmsStatus } from "../../../../entities/user/types/user";

/**
 * aidsxJ2H — vaqtinchalik parol SMS'i (backend 2026-10-30, `docs/frontend/FRONTEND_CHANGELOG.md`).
 *
 * Yaratish javobi (`POST /admins|registrators|logists|couriers|managers|markets`) `data`: foydalanuvchi +
 * `password_mode` + `password_sms` (`manual` da `null`). `POST /users/:id/password/resend-sms` va
 * `GET /users/:id/password/sms-status` — `data: { user_id, must_change_password, password_sms }`. Parol hech qaysi
 * javobda YO'Q.
 */

const STATUSES: readonly PasswordSmsStatus[] = ["pending", "sent", "delivered", "failed"];

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const asString = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);

/** axios javobi (`{ data: body }`) yoki tana (`{ data: payload }`) — ichki `data` gacha ochiladi. */
const unwrapData = (response: unknown): Record<string, unknown> | null => {
  const level1 = asRecord(response);
  const body = asRecord(level1?.data) ?? level1;
  // `successRes` → `{ statusCode, message, data }`; axios → `{ data: { statusCode, data } }`.
  if (body && "statusCode" in body) return asRecord(body.data) ?? body;
  const inner = asRecord(body?.data);
  return inner && ("password_sms" in inner || "password_mode" in inner || "id" in inner || "user_id" in inner)
    ? inner
    : body;
};

/** `password_sms` obyekti → normal ko'rinish; status noma'lum yoki obyekt yo'q — `null`. */
export const readPasswordSms = (value: unknown): PasswordSms | null => {
  const record = asRecord(value);
  if (!record) return null;
  const status = record.status as PasswordSmsStatus;
  if (!STATUSES.includes(status)) return null;
  const left = Number(record.resends_left_today);
  return {
    status,
    failure_reason: asString(record.failure_reason),
    failure_message: asString(record.failure_message),
    requested_at: asString(record.requested_at),
    sent_at: asString(record.sent_at),
    delivered_at: asString(record.delivered_at),
    resend_available_at: asString(record.resend_available_at),
    resends_left_today: Number.isFinite(left) ? left : null,
  };
};

export type CreatedUser = {
  id: string | null;
  name: string | null;
  phoneNumber: string | null;
  role: string | null;
  passwordMode: PasswordMode | null;
  passwordSms: PasswordSms | null;
};

/** Yaratish javobidan yangi foydalanuvchi va parol SMS holati. */
export const readCreatedUser = (response: unknown): CreatedUser => {
  const data = unwrapData(response);
  const id = data?.id;
  const mode = data?.password_mode;
  return {
    id: typeof id === "string" || typeof id === "number" ? String(id) : null,
    name: asString(data?.name),
    phoneNumber: asString(data?.phone_number),
    role: asString(data?.role),
    passwordMode: mode === "generate_sms" || mode === "manual" ? mode : null,
    passwordSms: readPasswordSms(data?.password_sms),
  };
};

/** `resend-sms` / `sms-status` javobi → `password_sms` (+ `must_change_password`). */
export const readPasswordSmsState = (
  response: unknown,
): { passwordSms: PasswordSms | null; mustChangePassword: boolean | null } => {
  const data = unwrapData(response);
  const flag = data?.must_change_password;
  return {
    passwordSms: readPasswordSms(data?.password_sms),
    mustChangePassword: typeof flag === "boolean" ? flag : null,
  };
};

/** Yetkazildi yoki yuborilmadi — holat endi o'zgarmaydi (so'rash to'xtaydi). */
export const isFinalPasswordSmsStatus = (status: PasswordSmsStatus | null | undefined) =>
  status === "delivered" || status === "failed";

/** Backend nishon rollari (vaqtinchalik parol SMS'i beriladiganlar). FE `marketing` = backend `market`. */
const TEMP_PASSWORD_TARGET_ROLES = new Set(["admin", "registrator", "logist", "courier", "manager", "market"]);

const normalizeRole = (role: string | null | undefined) => {
  const value = (role ?? "").trim().toLowerCase();
  return value === "marketing" ? "market" : value;
};

/**
 * SMS holatini ko'rish va qayta yuborish huquqi — backend `findTempPasswordTarget` bilan AYNAN:
 * superadmin — barcha nishon rollari; admin — admin'dan boshqasi; menejer — faqat kuryer (o'zi yaratgani — natija
 * oynasida doim shunday). Boshqasi — yo'q (tugma va so'rash chizilmaydi; backend baribir 403 beradi).
 */
export const canManagePasswordSms = (viewerRole: string | null | undefined, targetRole: string | null | undefined) => {
  const viewer = normalizeRole(viewerRole);
  const target = normalizeRole(targetRole);
  if (!TEMP_PASSWORD_TARGET_ROLES.has(target)) return false;
  if (viewer === "superadmin") return true;
  if (viewer === "admin") return target !== "admin";
  if (viewer === "manager") return target === "courier";
  return false;
};

export type ResendLimit = { kind: "cooldown" | "daily"; retryAfterSeconds: number };

/**
 * 429 `PASSWORD_SMS_COOLDOWN` (60 s) / `PASSWORD_SMS_DAILY_LIMIT` (kuniga 5): `retry_after_seconds` (bo'lmasa
 * `Retry-After` sarlavhasi, bo'lmasa 60). Boshqa xato — `null`.
 */
export const readResendLimit = (error: unknown): ResendLimit | null => {
  const response = asRecord(asRecord(error)?.response);
  if (Number(response?.status) !== 429) return null;
  const data = asRecord(response?.data);
  const code = data?.code ?? asRecord(data?.data)?.code;
  const headers = asRecord(response?.headers);
  const fromBody = Number(data?.retry_after_seconds ?? asRecord(data?.data)?.retry_after_seconds);
  const fromHeader = Number(headers?.["retry-after"]);
  const seconds = Number.isFinite(fromBody) && fromBody > 0 ? fromBody : Number.isFinite(fromHeader) && fromHeader > 0 ? fromHeader : 60;
  return { kind: code === "PASSWORD_SMS_DAILY_LIMIT" ? "daily" : "cooldown", retryAfterSeconds: Math.ceil(seconds) };
};

/** ISO vaqtgacha qolgan butun soniyalar (o'tgan / noto'g'ri — 0). */
export const secondsUntil = (iso: string | null | undefined, now: number): number => {
  if (!iso) return 0;
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, Math.ceil((at - now) / 1000));
};

/** `0:48` — qayta yuborishgacha sanoq. */
export const formatCountdown = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
};

/** Ma'lum `failure_reason` kodlari (i18n kalitlari `users:v2.passwordSms.failure.<kod>`). */
export const KNOWN_FAILURE_REASONS = [
  "sms_disabled",
  "daily_cap_exceeded",
  "fanout_exceeded",
  "provider_not_configured",
  "invalid_phone",
  "template_error",
  "notification_unavailable",
  "provider_rejected",
  "provider_unavailable",
  "not_delivered",
  "staging_blocked",
  "cancelled",
  "internal_error",
] as const;

export const isKnownFailureReason = (reason: string | null | undefined): reason is (typeof KNOWN_FAILURE_REASONS)[number] =>
  Boolean(reason) && (KNOWN_FAILURE_REASONS as readonly string[]).includes(reason as string);
