import type { TFunction } from "i18next";
import { getErrorKind, getErrorStatus } from "../../../shared/lib/errorKind";
import { formatDateLocalized, toValidDate } from "../../../shared/lib/formatDateTime";

/**
 * Investor kabineti formatlari: oy nomlari (`ui:date.months` — `Intl` ishlatilmaydi, DESIGN_SYSTEM §7), foyda davri
 * oralig'i va yuklash xatosi matni (xom backend matni ko'rsatilmaydi — faqat i18n).
 */

const UZ_MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const UZ_MONTHS_SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];

const asMonthList = (value: unknown, fallback: string[]) =>
  Array.isArray(value) && value.length === 12 ? value.map(String) : fallback;

export type MonthNames = { full: string[]; short: string[] };

/** Oy nomlari joriy tilda (ru/en hali yuklanmagan bo'lsa — o'zbekcha). */
export const monthNames = (t: TFunction): MonthNames => ({
  full: asMonthList(t("ui:date.months", { returnObjects: true }), UZ_MONTHS),
  short: asMonthList(t("investor:monthly.monthsShort", { returnObjects: true }), UZ_MONTHS_SHORT),
});

/** `YYYY-MM` → `{ year, month }` (oy 0..11). */
export const parseMonthKey = (key: string): { year: number; month: number } => {
  const [year, month] = key.split("-").map(Number);
  return { year, month: Math.min(11, Math.max(0, (month || 1) - 1)) };
};

/** Joriy oy kaliti (mahalliy vaqt — foydalanuvchilar Toshkentda, backend oyni Toshkent bo'yicha beradi). */
export const currentMonthKey = (now: Date = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

/** «Sentabr 2026». */
export const monthTitle = (key: string, names: MonthNames): string => {
  const { year, month } = parseMonthKey(key);
  return `${names.full[month]} ${year}`;
};

/** Oy nomi davr tugagan sanadan: «Sentabr 2026» (sana bo'lmasa — bo'sh). */
export const monthTitleOf = (value: string | null, names: MonthNames): string => {
  const date = toValidDate(value);
  return date ? `${names.full[date.getMonth()]} ${date.getFullYear()}` : "";
};

/**
 * Foyda davri: «01.09 – 30.09.2026» (bir yilda — boshida yil yo'q), yillar farq qilsa — ikkalasi to'liq.
 * Sana yo'q bo'lsa — mavjudi yoki «—».
 */
export const formatPeriodRange = (start: string | null, end: string | null): string => {
  const from = toValidDate(start);
  const to = toValidDate(end);
  if (!from || !to) return formatDateLocalized(to ?? from);
  const full = formatDateLocalized(from);
  const head = from.getFullYear() === to.getFullYear() ? full.slice(0, 5) : full;
  return `${head} – ${formatDateLocalized(to)}`;
};

/**
 * Yuklash xatosining izohi (`ui:states.error.*` matnlari bilan): server — kod bilan, vaqt/oflayn — o'z matni,
 * qolgani — umumiy. Backend `message` ATAYLAB olinmaydi.
 */
export const loadErrorText = (t: TFunction, error: unknown): string => {
  const kind = getErrorKind(error);
  const status = getErrorStatus(error);
  if (kind === "server") {
    return status != null
      ? t("ui:states.error.server.description", { status })
      : t("ui:states.error.timeout.description");
  }
  if (kind === "timeout" || kind === "offline") return t(`ui:states.error.${kind}.description`);
  return status != null
    ? t("ui:states.error.generic.description", { status })
    : t("ui:states.error.generic.descriptionNoStatus");
};
