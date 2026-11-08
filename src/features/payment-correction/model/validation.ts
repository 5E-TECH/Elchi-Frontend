/**
 * T6 N2 — «Qaytarish» va «Summani tahrirlash» formalarining tekshiruvi (backend bilan bir xil).
 *
 * Sabab: gateway xom satrni `@Length(5,500)` bilan, finance esa **trim** dan keyin 5…500 ni tekshiradi
 * (`payment-correction.service.ts`). Shuning uchun FE trim qilingan uzunlikni tekshiradi va trim qilinganini yuboradi;
 * hisoblagich xom uzunlikni ko'rsatadi, maydonda `maxLength={500}`. Ikki hisob farq qiladi: gateway (validator.js
 * `isLength`) surrogat juftni (emoji) va ko'rinish selektorini (U+FE0E/U+FE0F) bitta belgi deb sanaydi, finance —
 * UTF-16 birliklarida. Shuning uchun quyi chegara `isLength` bo'yicha (uchta emoji — 6 birlik, lekin 3 belgi: gateway uni
 * kodsiz 400 bilan rad etardi), yuqori chegara — UTF-16 birliklarida (finance qat'iyroq).
 *
 * Yangi summa: `> 0`, ko'pi bilan 2 kasr (so'm butun — `TextInput mode="money"`), joriy summadan farqli. Chegara
 * (`max`) oldindan ma'lum emas — faqat `AMOUNT_EXCEEDS` javobida keladi; shundan keyin qiymat o'zgarmaguncha (yoki
 * `max` dan katta bo'lsa) «Davom etish» o'chiq (maket `superadmin-payments-history-correct-amount-errors`).
 */

export const CORRECTION_REASON_LIMITS = { min: 5, max: 500 } as const;

/** `empty` — hali yozilmagan; `short` — trim dan keyin 1–4 belgi; `long` — 500 dan ko'p (maxLength bo'lsa bo'lmaydi). */
export type CorrectionReasonState = "empty" | "short" | "valid" | "long";

/** validator.js `isLength` hisobi (gateway `@Length`): surrogat juft va U+FE0E/U+FE0F ayirib tashlanadi. */
const gatewayLength = (value: string) =>
  value.length - (value.match(/[\uFE0E\uFE0F]/g)?.length ?? 0) - (value.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g)?.length ?? 0);

export const correctionReasonState = (raw: string | null | undefined): CorrectionReasonState => {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length === 0) return "empty";
  if (gatewayLength(trimmed) < CORRECTION_REASON_LIMITS.min) return "short";
  if (trimmed.length > CORRECTION_REASON_LIMITS.max) return "long";
  return "valid";
};

export const isValidCorrectionReason = (raw: string | null | undefined) => correctionReasonState(raw) === "valid";

/** Yuboriladigan sabab — trim qilingan (backend shuni saqlaydi va idempotentlik izida shuni solishtiradi). */
export const normalizeCorrectionReason = (raw: string | null | undefined) => (raw ?? "").trim();

/** Serverning rad javobi (forma holatida saqlanadi — «Orqaga» dan keyin maydon xatosi). */
export type CorrectionAmountRejection = {
  code: "AMOUNT_EXCEEDS" | "SAME_AMOUNT";
  /** Rad etilgan yangi summa. */
  amount: number;
  /** `AMOUNT_EXCEEDS` dagi chegara; `mapMoneyError` zaxirasida kelmaydi — `null`. */
  max: number | null;
};

/**
 * `empty` — kiritilmagan; `zero` — 0 yoki manfiy («0 dan katta summa kiriting»); `same` — joriy summa bilan bir xil
 * (yoki server `SAME_AMOUNT` degan qiymat); `exceeds` — server `AMOUNT_EXCEEDS` degan qiymat yoki undan katta;
 * `valid` — «Davom etish» faol (sabab ham to'g'ri bo'lsa).
 */
export type CorrectionAmountState = "empty" | "zero" | "same" | "exceeds" | "valid";

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Maydon qiymati → son (`TextInput mode="money"` raqamlarni satr qilib beradi; bo'sh — `null`). */
export const parseCorrectionAmount = (value: unknown): number | null => {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  if (typeof value === "string" && value.replace(/\s/g, "") === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[\s\u00a0]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

export const correctionAmountState = (
  value: unknown,
  current: number,
  rejection?: CorrectionAmountRejection | null,
): CorrectionAmountState => {
  const amount = parseCorrectionAmount(value);
  if (amount === null) return "empty";
  if (amount <= 0) return "zero";
  if (round2(amount) === round2(current)) return "same";
  if (rejection) {
    if (round2(amount) === round2(rejection.amount)) return rejection.code === "SAME_AMOUNT" ? "same" : "exceeds";
    if (rejection.code === "AMOUNT_EXCEEDS" && rejection.max !== null && amount > rejection.max) return "exceeds";
  }
  return "valid";
};

/** «Farq» = yangi − joriy (so'm; `formatSignedMoneyLocalized` bilan, rangsiz). */
export const correctionAmountDiff = (next: number, current: number) => round2(next - current);
