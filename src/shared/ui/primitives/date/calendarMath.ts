import type { ISODateRange } from "../../../lib/dateRange";
import { formatDateLocalized } from "../../../lib/formatDateTime";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  SANA HISOBI — kalendar (`Calendar`), sana oralig'i (`DateRange`) va bitta sana (`DateInput`) uchun
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Qiymat hamma joyda bitta ko'rinishda: `YYYY-MM-DD` satri (kalendar kuni, vaqtsiz; bo'sh — `""`).
 *  URL parametri, API filtri (`start_day`, `from`) va v1 komponentlarning qiymati shu shaklda.
 *
 *  Hisob UTC kunlarida (`Date.UTC`): yozgi vaqtga o'tish (23/25 soatlik kun) kunni surib yubormaydi.
 *  «Bugun» — brauzerning mahalliy kalendar kuni (`formatDateTime.ts` bilan bir xil). Hafta dushanbadan
 *  boshlanadi (maket: «Du Se Ch Pa Ju Sh Ya»). `Intl` va dayjs ishlatilmaydi (DESIGN_SYSTEM §7).
 */

/** Kalendar kuni: `"2026-10-08"`. */
export type ISODay = string;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

const pad2 = (value: number) => String(value).padStart(2, "0");

/** `Date` ning MAHALLIY kalendar kuni → `"YYYY-MM-DD"`. */
export const toISODay = (date: Date): ISODay =>
  `${String(date.getFullYear()).padStart(4, "0")}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/** UTC qismlaridan `"YYYY-MM-DD"` (ichki hisob uchun). */
const fromUTC = (ms: number): ISODay => {
  const date = new Date(ms);
  return `${String(date.getUTCFullYear()).padStart(4, "0")}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
};

type DayParts = { y: number; m: number; d: number };

/**
 * Satrni kalendar kuniga ajratadi. Qat'iy: `2026-02-30`, `2026-13-01`, `08.10.2026` — `null`.
 * ISO sana-vaqt (`2026-10-08T14:00:00`) — sana qismi olinadi.
 */
export const parseISODay = (value: string | null | undefined): DayParts | null => {
  if (!value) return null;
  const match = ISO_DAY.exec(value.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1) return null;
  const probe = new Date(0);
  probe.setUTCFullYear(y, m - 1, d);
  if (probe.getUTCDate() !== d) return null;
  return { y, m, d };
};

/** Yaroqli kalendar kuni bo'lsa — normallashtirilgan `"YYYY-MM-DD"`, aks holda `""`. */
export const normalizeISODay = (value: string | null | undefined): ISODay => {
  const parts = parseISODay(value);
  return parts ? `${String(parts.y).padStart(4, "0")}-${pad2(parts.m)}-${pad2(parts.d)}` : "";
};

const utcMs = ({ y, m, d }: DayParts) => {
  const probe = new Date(0);
  probe.setUTCFullYear(y, m - 1, d);
  return probe.getTime();
};

const DAY_MS = 86_400_000;

/** `"YYYY-MM-DD"` → mahalliy yarim tun `Date` (v1 `DateRangePicker` qiymati uchun). */
export const isoDayToDate = (value: string | null | undefined): Date | null => {
  const parts = parseISODay(value);
  if (!parts) return null;
  const date = new Date(2000, 0, 1);
  date.setFullYear(parts.y, parts.m - 1, parts.d);
  return date;
};

/** Bugungi mahalliy kun. */
export const todayISODay = (now: Date = new Date()): ISODay => toISODay(now);

/** `n` kun qo'shadi (manfiy — ayiradi). */
export const addDays = (day: ISODay, n: number): ISODay => {
  const parts = parseISODay(day);
  return parts ? fromUTC(utcMs(parts) + n * DAY_MS) : day;
};

/** Oyning kunlari soni (`month` 1–12). */
export const daysInMonth = (year: number, month: number) => {
  const probe = new Date(0);
  probe.setUTCFullYear(year, month, 0);
  return probe.getUTCDate();
};

/** `n` oy qo'shadi, kun oy uzunligiga qisqaradi: 31.01 + 1 oy → 28.02 (29.02). */
export const addMonths = (day: ISODay, n: number): ISODay => {
  const parts = parseISODay(day);
  if (!parts) return day;
  const index = parts.y * 12 + (parts.m - 1) + n;
  const y = Math.floor(index / 12);
  const m = index - y * 12 + 1;
  const d = Math.min(parts.d, daysInMonth(y, m));
  return `${String(y).padStart(4, "0")}-${pad2(m)}-${pad2(d)}`;
};

/** Hafta kuni, dushanba = 0 … yakshanba = 6. */
export const weekdayIndex = (day: ISODay): number => {
  const parts = parseISODay(day);
  if (!parts) return 0;
  return (new Date(utcMs(parts)).getUTCDay() + 6) % 7;
};

/** Hafta boshi (dushanba). */
export const startOfWeek = (day: ISODay): ISODay => addDays(day, -weekdayIndex(day));

/** Hafta oxiri (yakshanba). */
export const endOfWeek = (day: ISODay): ISODay => addDays(day, 6 - weekdayIndex(day));

/** Oyning 1-kuni. */
export const startOfMonth = (day: ISODay): ISODay => `${day.slice(0, 8)}01`;

/** Oyning oxirgi kuni. */
export const endOfMonth = (day: ISODay): ISODay => {
  const parts = parseISODay(day);
  if (!parts) return day;
  return `${day.slice(0, 8)}${pad2(daysInMonth(parts.y, parts.m))}`;
};

/** Ikki kunni solishtirish (`YYYY-MM-DD` leksikografik tartibi = xronologik). */
export const compareDays = (a: ISODay, b: ISODay) => (a < b ? -1 : a > b ? 1 : 0);

/** Kunni `[min, max]` oralig'iga qisib qo'yadi (chegara berilmasa — tegilmaydi). */
export const clampDay = (day: ISODay, min?: ISODay, max?: ISODay): ISODay => {
  if (min && day < min) return min;
  if (max && day > max) return max;
  return day;
};

/** Kun `[min, max]` dan tashqaridami (tanlab bo'lmaydi). */
export const isOutOfBounds = (day: ISODay, min?: ISODay, max?: ISODay) =>
  Boolean((min && day < min) || (max && day > max));

/** Ikki kun bir oydami. */
export const isSameMonth = (a: ISODay, b: ISODay) => a.slice(0, 7) === b.slice(0, 7);

/** Oylar farqi: `b` oyi − `a` oyi. */
export const monthDiff = (a: ISODay, b: ISODay) => {
  const pa = parseISODay(a);
  const pb = parseISODay(b);
  if (!pa || !pb) return 0;
  return pb.y * 12 + pb.m - (pa.y * 12 + pa.m);
};

export type CalendarCell = {
  day: ISODay;
  /** Oy kuni raqami (1–31). */
  date: number;
  /** Shu oyning kunimi (`false` — qo'shni oy: maketdagi `.is-muted`). */
  inMonth: boolean;
};

/**
 * Oy to'ri: har doim 6 hafta × 7 kun = 42 katak (maketdagidek; ikki oy yonma-yon bo'lganda balandlik
 * teng). Dushanbadan boshlanadi; oldingi va keyingi oy kunlari bilan to'ldiriladi.
 */
export const buildMonthGrid = (monthStart: ISODay): CalendarCell[] => {
  const first = startOfMonth(monthStart);
  const gridStart = addDays(first, -weekdayIndex(first));
  const month = first.slice(0, 7);
  return Array.from({ length: 42 }, (_, index) => {
    const day = addDays(gridStart, index);
    return { day, date: Number(day.slice(8, 10)), inMonth: day.slice(0, 7) === month };
  });
};

/** Oraliqdagi kunlar soni, ikkala chekka bilan: 01.10 – 08.10 → 8. */
export const countDays = (from: ISODay, to: ISODay): number => {
  const a = parseISODay(from);
  const b = parseISODay(to);
  if (!a || !b) return 0;
  return Math.abs(Math.round((utcMs(b) - utcMs(a)) / DAY_MS)) + 1;
};

/** Oraliq: ikkala qiymat normallashtiriladi; teskari bo'lsa (`from > to`) almashtiriladi. */
export const normalizeRange = (range: Partial<ISODateRange> | null | undefined): ISODateRange => {
  const from = normalizeISODay(range?.from);
  const to = normalizeISODay(range?.to);
  if (from && to && from > to) return { from: to, to: from };
  return { from, to };
};

export const EMPTY_RANGE: ISODateRange = Object.freeze({ from: "", to: "" }) as ISODateRange;

/* ─── Tez tanlov (maket `.el-cal-presets`: «Bugun / Bu hafta / Bu oy / Barchasi») ─────────────── */

/**
 * Tayyor davrlar. Maketdagi to'plam — `DEFAULT_DATE_PRESETS`; qolganlari (kecha, o'tgan hafta/oy,
 * bu yil) kerak bo'lgan sahifa uchun.
 *   today     — bugun;
 *   yesterday — kecha;
 *   week      — shu hafta dushanbasidan bugungacha (`shared/lib/dateRange` `getThisWeekRange` bilan bir xil);
 *   lastWeek  — o'tgan hafta (dushanba – yakshanba);
 *   month     — oyning 1-kunidan bugungacha;
 *   lastMonth — o'tgan oy to'liq;
 *   year      — 1-yanvardan bugungacha;
 *   all       — «Barchasi»: sana filtri yo'q (bo'sh oraliq).
 */
export type DatePresetKey = "today" | "yesterday" | "week" | "lastWeek" | "month" | "lastMonth" | "year" | "all";

/** Maketdagi tez tanlov to'plami (`tizim-states-forms` 04, ro'yxat sahifalari filtri). */
export const DEFAULT_DATE_PRESETS: readonly DatePresetKey[] = Object.freeze(["today", "week", "month", "all"]);

export const getPresetRange = (preset: DatePresetKey, today: ISODay = todayISODay()): ISODateRange => {
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const day = addDays(today, -1);
      return { from: day, to: day };
    }
    case "week":
      return { from: startOfWeek(today), to: today };
    case "lastWeek": {
      const start = addDays(startOfWeek(today), -7);
      return { from: start, to: addDays(start, 6) };
    }
    case "month":
      return { from: startOfMonth(today), to: today };
    case "lastMonth": {
      const start = addMonths(startOfMonth(today), -1);
      return { from: start, to: endOfMonth(start) };
    }
    case "year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case "all":
      return { from: "", to: "" };
  }
};

/** Joriy oraliq qaysi tayyor davrga to'g'ri keladi (birinchi mosi) — chip `aria-pressed`. */
export const matchPreset = (
  range: ISODateRange,
  presets: readonly DatePresetKey[],
  today: ISODay = todayISODay(),
): DatePresetKey | null => {
  for (const preset of presets) {
    const candidate = getPresetRange(preset, today);
    if (candidate.from === range.from && candidate.to === range.to) return preset;
  }
  return null;
};

/* ─── Ko'rinish (KK.OO.YYYY — `formatDateLocalized`) ─────────────────────────────────────────── */

/** Bitta kun: `"08.10.2026"`; bo'sh — `""`. */
export const formatDay = (day: ISODay): string => (parseISODay(day) ? formatDateLocalized(day) : "");

/** Oraliq chizig'i (maketdagi «01.10 – 08.10.2026»): ikki tomonida bo'sh joy bilan en-chiziq (U+2013). */
export const RANGE_DASH = " – ";

/**
 * Maydondagi oraliq (maket `tizim-states-forms` 04):
 *   bir kun        → «08.10.2026»;
 *   bir yil ichida → «01.10 – 08.10.2026» (boshlanishda yil takrorlanmaydi);
 *   turli yillar   → «28.12.2025 – 05.01.2026».
 * Faqat bir chekka bo'lsa — `null` (chaqiruvchi «… dan» / «… gacha» matnini quradi).
 */
export const formatRangeShort = ({ from, to }: ISODateRange): string | null => {
  if (!from || !to) return null;
  if (from === to) return formatDay(from);
  const start = formatDay(from);
  const end = formatDay(to);
  // `formatDateLocalized` → "KK.OO.YYYY": bir yil bo'lsa boshlanishdan «.YYYY» tashlanadi.
  const startShort = from.slice(0, 4) === to.slice(0, 4) ? start.slice(0, 5) : start;
  return `${startShort}${RANGE_DASH}${end}`;
};

/** Panel pastidagi to'liq oraliq: «01.10.2026 – 08.10.2026». */
export const formatRangeFull = ({ from, to }: ISODateRange): string | null => {
  if (!from || !to) return null;
  if (from === to) return formatDay(from);
  return `${formatDay(from)}${RANGE_DASH}${formatDay(to)}`;
};

/**
 * Ko'plik shakli (i18n kaliti `one | few | many`) — `Intl.PluralRules` siz (uz ICU ma'lumoti yo'q).
 * ru: 1, 21 → one; 2–4, 22–24 → few; qolgani → many. uz/en: 1 → one, qolgani → many.
 */
export const pluralForm = (language: string, count: number): "one" | "few" | "many" => {
  const n = Math.abs(Math.trunc(count));
  if (language === "ru") {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return "one";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
    return "many";
  }
  return n === 1 ? "one" : "many";
};
