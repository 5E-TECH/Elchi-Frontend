export type ProofAction = "sell" | "cancel";

/**
 * Market sozlamasidagi isbot shartlari bo'yicha rasm/video isbot majburmi
 * (fix3 FE-ORD-02).
 *
 * Backend `matchExpenseProofConditions` bilan AYNAN bir xil:
 *   - sotish (qisman sotish ham sotish turi): `sell_any` doim; qo'shimcha
 *     xarajat > 0 bo'lsa `sell_extra_cost`; amal summasi 0 bo'lsa
 *     `sell_zero_total` (qisman sotishda — yangi, qisman summa);
 *   - bekor qilish: `cancel_any`; xarajat > 0 → `cancel_extra_cost`;
 *     buyurtma summasi 0 → `cancel_zero_total`.
 *
 * Ilgari oyna faqat `*_any` ni tekshirardi: market `sell_extra_cost` ni
 * yoqqan bo'lsa kuryer isbotsiz yuborardi va backend 400 "isbot majburiy"
 * qaytarardi — ekranda esa hech narsa ko'rinmasdi.
 *
 * `totalPrice: null` — summa hali noma'lum (qisman sotishda kiritilmagan):
 * 0-summa sharti tekshirilmaydi, aks holda "isbot kerak" degan noto'g'ri
 * matn "summani kiriting" o'rniga chiqardi.
 */
export const isProofRequiredByConditions = (
  conditions: readonly string[] | null | undefined,
  params: { action: ProofAction; extraCost: number; totalPrice: number | null },
): boolean => {
  const enabled = Array.isArray(conditions) ? conditions : [];
  if (enabled.length === 0) return false;

  const { action, extraCost, totalPrice } = params;
  if (enabled.includes(`${action}_any`)) return true;
  if (extraCost > 0 && enabled.includes(`${action}_extra_cost`)) return true;
  if (totalPrice !== null && !(totalPrice > 0) && enabled.includes(`${action}_zero_total`)) {
    return true;
  }

  return false;
};

/** Ro'yxatdan kelgan summa — son bo'lmasa `null` (noma'lum, taxmin qilinmaydi). */
export const toKnownAmount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
};
