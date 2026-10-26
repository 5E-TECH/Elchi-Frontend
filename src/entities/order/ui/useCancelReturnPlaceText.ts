import { useTranslation } from "react-i18next";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import {
  cancelReturnAgeLevel,
  formatCancelHandoverMethod,
  type CancelReturnAgeLevel,
  type CancelReturnPlace,
} from "../model/cancelReturnStage";
import { ORDER_STATUS_NS } from "../model/statusRegistry";

export interface CancelReturnPlaceText {
  /** «Toshkent HQ», «→ Toshkent HQ», kuryer ismi. */
  name: string | null;
  /** Vaqt yoki kunlar (eski chaqiruvchilar uchun bitta satr): «Bugun, 11:20» / «3 kun». */
  extra: string | null;
  /** «Marketga topshirildi» vaqti. */
  time: string | null;
  /** Joyda necha kun («3 kun») — filial / HQ. */
  days: string | null;
  /** «N kun» darajasi (vNKGbg5q: 3 / 7 kun). */
  level: CancelReturnAgeLevel | null;
  /** «Marketga topshirildi» usuli (BG2): «QR orqali», «Parol orqali» … */
  method: string | null;
}

/** Joy qatori matni: «Toshkent HQ · 2 kun», «→ Toshkent HQ», «Toshkent HQ · Bugun, 11:20 · QR orqali». */
export const useCancelReturnPlaceText = () => {
  const { t, i18n } = useTranslation(ORDER_STATUS_NS);
  const language = i18n.resolvedLanguage ?? i18n.language;
  return (place: CancelReturnPlace | null): CancelReturnPlaceText | null => {
    if (!place) return null;
    const name = place.name
      ? place.arrow
        ? t("cancelReturn.towards", { name: place.name })
        : place.name
      : null;
    const time = place.at !== null ? formatDateTimeLocalized(place.at, { language }) : null;
    const days = time === null && place.days !== null ? t("cancelReturn.days", { count: place.days }) : null;
    const method = place.method
      ? formatCancelHandoverMethod((key, options) => t(key, options), { method: place.method, reason: null })
      : null;
    if (!name && !time && !days && !method) return null;
    return {
      name,
      extra: time ?? days,
      time,
      days,
      level: days !== null ? cancelReturnAgeLevel(place.days) : null,
      method,
    };
  };
};
