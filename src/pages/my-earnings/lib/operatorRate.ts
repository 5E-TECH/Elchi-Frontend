import { COMMISSION_SAMPLE_PRICE, percentEarning, type CommissionType } from "../../../entities/market-operator";

/** Operatorning amaldagi stavkasi (`GET auth/my-profile` → `commission_type`, `commission_value`). */
export type OperatorRate = { type: CommissionType; value: number };

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const toType = (value: unknown): CommissionType | null => {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return text === "percent" || text === "fixed" ? text : null;
};

/** `numeric(14,2)` son yoki matn bo'lib keladi (`"5.00"`). */
const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/**
 * `GET auth/my-profile` javobi → profil yozuvi (`{ data: User }` yoki `User`). Profil deb faqat `id` li obyekt
 * olinadi: bo'sh, matn yoki `id` siz javob — `null` (sahifa xato ko'rsatadi, «belgilanmagan» emas).
 */
export const readOperatorProfile = (response: unknown): Record<string, unknown> | null => {
  // `User`, `{ data: User }` yoki `{ data: { data: User } }` (`unwrapUserResponse` qabul qiladigan shakllar).
  let node = asRecord(response);
  for (let depth = 0; node && depth < 3; depth += 1) {
    if (node.id != null && node.id !== "") return node;
    node = asRecord(node.data);
  }
  return null;
};

/**
 * Profil → stavka. Backend (`finance recordOperatorEarning`): turi yo'q yoki qiymati 0 (yoki yo'q) — daromad
 * yozilmaydi, shuning uchun bunday holat «Komissiya belgilanmagan» (`null`) bilan bir xil ko'rsatiladi.
 */
export const readOperatorRate = (profile: unknown): OperatorRate | null => {
  const record = asRecord(profile);
  const type = toType(record?.commission_type);
  const value = toNumber(record?.commission_value);
  if (!type || value === null || value <= 0) return null;
  return { type, value };
};

/** «Namuna»: `COMMISSION_SAMPLE_PRICE` so'mlik sotuvdan yoziladigan daromad (foiz — butun so'mga yaxlitlangan). */
export const sampleEarning = (rate: OperatorRate, price = COMMISSION_SAMPLE_PRICE): number =>
  rate.type === "percent" ? percentEarning(rate.value, price) : rate.value;

