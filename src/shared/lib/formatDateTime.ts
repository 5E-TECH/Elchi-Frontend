import { resolveMoneyLanguage, type MoneyLanguage } from "./formatMoney";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  SANA VA VAQT FORMATI — dizayn v2 (DESIGN_SYSTEM §7)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Sana hamma tilda KK.OO.YYYY, vaqt 24 soatlik SS:dd:
 *    formatDateLocalized      → "06.10.2026"
 *    formatTimeLocalized      → "19:05"
 *    formatDateTimeLocalized  → bugun  uz "Bugun, 14:15"  · ru "Сегодня, 14:15" · en "Today, 14:15"
 *                               kecha  uz "Kecha, 18:04"  · ru "Вчера, 18:04"   · en "Yesterday, 18:04"
 *                               eski   "06.10.2026, 19:05" (hamma tilda)
 *
 *  ⚠️ `Intl.DateTimeFormat` / `toLocaleString` ATAYLAB ishlatilmaydi: Chrome'ning
 *  qisqartirilgan ICU ma'lumotida "uz" yo'q (formatMoney.ts izohi). dayjs ham
 *  yangi kodda to'g'ridan-to'g'ri import qilinmaydi — format shu yerda qo'lda.
 *
 *    formatRelativeTimeLocalized → uz "Hozirgina" · "12 daqiqa oldin" · "3 soat oldin" · "2 kun oldin"
 *                               ru "Только что" · "12 минут назад" · en "Just now" · "12 minutes ago"
 *                               (30 kundan eski — "06.10.2026")
 *
 *  «Bugun / Kecha» so'zlari locale JSON'da emas, shu faylda (`RELATIVE_DAY_LABEL`) —
 *  `CURRENCY_LABEL` bilan bir xil sabab: formatlovchi aniq til bilan chaqiriladi
 *  (`{ language: "ru" }`), ru/en tarjimalari esa dangasa yuklanadi (`i18n.ts`) va
 *  hali yuklanmagan bo'lishi mumkin.
 *
 *  VAQT MINTAQASI: brauzerning mahalliy vaqti (ilova dayjs timezone plaginini
 *  ishlatmaydi; foydalanuvchilar Toshkent vaqtida). ISO satrdagi `Z` yoki `+05:00`
 *  hisobga olinadi; mintaqasiz satr ("2026-10-06", "2026-10-06 19:05") mahalliy
 *  vaqt deb o'qiladi (dayjs bilan bir xil). Bugun/kecha — KALENDAR kuni bo'yicha
 *  (24 soatlik oyna emas), shuning uchun yarim tun, oy/yil chegarasi va yozgi vaqtga
 *  o'tish (23 yoki 25 soatlik kun) to'g'ri ishlaydi.
 *
 *  Bo'sh yoki noto'g'ri qiymat — "—".
 */

export type DateLanguage = MoneyLanguage;

/** Qabul qilinadigan qiymat: `Date`, ISO satr yoki millisekund (epoch). */
export type DateInput = Date | string | number | null | undefined;

export type DateFormatOptions = {
  /** `uz | ru | en`; berilmasa — i18n joriy tili (`resolveMoneyLanguage`). */
  language?: string | null;
};

export type DateTimeFormatOptions = DateFormatOptions & {
  /** «Hozir» — test va namunalar uchun; sukut `new Date()`. */
  now?: Date | number;
  /** `false` — har doim to'liq sana ("06.10.2026, 19:05"), «Bugun/Kecha» siz. Sukut `true`. */
  relative?: boolean;
};

/** Bo'sh qiymat belgisi (`formatDate.ts`, `formatPhone.ts` bilan bir xil). */
const EMPTY = "—";

/** Nisbiy kun nomlari — uchala tilda (DESIGN_SYSTEM §7, maket `Main` → «Format standarti»). */
export const RELATIVE_DAY_LABEL: Record<DateLanguage, { today: string; yesterday: string }> = {
  uz: { today: "Bugun", yesterday: "Kecha" },
  ru: { today: "Сегодня", yesterday: "Вчера" },
  en: { today: "Today", yesterday: "Yesterday" },
};

/**
 * ISO 8601: "2026-10-06", "2026-10-06T19:05", "2026-10-06 19:05:30.123456",
 * "2026-10-06T14:05:00Z", "2026-10-06T19:05:00+05:00" / "+0500" / "+05".
 */
const ISO_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

/** Ilovaning o'z ko'rinishi: "06.10.2026" yoki "06.10.2026, 19:05" (KK.OO.YYYY — `new Date` uni OO.KK deb o'qiydi). */
const DISPLAY_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4})(?:,?\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/;

const isValidDate = (date: Date) => !Number.isNaN(date.getTime());

type DateParts = { y: number; mo: number; d: number; h: number; mi: number; s: number; ms: number };

/**
 * Qismlardan `Date`: `offsetMinutes` yo'q — mahalliy vaqt, bor — aniq lahza (UTC + siljish).
 * Kalendarda yo'q sana (31.09, 25:00) `Date` tomonidan keyingi kunga surilmaydi — `null`.
 */
const fromParts = ({ y, mo, d, h, mi, s, ms }: DateParts, offsetMinutes?: number): Date | null => {
  if (mo < 1 || mo > 12 || d < 1 || h > 23 || mi > 59 || s > 59) return null;
  // Oyda shuncha kun bormi (30.09 bor, 31.09 yo'q; 29.02 faqat kabisa yilida).
  const probe = new Date(0);
  probe.setUTCFullYear(y, mo - 1, d);
  if (probe.getUTCDate() !== d) return null;
  // `setFullYear` — `new Date(y, …)` 0–99 yillarga 1900 qo'shib yuboradi.
  if (offsetMinutes === undefined) {
    const local = new Date(2000, 0, 1);
    local.setFullYear(y, mo - 1, d);
    local.setHours(h, mi, s, ms);
    return isValidDate(local) ? local : null;
  }
  probe.setUTCHours(h, mi, s, ms);
  const instant = new Date(probe.getTime() - offsetMinutes * 60_000);
  return isValidDate(instant) ? instant : null;
};

const parseIso = (text: string): Date | null => {
  const match = ISO_PATTERN.exec(text);
  if (!match) return null;
  const [, y, mo, d, h = "0", mi = "0", s = "0", frac = "", zone] = match;
  const parts = {
    y: Number(y),
    mo: Number(mo),
    d: Number(d),
    h: Number(h),
    mi: Number(mi),
    s: Number(s),
    ms: Number(frac.slice(0, 3).padEnd(3, "0")),
  };
  if (!zone) return fromParts(parts);
  if (zone.toUpperCase() === "Z") return fromParts(parts, 0);
  const sign = zone.startsWith("-") ? -1 : 1;
  const offset = zone.slice(1).replace(":", "");
  return fromParts(parts, sign * (Number(offset.slice(0, 2)) * 60 + Number(offset.slice(2, 4) || "0")));
};

const parseDisplay = (text: string): Date | null => {
  const match = DISPLAY_PATTERN.exec(text);
  if (!match) return null;
  const [, d, mo, y, h = "0", mi = "0", s = "0"] = match;
  return fromParts({ y: Number(y), mo: Number(mo), d: Number(d), h: Number(h), mi: Number(mi), s: Number(s), ms: 0 });
};

/**
 * Qiymatni yaroqli `Date` ga aylantiradi yoki `null` qaytaradi.
 * Satr: ISO 8601 yoki ilovaning o'z ko'rinishi ("06.10.2026, 19:05"); harfli satr
 * ("Tue, 06 Oct 2026 14:05:00 GMT") brauzerga beriladi. Ikki ma'noli raqamli satr
 * ("10/06/2026", "1728230700") taxmin qilinmaydi. Bo'sh, `null`, `NaN`, boshqa turlar — `null`.
 */
export const toValidDate = (value: unknown): Date | null => {
  if (value instanceof Date) return isValidDate(value) ? new Date(value.getTime()) : null;
  if (typeof value === "number") return Number.isFinite(value) ? toValidDate(new Date(value)) : null;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  if (ISO_PATTERN.test(text)) return parseIso(text);
  if (DISPLAY_PATTERN.test(text)) return parseDisplay(text);
  if (!/[a-z]/i.test(text)) return null;
  const parsed = new Date(text);
  return isValidDate(parsed) ? parsed : null;
};

const pad2 = (value: number) => String(value).padStart(2, "0");

/** Yil har doim 4 xona (YYYY): 99-yil → "0099", "99" emas. */
const datePart = (date: Date) =>
  `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${String(date.getFullYear()).padStart(4, "0")}`;

const timePart = (date: Date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

/** Ikki lahza bir kalendar kunidami (mahalliy vaqt). */
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Sana: `formatDateLocalized("2026-10-06T19:05:00+05:00")` → "06.10.2026".
 * Format hamma tilda bir xil (KK.OO.YYYY); `language` boshqa formatlovchilar bilan
 * bir xil chaqirish uchun qabul qilinadi.
 */
export const formatDateLocalized: (value: DateInput, options?: DateFormatOptions) => string = (value) => {
  const date = toValidDate(value);
  return date ? datePart(date) : EMPTY;
};

/** Vaqt, 24 soatlik: `formatTimeLocalized(new Date(2026, 9, 6, 9, 5))` → "09:05". */
export const formatTimeLocalized: (value: DateInput, options?: DateFormatOptions) => string = (value) => {
  const date = toValidDate(value);
  return date ? timePart(date) : EMPTY;
};

/**
 * Sana va vaqt (jadval, ro'yxat, tarix): bugun — "Bugun, 14:15", kecha — "Kecha, 18:04",
 * eskiroq yoki kelajak — "06.10.2026, 19:05". `relative: false` — har doim to'liq sana.
 */
export const formatDateTimeLocalized = (value: DateInput, options: DateTimeFormatOptions = {}): string => {
  const date = toValidDate(value);
  if (!date) return EMPTY;
  const time = timePart(date);

  if (options.relative !== false) {
    const now = toValidDate(options.now ?? null) ?? new Date();
    const labels = RELATIVE_DAY_LABEL[resolveMoneyLanguage(options.language)];
    if (isSameDay(date, now)) return `${labels.today}, ${time}`;
    // Kecha = bugungi kalendar kunidan bitta oldingi kun; `Date` oy/yil chegarasini o'zi to'g'rilaydi.
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12);
    if (isSameDay(date, yesterday)) return `${labels.yesterday}, ${time}`;
  }

  return `${datePart(date)}, ${time}`;
};

/** Ruscha ko'plik: 1, 21 — `one`; 2–4, 22–24 — `few`; qolgani (5–20, 11–14 ham) — `many`. */
const ruPlural = (count: number, one: string, few: string, many: string) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

type RelativeUnit = "minute" | "hour" | "day";

/**
 * «… oldin» so'zlari — uchala tilda, `RELATIVE_DAY_LABEL` bilan bir xil sabab (locale JSON'da emas: formatlovchi
 * aniq til bilan chaqiriladi, ru/en tarjimalari esa dangasa yuklanadi).
 */
export const RELATIVE_TIME_LABEL: Record<
  DateLanguage,
  { justNow: string; ago: (count: number, unit: RelativeUnit) => string }
> = {
  uz: {
    justNow: "Hozirgina",
    ago: (count, unit) => `${count} ${{ minute: "daqiqa", hour: "soat", day: "kun" }[unit]} oldin`,
  },
  ru: {
    justNow: "Только что",
    ago: (count, unit) => {
      const word =
        unit === "minute"
          ? ruPlural(count, "минуту", "минуты", "минут")
          : unit === "hour"
            ? ruPlural(count, "час", "часа", "часов")
            : ruPlural(count, "день", "дня", "дней");
      return `${count} ${word} назад`;
    },
  },
  en: {
    justNow: "Just now",
    ago: (count, unit) => `${count} ${unit}${count === 1 ? "" : "s"} ago`,
  },
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** Server va brauzer soati farqi: shuncha kelajakdagi lahza ham «hozirgina» (oxirgi faollik — server vaqti). */
const CLOCK_SKEW_MS = 5 * MINUTE_MS;
/** Bundan eski lahza — nisbiy emas, sana bilan. */
const RELATIVE_MAX_DAYS = 30;

/**
 * Nisbiy vaqt («oxirgi faollik», «kirgan»): 1 daqiqadan kam — «Hozirgina», so'ng daqiqa / soat / kun (pastga
 * yaxlitlanadi: 59 daqiqa — «59 daqiqa oldin», 60 — «1 soat oldin»); 30 kundan eski — sana ("06.10.2026").
 * Kelajak: soat farqi ichida (5 daqiqa) — «Hozirgina», undan uzoq — to'liq `formatDateTimeLocalized`.
 * Bo'sh yoki noto'g'ri — "—". Kun — 24 soatlik oraliq (kalendar kuni emas): «Kecha» kerak bo'lsa — yoniga
 * `formatDateTimeLocalized`.
 */
export const formatRelativeTimeLocalized = (value: DateInput, options: DateTimeFormatOptions = {}): string => {
  const date = toValidDate(value);
  if (!date) return EMPTY;
  const now = toValidDate(options.now ?? null) ?? new Date();
  const diff = now.getTime() - date.getTime();
  const labels = RELATIVE_TIME_LABEL[resolveMoneyLanguage(options.language)];

  if (diff < -CLOCK_SKEW_MS) return formatDateTimeLocalized(date, options);
  if (diff < MINUTE_MS) return labels.justNow;
  if (diff < HOUR_MS) return labels.ago(Math.floor(diff / MINUTE_MS), "minute");
  if (diff < DAY_MS) return labels.ago(Math.floor(diff / HOUR_MS), "hour");
  const days = Math.floor(diff / DAY_MS);
  if (days < RELATIVE_MAX_DAYS) return labels.ago(days, "day");
  return datePart(date);
};
