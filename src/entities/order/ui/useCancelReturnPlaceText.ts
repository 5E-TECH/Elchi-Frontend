import { useTranslation } from "react-i18next";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import type { CancelReturnPlace } from "../model/cancelReturnStage";
import { ORDER_STATUS_NS } from "../model/statusRegistry";

/** Joy qatori matni: «Toshkent HQ · 2 kun», «→ Toshkent HQ», «Toshkent HQ · Bugun, 11:20». */
export const useCancelReturnPlaceText = () => {
  const { t, i18n } = useTranslation(ORDER_STATUS_NS);
  const language = i18n.resolvedLanguage ?? i18n.language;
  return (
    place: CancelReturnPlace | null,
  ): { name: string | null; extra: string | null } | null => {
    if (!place) return null;
    const name = place.name
      ? place.arrow
        ? t("cancelReturn.towards", { name: place.name })
        : place.name
      : null;
    const extra =
      place.at !== null
        ? formatDateTimeLocalized(place.at, { language })
        : place.days !== null
          ? t("cancelReturn.days", { count: place.days })
          : null;
    if (!name && !extra) return null;
    return { name, extra };
  };
};
