import { formatDateLocalized } from "../../../../shared/lib/formatDateTime";

/**
 * «Bu davrda to'lov yo'q» matni uchun kalit va qiymatlar (IS-3).
 *
 *   ikkala chet — `emptyPeriodText`, bir yil ichida maketdagidek «01.09 – 30.09.2026»;
 *   faqat «dan» — `emptyPeriodFromText` («… dan beri»), faqat «gacha» — `emptyPeriodToText` («… gacha»):
 *   bitta sana bilan «oralig'ida / between / С» degan gap buzilmasin.
 */
export const remittancesPeriodText = (
  range: { from: string; to: string },
  language: string,
): { key: "emptyPeriodText" | "emptyPeriodFromText" | "emptyPeriodToText"; values: Record<string, string> } => {
  const from = range.from ? formatDateLocalized(range.from, { language }) : "";
  const to = range.to ? formatDateLocalized(range.to, { language }) : "";
  if (from && to) {
    // Format hamma tilda KK.OO.YYYY — yil bir xil bo'lsa birinchi sanadan yil olib tashlanadi.
    const short = from.slice(-4) === to.slice(-4) ? from.slice(0, 5) : from;
    return { key: "emptyPeriodText", values: { range: `${short} – ${to}` } };
  }
  return from ? { key: "emptyPeriodFromText", values: { date: from } } : { key: "emptyPeriodToText", values: { date: to } };
};
