// dizayn-v2: superadmin-orders-detail, admin-orders-detail, manager-orders-detail, registrator-orders-detail, market-orders-detail, courier-orders-detail
import { useTranslation } from "react-i18next";
import { OrderStatusBadge } from "../../../../entities/order";
import { StatusBadge } from "../../../../shared/ui/primitives";

const canonical = (status: unknown) =>
  typeof status === "string" ? status.trim().toLowerCase().replace(/[\s_()-]+/g, " ").trim() : "";

/**
 * Tafsilot sahifasidagi holat belgisi. Registrdagi 13 holat (shu jumladan «Marketga qaytarilgan»,
 * «Mijoz kutilmoqda» — SllBYhnt) — `OrderStatusBadge`. Registrda yo'q holatlar o'z nomi bilan:
 *  - `processing` / `completed` — «Qabul va yaratish» oqimi holatlari («Jarayonda», «Tayyor»).
 */
export const DetailStatusBadge = ({ status, className }: { status: unknown; className?: string }) => {
  const { t } = useTranslation(["orders", "newOrders"]);
  switch (canonical(status)) {
    case "processing":
      return <StatusBadge tone="warning" label={t("statusProcessing", { ns: "newOrders" })} className={className} />;
    case "completed":
      return <StatusBadge tone="info" label={t("statusCompleted", { ns: "newOrders" })} className={className} />;
    default:
      return <OrderStatusBadge status={status} className={className} />;
  }
};
