import { useTranslation } from "react-i18next";
import type { DeliveryTariffId } from "../../../entities/delivery-pricing";
import { getErrorKind, getErrorStatus } from "../../../shared/lib/errorKind";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import type { TariffChange } from "../model/history";

/** Sahifa matnlari: tarif nomi, muddat («1–2 kun»), o'zgarish («har kg 4 000 → 4 500 so'm»), pul va son. */
export const useTariffText = () => {
  const { t, i18n } = useTranslation("deliveryPricing");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const number = (value: number) => formatNumberLocalized(value, { language });
  const days = (min: number, max: number) =>
    min === max ? t("page.days", { count: min }) : t("page.daysRange", { count: max, min: number(min), max: number(max) });
  const daysRaw = (min: number, max: number) => (min === max ? number(min) : `${number(min)}–${number(max)}`);
  const change = (item: TariffChange, short = false) => {
    if (item.kind === "days") {
      return t("page.changes.days", { from: daysRaw(item.from[0], item.from[1]), to: days(item.to[0], item.to[1]) });
    }
    const key = item.kind === "base" ? "page.changes.base" : short ? "page.changes.perKgShort" : "page.changes.perKg";
    return t(key, { from: number(item.from), to: money(item.to) });
  };
  const changes = (items: readonly TariffChange[], short = false) =>
    items.length ? items.map((item) => change(item, short)).join(", ") : t("page.changes.none");
  /** Saqlash xatosining izohi — faqat i18n (xom backend matni ko'rsatilmaydi). */
  const saveError = (error: unknown) => {
    const kind = getErrorKind(error);
    if (kind === "offline") return t("states.error.offline.description", { ns: "ui" });
    if (kind === "timeout") return t("states.error.timeout.description", { ns: "ui" });
    if (kind === "forbidden") return t("page.saveErrors.forbidden");
    const status = getErrorStatus(error);
    if (status === 400 || status === 422) return t("page.saveErrors.invalid");
    if (status === 409) return t("page.saveErrors.conflict");
    return t("states.error.generic.descriptionNoStatus", { ns: "ui" });
  };
  return {
    t,
    language,
    saveError,
    money,
    number,
    days,
    changes,
    name: (id: DeliveryTariffId) => t(`tariffs.${id}`),
  };
};
