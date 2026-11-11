/**
 * Kuryer kassasi qoldig'i — «Kassa qarzga ishlaydi» (2026-11-11). Sozlama yoqilgan kuryerdan qoldig'idan ORTIQ
 * (oldindan) pul qabul qilinadi: kuryer kassasi manfiyga tushadi — kompaniya kuryerga qarzdor, ortig'i keyingi
 * sotuvlardan yopiladi. Shuning uchun manfiy kuryer qoldig'i «−200 000» emas, «Avans: 200 000 so'm» bo'lib
 * ko'rsatiladi. Faqat KURYER uchun: market kassasidagi manfiy qoldiq boshqa ma'no («market bizga qarzdor»).
 */
export interface CourierBalanceView {
  /** Qoldiq yorlig'i: oddiy (`labels.balance`) yoki avans (`labels.advance`). */
  label: string;
  /** Ko'rsatiladigan summa — avansda musbat. */
  amount: number;
  /** `true` — qoldiq manfiy: kuryer oldindan topshirgan avans. */
  isAdvance: boolean;
}

export const formatCourierBalance = (
  balance: number,
  labels: { balance: string; advance: string },
): CourierBalanceView =>
  balance < 0
    ? { label: labels.advance, amount: -balance, isAdvance: true }
    : { label: labels.balance, amount: balance, isAdvance: false };

/** Qabul qilinadigan summaning kuryer qoldig'idan ortig'i — avans qismi (0 — avans yo'q). */
export const courierAdvancePart = (amount: number, balance: number): number =>
  Math.max(0, amount - Math.max(0, balance));
