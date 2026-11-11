import { getBackendErrorMessage } from "./backendError";
import { getErrorStatus } from "./errorKind";

/**
 * 403 va backend faqat umumiy inglizcha «Forbidden resource» (NestJS `RolesGuard` sukuti) qaytargan — foydalanuvchiga
 * o'zbekcha tushunarli matn kerak (masalan menejerga yangi ochilgan amal backend ochilguncha). Backendning aniq sababi
 * bo'lsa (o'zbekcha matn) — `false`: o'sha matn ko'rsatiladi.
 */
export const isGenericForbiddenError = (error: unknown): boolean => {
  if (getErrorStatus(error) !== 403) return false;
  const message = getBackendErrorMessage(error);
  return !message || /^forbidden( resource)?\.?$/i.test(message.trim());
};
