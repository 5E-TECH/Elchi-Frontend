// dizayn-v2: superadmin-orders-detail, admin-orders-detail, manager-orders-detail, registrator-orders-detail, market-orders-detail, courier-orders-detail, superadmin-orders-detail-cancelled, manager-orders-detail-cancelled, market-orders-detail-cancelled
import { useTranslation } from "react-i18next";
import { OrderStatusBadge } from "../../../../entities/order";
import { StatusBadge } from "../../../../shared/ui/primitives";

const canonical = (status: unknown) =>
  typeof status === "string" ? status.trim().toLowerCase().replace(/[\s_()-]+/g, " ").trim() : "";

/**
 * Tafsilot sahifasidagi holat belgisi. Registrdagi 13 holat (shu jumladan «Marketga topshirildi», «Mijoz kutilmoqda» —
 * SllBYhnt) — `OrderStatusBadge`; bekor qilingan buyurtma (`order` berilsa) — joy bosqichi («Bekor · HQ'da»,
 * «Marketga topshirildi»; maketlar `*-orders-detail-cancelled`). Registrda yo'q «Qabul va yaratish» oqimi holatlari
 * o'z nomi bilan: `processing` / `completed` — «Jarayonda», «Tayyor».
 */
export const DetailStatusBadge = ({
  status,
  order,
  className,
}: {
  status: unknown;
  order?: unknown;
  className?: string;
}) => {
  const { t } = useTranslation(["orders", "newOrders"]);
  switch (canonical(status)) {
    case "processing":
      return <StatusBadge tone="warning" label={t("statusProcessing", { ns: "newOrders" })} className={className} />;
    case "completed":
      return <StatusBadge tone="info" label={t("statusCompleted", { ns: "newOrders" })} className={className} />;
    default:
      return <OrderStatusBadge status={status} order={order} className={className} />;
  }
};
