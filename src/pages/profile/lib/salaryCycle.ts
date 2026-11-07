/**
 * Oylik maosh davri — profil «Oylik maosh» kartasi (maket `common-profile`).
 *
 * Mantiq v1 `entities/user/ui/UserStatsCard.tsx` dagi `calcCycleProgress` dan AYNAN ko'chirilgan (v1 fayl
 * iste'molchisiz qolib 5-bosqichda o'chirildi): davr to'lov kunidan keyingi oyning shu kunigacha; bugun to'lov
 * kunidan oldin bo'lsa — o'tgan oyning to'lov kunidan boshlanadi. Kunlar `Math.round` bilan, foiz 100 dan oshmaydi.
 * Qo'shimcha: davr boshi va oxiri (`Date`) — kartadagi «25.09.2026 – 25.10.2026» va «keyingi to'lov» uchun.
 */

const DAY_MS = 86_400_000;

export type SalaryCycle = {
  /** Davr boshlangan sana (to'lov kuni). */
  start: Date;
  /** Davr tugaydigan sana = keyingi to'lov kuni. */
  end: Date;
  /** O'tgan qism, 0–100. */
  progress: number;
  totalDays: number;
  passedDays: number;
  remainDays: number;
};

/** To'lov kuni noto'g'ri bo'lsa (null, 0, «abc») — 1 (eski kartadagi `payment_day ?? 1` bilan bir xil). */
export const toPaymentDay = (value: unknown): number => {
  const day = Number(value ?? 1);
  return Number.isFinite(day) && day >= 1 ? Math.floor(day) : 1;
};

/**
 * Shu oydagi to'lov sanasi: kun oy uzunligidan oshmaydi (31 → fevralda 28/29, aprelda 30). Ilgari `new Date(y, m, 31)`
 * keyingi oyga o'tib ketardi: 1-martda davr boshi «3-mart» (kelajak) chiqib, foiz va «to'plangan summa» manfiy edi.
 */
const paymentDate = (year: number, month: number, paymentDay: number) =>
  new Date(year, month, Math.min(paymentDay, new Date(year, month + 1, 0).getDate()));

export const calcSalaryCycle = (paymentDay: number, now: Date = new Date()): SalaryCycle => {
  const year = now.getFullYear();
  const month = now.getMonth();

  const thisMonth = paymentDate(year, month, paymentDay);
  // To'lov kunining o'zida (00:00 dan) yangi davr boshlanadi.
  const started = now.getTime() >= thisMonth.getTime();
  const start = started ? thisMonth : paymentDate(year, month - 1, paymentDay);
  const end = started ? paymentDate(year, month + 1, paymentDay) : thisMonth;

  const totalMs = end.getTime() - start.getTime();
  const passedMs = now.getTime() - start.getTime();
  const progress = Math.min(Math.max((passedMs / totalMs) * 100, 0), 100);

  const totalDays = Math.round(totalMs / DAY_MS);
  const passedDays = Math.round(passedMs / DAY_MS);

  return { start, end, progress, totalDays, passedDays, remainDays: totalDays - passedDays };
};

/** Shu davrda to'plangan summa: `floor(maosh × o'tgan qism)`. */
export const calcEarnedSalary = (salary: number, progress: number): number =>
  Math.floor(salary * (progress / 100));
