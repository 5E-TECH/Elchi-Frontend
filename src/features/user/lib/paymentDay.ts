import type { SelectOption } from "../../../shared/ui/primitives";

/**
 * XODIMNING «TO'LOV KUNI» (oylik maosh kuni) — 1 … 30.
 *
 * Ega qarori (2026-10-16): butun oylik kalendar o'rniga 1–30 kunlar ro'yxati (`Select`). Forma qiymati
 * avvalgidek satr («5», bo'sh — «»), API'ga avvalgidek `payment_day: Number(qiymat)` bo'lib ketadi
 * (`CreateUserForm`, `UpdateUserModal`). Saqlangan 31, 0, kasr yoki noto'g'ri qiymat ro'yxatda yo'q — maydon
 * bo'sh ko'rinadi, foydalanuvchi to'g'ri kunni tanlaydi (forma tekshiruvi 1–30 ni talab qiladi).
 */
export const PAYMENT_DAY_MIN = 1;
export const PAYMENT_DAY_MAX = 30;

/** «1» … «30» — qiymat va nom bir xil (forma qiymati satr). */
export const PAYMENT_DAY_OPTIONS: ReadonlyArray<SelectOption> = Array.from(
  { length: PAYMENT_DAY_MAX - PAYMENT_DAY_MIN + 1 },
  (_, index) => {
    const value = String(PAYMENT_DAY_MIN + index);
    return { value, label: value };
  },
);

/**
 * Forma / API qiymati → ro'yxatdagi qiymat: «5», 5, «05» → «5»; 31, 0, «15.5», «abc», bo'sh → `null`
 * (maydon bo'sh ko'rinadi, xato bermaydi).
 */
export const toPaymentDayOption = (raw: string | number | null | undefined): string | null => {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) return null;
  const day = Number(text);
  return day >= PAYMENT_DAY_MIN && day <= PAYMENT_DAY_MAX ? String(day) : null;
};
