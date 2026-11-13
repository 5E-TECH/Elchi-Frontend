/**
 * Tavsiya savollar (maket `superadmin-ai-assistant` — chiplar, `-empty` — tanlov kartalari). «Sentyabrda nega zarar
 * bo'ldi?» — o'tgan oy (maketdagi oy o'rnida; Toshkent vaqti bo'yicha).
 */
export type Suggestion = { key: string; questionKey: string; hintKey?: string };

/** O'tgan oy raqami (1–12), Toshkent kalendari bo'yicha. */
export const previousMonth = (now: Date = new Date()): number => {
  const tashkent = new Date(now.getTime() + 5 * 3_600_000);
  const month = tashkent.getUTCMonth(); // 0–11, joriy oy
  return month === 0 ? 12 : month;
};

const lossKey = (now?: Date) => `suggest.loss.${previousMonth(now)}`;

/** Suhbat ostidagi 5 chip (maketdagi tartib). */
export const chipSuggestions = (now?: Date): Suggestion[] => [
  { key: "weekCash", questionKey: "suggest.weekCash" },
  { key: "courierDebts", questionKey: "suggest.courierDebts" },
  { key: "marketPayables", questionKey: "suggest.marketPayables" },
  { key: "shifts", questionKey: "suggest.shifts" },
  { key: "loss", questionKey: lossKey(now) },
];

/** Bo'sh suhbatdagi 6 karta (savol + izoh). */
export const cardSuggestions = (now?: Date): Suggestion[] => [
  { key: "monthCash", questionKey: "suggest.monthCash", hintKey: "suggest.monthCashHint" },
  { key: "courierDebts", questionKey: "suggest.courierDebts", hintKey: "suggest.courierDebtsHint" },
  { key: "marketPayables", questionKey: "suggest.marketPayables", hintKey: "suggest.marketPayablesHint" },
  { key: "shifts", questionKey: "suggest.shifts", hintKey: "suggest.shiftsHint" },
  { key: "receipts", questionKey: "suggest.receipts", hintKey: "suggest.receiptsHint" },
  { key: "loss", questionKey: lossKey(now), hintKey: "suggest.lossHint" },
];
