import { useTranslation } from "react-i18next";
import { normalizeOrderStatus, ORDER_STATUS_NS, ORDER_STATUS_REGISTRY } from "../../../entities/order";
import { humanize, normalizeKey } from "./describeTrackingEvent";

/** Holat yorlig'i (matn) — «Yangi ›» kabi o'tishning chap tomoni uchun. */
export const useTrackingStatusLabel = () => {
  const { t } = useTranslation("orders");
  return (status: string | null | undefined) => {
    const key = normalizeOrderStatus(status);
    if (key) return t(ORDER_STATUS_REGISTRY[key].labelKey, { ns: ORDER_STATUS_NS });
    if (!status) return "—";
    return t(`tracking.status.${normalizeKey(status)}`, { defaultValue: "" }) || humanize(status);
  };
};
