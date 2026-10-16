import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { resolveMoneyLanguage } from "../../../lib/formatMoney";

/**
 * Kalendar matnlari (`ui` nomlar fazosi, `date.*`). Oy va hafta kunlari nomlari locale'da —
 * `Intl.DateTimeFormat` ishlatilmaydi (Chrome'da `uz` ICU ma'lumoti yo'q, DESIGN_SYSTEM §7).
 * ru/en dangasa yuklanadi: tarjima hali kelmagan bo'lsa (massiv o'rniga kalit qaytsa) — o'zbekcha.
 */
const UZ_MONTHS = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr",
];
const UZ_MONTHS_OF = UZ_MONTHS.map((name) => name.toLowerCase());
const UZ_WEEKDAYS_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const UZ_WEEKDAYS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];

const asList = (value: unknown, length: number, fallback: string[]) =>
  Array.isArray(value) && value.length === length ? value.map(String) : fallback;

export type CalendarText = {
  language: "uz" | "ru" | "en";
  /** Sarlavha: «Oktabr». */
  months: string[];
  /** Kun nomi ichida: uz «oktabr» (1-oktabr), ru «октября» (1 октября). */
  monthsOf: string[];
  /** Ustun sarlavhasi: «Du». */
  weekdaysShort: string[];
  /** Ustun to'liq nomi (ekran o'quvchi): «Dushanba». */
  weekdays: string[];
};

export const useCalendarText = (): CalendarText => {
  const { t, i18n } = useTranslation("ui");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  return useMemo(
    () => ({
      language,
      months: asList(t("date.months", { returnObjects: true }), 12, UZ_MONTHS),
      monthsOf: asList(t("date.monthsOf", { returnObjects: true }), 12, UZ_MONTHS_OF),
      weekdaysShort: asList(t("date.weekdaysShort", { returnObjects: true }), 7, UZ_WEEKDAYS_SHORT),
      weekdays: asList(t("date.weekdays", { returnObjects: true }), 7, UZ_WEEKDAYS),
    }),
    [t, language],
  );
};
