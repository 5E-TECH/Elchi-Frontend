import { getErrorStatus } from "./errorKind";

/**
 * aidsxJ2H (backend 2026-10-26): o'z parolini almashtirishda (`PATCH /auth/my-profile`, o'zini `PATCH /users/:id`)
 * `password` bilan `old_password` MAJBURIY. Javob — 400 (401 EMAS: foydalanuvchi chiqarilmaydi):
 *   - `code: "OLD_PASSWORD_REQUIRED"` — «Joriy parolni kiriting»;
 *   - `code: "OLD_PASSWORD_INVALID"` — «Joriy parol noto'g'ri».
 * Yangisi joriysi bilan bir xil — kodsiz 400 («Yangi parol joriy paroldan farq qilishi kerak»), u parol siyosati
 * xatosi kabi «Yangi parol» ostiga tushadi (`getPasswordPolicyServerMessage`).
 */
export const OLD_PASSWORD_REQUIRED_CODE = "OLD_PASSWORD_REQUIRED";
export const OLD_PASSWORD_INVALID_CODE = "OLD_PASSWORD_INVALID";

export type OldPasswordErrorKind = "required" | "invalid";

const codeOf = (error: unknown): unknown => {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data as
    | { code?: unknown; data?: { code?: unknown } | null }
    | undefined;
  return data?.code ?? data?.data?.code;
};

/** 400 `OLD_PASSWORD_REQUIRED` → `"required"`, `OLD_PASSWORD_INVALID` → `"invalid"`, boshqasi — `null`. */
export const getOldPasswordErrorKind = (error: unknown): OldPasswordErrorKind | null => {
  if (getErrorStatus(error) !== 400) return null;
  const code = codeOf(error);
  if (code === OLD_PASSWORD_REQUIRED_CODE) return "required";
  if (code === OLD_PASSWORD_INVALID_CODE) return "invalid";
  return null;
};
