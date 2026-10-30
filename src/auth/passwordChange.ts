import { useSyncExternalStore } from "react";
import tokenStorage from "./tokenStorage";

/**
 * «Yangi parol o'rnating» (NDmZMzCP): backend `POST /auth/login`, `/auth/refresh`, `/auth/otp/verify` javobida
 * `must_change_password: true` — mavjud parol yangi siyosatga mos emas (kirish baribir muvaffaqiyatli). Ilova
 * bloklanmaydi (gateway darvozasi `PASSWORD_CHANGE_GATE` prod'da o'chiq): faqat oyna taklif qiladi, «Keyinroq»
 * bilan shu tab sessiyasi davomida yopiladi. Darvoza yoqilsa — `403 PASSWORD_CHANGE_REQUIRED` oynani qayta ochadi.
 *
 * MAJBURIY rejim (aidsxJ2H): parolni admin / tizim bergan (yaratishda `generate_sms` yoki `manual` +
 * `must_change_password`, SMS'ni qayta yuborish) — token'da `pwd_forced: true`, gateway parol almashtirilmaguncha
 * boshqa har API'ni 403 `PASSWORD_CHANGE_REQUIRED` qiladi. Shunda oyna BLOKLOVCHI: «Keyinroq» yo'q, Esc / fon
 * yopmaydi (faqat «Chiqish»). `403 PASSWORD_CHANGE_REQUIRED` ham majburiy rejimni yoqadi (darvoza shu
 * foydalanuvchiga ishlayapti — boshqa sahifa baribir ochilmaydi). Zaif eski parol bayrog'i (faqat `pwd_change`) —
 * avvalgidek bloklamaydi.
 *
 * Holat — modul darajasida (axios interceptor va authService React'dan tashqarida yozadi); komponent
 * `usePasswordChangePrompt` bilan o'qiydi.
 */
export const PASSWORD_CHANGE_REQUIRED_CODE = "PASSWORD_CHANGE_REQUIRED";
const DISMISSED_KEY = "elchi_pwd_change_dismissed";

let required = false;
/** aidsxJ2H: majburiy (bloklovchi) rejim — `pwd_forced` token yoki 403 `PASSWORD_CHANGE_REQUIRED`. */
let forced = false;
let dismissed = readDismissed();
const listeners = new Set<() => void>();

function readDismissed() {
  try {
    return typeof window !== "undefined" && window.sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

const writeDismissed = (value: boolean) => {
  dismissed = value;
  try {
    if (typeof window === "undefined") return;
    if (value) window.sessionStorage.setItem(DISMISSED_KEY, "1");
    else window.sessionStorage.removeItem(DISMISSED_KEY);
  } catch {
    // Saqlash yopiq (maxfiy oyna) — xotiradagi qiymat yetadi.
  }
};

const emit = () => listeners.forEach((listener) => listener());

/**
 * Javobdagi `must_change_password` — faqat boolean bo'lsa (eski backend maydonni bermaydi — holat o'zgarmaydi).
 * Majburiy rejim — javobdagi `accessToken` ning `pwd_forced` claim'idan (yoki avvalgi 403 dan — bayroq turguncha).
 */
export const syncPasswordChangeFlag = (payload: unknown) => {
  const record = payload as { must_change_password?: unknown; accessToken?: unknown } | null | undefined;
  const value = record?.must_change_password;
  if (typeof value !== "boolean") return;
  const tokenForced = typeof record?.accessToken === "string" && tokenStorage.isPasswordChangeForced(record.accessToken);
  const nextForced = value && (tokenForced || forced);
  if (value === required && nextForced === forced) return;
  required = value;
  forced = nextForced;
  if (!value) writeDismissed(false);
  emit();
};

/**
 * `403 PASSWORD_CHANGE_REQUIRED`: darvoza shu foydalanuvchiga ishlayapti — oyna majburiy rejimda ochiladi
 * («Keyinroq» bosilgan bo'lsa ham).
 */
export const requirePasswordChange = () => {
  if (required && forced) return;
  required = true;
  forced = true;
  writeDismissed(false);
  emit();
};

/** «Keyinroq» — shu tab sessiyasida qayta chiqmaydi (keyingi kirishda yana). Majburiy rejimda ishlamaydi. */
export const dismissPasswordChangePrompt = () => {
  if (dismissed || forced) return;
  writeDismissed(true);
  emit();
};

/** Parol almashtirildi yoki chiqildi — bayroq tozalanadi. */
export const clearPasswordChangeFlag = () => {
  const changed = required || forced || dismissed;
  required = false;
  forced = false;
  writeDismissed(false);
  if (changed) emit();
};

export const isPasswordChangePromptOpen = () => required && (forced || !dismissed);

/** aidsxJ2H: oyna bloklovchimi (`pwd_forced` yoki 403 `PASSWORD_CHANGE_REQUIRED`). */
export const isPasswordChangeForced = () => required && forced;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const usePasswordChangePrompt = () =>
  useSyncExternalStore(subscribe, isPasswordChangePromptOpen, isPasswordChangePromptOpen);

export const usePasswordChangeForced = () =>
  useSyncExternalStore(subscribe, isPasswordChangeForced, isPasswordChangeForced);

/** `response.data` dagi `code` (`{ code }` yoki `{ data: { code } }`). */
export const responseErrorCode = (data: unknown): string | undefined => {
  if (!data || typeof data !== "object") return undefined;
  const record = data as { code?: unknown; data?: { code?: unknown } | null };
  const code = record.code ?? record.data?.code;
  return typeof code === "string" ? code : undefined;
};
