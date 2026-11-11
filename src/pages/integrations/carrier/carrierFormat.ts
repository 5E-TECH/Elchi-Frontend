import { useTranslation } from "react-i18next";
import type { CarrierAccount } from "../../../entities/integrations/carriers";
import { formatPhone } from "../../../shared/lib/formatPhone";
import type { CarrierCourier, CourierInfo } from "./carrierModel";

/** «+998 90 977 40 40 · Toshkent HQ». */
export const courierSubline = (courier: CarrierCourier) =>
  [courier.phone ? formatPhone(courier.phone) : "", courier.branch?.name ?? ""]
    .filter(Boolean)
    .join(" · ");

/** Kuryer nomi yoki «Kuryer ID n» (ma'lumot kelmagan / o'chirilgan). */
export const useCourierName = () => {
  const { t } = useTranslation("integrations");
  return (account: CarrierAccount, info: CourierInfo | undefined) =>
    info?.state === "ready" && info.courier.name
      ? info.courier.name
      : t("carrier.courierIdOnly", { id: account.courier_user_id });
};
