import { useTranslation } from "react-i18next";
import { formatDateLocalized, RELATIVE_DAY_LABEL } from "../../../shared/lib/formatDateTime";
import { resolveMoneyLanguage } from "../../../shared/lib/formatMoney";
import { addDays, tashkentDay } from "./smsReport";

/** «Bugun» / «Kecha» / «06.10.2026» — Toshkent kuni bo'yicha. */
export const useDayLabel = () => {
  const { i18n } = useTranslation();
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  const today = tashkentDay();
  const yesterday = addDays(today, -1);
  return (day: string) => {
    if (day === today) return RELATIVE_DAY_LABEL[language].today;
    if (day === yesterday) return RELATIVE_DAY_LABEL[language].yesterday;
    return formatDateLocalized(`${day}T12:00:00`, { language });
  };
};
