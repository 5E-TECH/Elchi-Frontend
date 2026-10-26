import { getBackendErrorMessage } from "./backendError";
import { getErrorStatus } from "./errorKind";

/**
 * Parol siyosati (NDmZMzCP, backend `libs/common/src/security/password-policy.ts`, 2026-10-26) — faqat YANGI parol
 * o'rnatilganda / almashtirilganda (yaratish, tahrirlash, o'z profili). Login'ga tegmaydi.
 *
 *   - kamida 8 belgi; xodimlar (`STAFF_PASSWORD_ROLES`) — kamida 10;
 *   - ko'pi bilan 72 bayt; boshida / oxirida bo'shliq yo'q;
 *   - oddiy parollar, bitta belgining takrori, ketma-ket raqam/harf va telefon raqamining o'zi — taqiq (bu ro'yxat
 *     serverda; mijoz faqat uzunlik va bo'shliqni tekshiradi, qolgani — server 400 matni maydon ostida).
 */
export const PASSWORD_MIN_LENGTH = 8;
export const STAFF_PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_BYTES = 72;

/** Xodim rollari (backend `STAFF_PASSWORD_ROLES`). Market, market operatori, mijoz, investor — 8. */
export const STAFF_PASSWORD_ROLES: readonly string[] = [
  "superadmin",
  "admin",
  "manager",
  "registrator",
  "operator",
  "logist",
  "branch",
  "courier",
];

/** Rol uchun minimal uzunlik (rol noma'lum — 8, serverdagi kabi). */
export const passwordMinLength = (role?: string | null): number =>
  role && STAFF_PASSWORD_ROLES.includes(role.trim().toLowerCase()) ? STAFF_PASSWORD_MIN_LENGTH : PASSWORD_MIN_LENGTH;

export type PasswordPolicyIssue = "required" | "tooShort" | "tooLong" | "edgeSpaces";

const utf8Length = (value: string) => new TextEncoder().encode(value).length;

/**
 * Mijoz tomonidagi asosiy tekshiruv: bo'sh, qisqa, 72 baytdan uzun, boshida/oxirida bo'shliq. `null` — o'tdi
 * (oddiy / ketma-ket / telefonga teng parolni server rad etadi).
 */
export const checkPasswordPolicy = (password: string, role?: string | null): PasswordPolicyIssue | null => {
  if (!password.trim()) return "required";
  if (password !== password.trim()) return "edgeSpaces";
  if (password.length < passwordMinLength(role)) return "tooShort";
  if (utf8Length(password) > PASSWORD_MAX_BYTES) return "tooLong";
  return null;
};

/**
 * Server parolni siyosat bo'yicha rad etdi (400, xabarda «parol») — o'zbekcha matn maydon ostiga
 * («Parol kamida 10 belgidan iborat bo'lishi kerak», «Parol juda oddiy — boshqa parol tanlang»). Boshqa xato — `undefined`.
 */
export const getPasswordPolicyServerMessage = (error: unknown): string | undefined => {
  if (getErrorStatus(error) !== 400) return undefined;
  const message = getBackendErrorMessage(error);
  return message && /parol|password|пароль/i.test(message) ? message : undefined;
};
