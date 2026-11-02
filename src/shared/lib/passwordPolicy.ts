import { getBackendErrorMessage } from "./backendError";
import { getErrorStatus } from "./errorKind";

/**
 * Parol siyosati (NDmZMzCP, backend `libs/common/src/security/password-policy.ts`, 2026-10-26) — faqat YANGI parol
 * o'rnatilganda / almashtirilganda (yaratish, tahrirlash, o'z profili). Login'ga tegmaydi.
 *
 *   - ega qarori 2026-11-02: hamma rol uchun kamida 6 belgi, kamida 1 ta katta harf, 1 ta kichik harf va 1 ta raqam;
 *   - ko'pi bilan 72 bayt; boshida / oxirida bo'shliq yo'q;
 *   - oddiy parollar, bitta belgining takrori, ketma-ket raqam/harf va telefon raqamining o'zi — taqiq (bu ro'yxat
 *     serverda; mijoz uzunlik, harf/raqam va bo'shliqni tekshiradi, qolgani — server 400 matni maydon ostida).
 */
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_BYTES = 72;

export type PasswordPolicyIssue =
  | "required"
  | "tooShort"
  | "tooLong"
  | "edgeSpaces"
  | "noUpper"
  | "noLower"
  | "noDigit";

const utf8Length = (value: string) => new TextEncoder().encode(value).length;

/**
 * Mijoz tomonidagi asosiy tekshiruv: bo'sh, qisqa, 72 baytdan uzun, boshida/oxirida bo'shliq, katta harf, kichik
 * harf va raqam bormi. `null` — o'tdi
 * (oddiy / ketma-ket / telefonga teng parolni server rad etadi).
 */
export const checkPasswordPolicy = (password: string): PasswordPolicyIssue | null => {
  if (!password.trim()) return "required";
  if (password !== password.trim()) return "edgeSpaces";
  if (password.length < PASSWORD_MIN_LENGTH) return "tooShort";
  if (utf8Length(password) > PASSWORD_MAX_BYTES) return "tooLong";
  if (!/\p{Lu}/u.test(password)) return "noUpper";
  if (!/\p{Ll}/u.test(password)) return "noLower";
  if (!/\d/.test(password)) return "noDigit";
  return null;
};

/**
 * Server parolni siyosat bo'yicha rad etdi (400, xabarda «parol») — o'zbekcha matn maydon ostiga
 * («Parol kamida 6 belgidan iborat bo'lishi kerak», «Parol juda oddiy — boshqa parol tanlang»). Boshqa xato — `undefined`.
 */
export const getPasswordPolicyServerMessage = (error: unknown): string | undefined => {
  if (getErrorStatus(error) !== 400) return undefined;
  const message = getBackendErrorMessage(error);
  return message && /parol|password|пароль/i.test(message) ? message : undefined;
};
