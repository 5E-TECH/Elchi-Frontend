import { RELATIVE_DAY_LABEL, toValidDate } from "../../../shared/lib/formatDateTime";
import { resolveMoneyLanguage } from "../../../shared/lib/formatMoney";

/**
 * Sana — DOIM Asia/Tashkent zonasida.
 *
 * ⚠️ Ilgari zona berilmagan edi va brauzerning mahalliy zonasi ishlatilardi:
 * UTC'da sozlangan qurilmada `2026-07-19T20:30Z` "19.07.2026, 20:30" bo'lib
 * chiqardi, holbuki Toshkentda bu allaqachon 20-iyul 01:30. Operatorlar va
 * hisobotlar Toshkent vaqtida ishlaydi.
 */
export const TASHKENT_TIME_ZONE = "Asia/Tashkent";

type WallClock = { year: string; month: string; day: string; hour: string; minute: string; second: string };

/** Lahzaning Toshkentdagi devor soati (raqamli qismlar — ICU'da "uz" bo'lmasa ham ishlaydi). */
const tashkentWallClock = (date: Date): WallClock => {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: TASHKENT_TIME_ZONE,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
};

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  // Millisekund matn ko'rinishida ham keladi (`sold_at: "1784557174975"`).
  if (typeof value === "string" && /^\d{10,}$/.test(value.trim())) return toDate(Number(value));
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return toValidDate(value);
};

/** To'liq sana va soniya: "20.07.2026, 13:38:49" (Buyurtma ma'lumotlari — sotilgan vaqt). */
export const formatTrackingDate = (value: string | number | Date) => {
  const date = toDate(value);
  if (!date) return "—";
  const p = tashkentWallClock(date);
  return `${p.day}.${p.month}.${p.year}, ${p.hour}:${p.minute}:${p.second}`;
};

const DAY_MS = 86_400_000;
const dayKey = (p: WallClock) => `${p.year}-${p.month}-${p.day}`;

/**
 * Tarix yozuvi vaqti (dizayn v2, `formatDateTimeLocalized` formati) — Toshkent zonasida:
 * bugun «Bugun, 14:32», kecha «Kecha, 18:30», eskiroq «20.07.2026, 13:38».
 * «Bugun / Kecha» ham Toshkent kalendar kuni bo'yicha (O'zbekistonda yozgi vaqt yo'q — 24 soat orqasi kecha).
 */
export const formatTrackingDateTime = (
  value: unknown,
  options: { now?: Date | number; language?: string | null } = {},
): string => {
  const date = toDate(value);
  if (!date) return "—";
  const p = tashkentWallClock(date);
  const time = `${p.hour}:${p.minute}`;
  const now = toDate(options.now ?? Date.now()) ?? new Date();
  const labels = RELATIVE_DAY_LABEL[resolveMoneyLanguage(options.language)];
  if (dayKey(p) === dayKey(tashkentWallClock(now))) return `${labels.today}, ${time}`;
  if (dayKey(p) === dayKey(tashkentWallClock(new Date(now.getTime() - DAY_MS)))) return `${labels.yesterday}, ${time}`;
  return `${p.day}.${p.month}.${p.year}, ${time}`;
};
