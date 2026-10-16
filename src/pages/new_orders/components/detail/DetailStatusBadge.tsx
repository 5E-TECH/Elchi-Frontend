// dizayn-v2: superadmin-orders-detail, admin-orders-detail, manager-orders-detail, registrator-orders-detail, market-orders-detail, courier-orders-detail
import { useTranslation } from "react-i18next";
import { OrderStatusBadge } from "../../../../entities/order";
import { StatusBadge } from "../../../../shared/ui/primitives";

const canonical = (status: unknown) =>
  typeof status === "string" ? status.trim().toLowerCase().replace(/[\s_()-]+/g, " ").trim() : "";

/**
 * Tafsilot sahifasidagi holat belgisi. Registrdagi 11 holat — `OrderStatusBadge`. Tafsilotda
 * ko'rinadigan, lekin registrda yo'q holatlar o'z nomi bilan (ilgari sahifa ularni ham ko'rsatardi):
 *  - `returned_to_market` — «Marketga qaytarilgan» (neytral; `OrderStatusBadge` ro'yxat uchun uni
 *    «Bekor qilingan» deydi — e2e `order-return` shu yorliqni kutadi);
 *  - `processing` / `completed` — «Qabul va yaratish» oqimi holatlari («Jarayonda», «Tayyor»).
 */
export const DetailStatusBadge = ({ status, className }: { status: unknown; className?: string }) => {
  const { t } = useTranslation(["orders", "newOrders"]);
  switch (canonical(status)) {
    case "returned to market":
      return <StatusBadge tone="neutral" label={t("statusReturnedToMarket")} className={className} />;
    case "processing":
      return <StatusBadge tone="warning" label={t("statusProcessing", { ns: "newOrders" })} className={className} />;
    case "completed":
      return <StatusBadge tone="info" label={t("statusCompleted", { ns: "newOrders" })} className={className} />;
    default:
      return <OrderStatusBadge status={status} className={className} />;
  }
};
