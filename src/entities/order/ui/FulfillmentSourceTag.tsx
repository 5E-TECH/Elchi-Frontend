// dizayn-v2: (maket yo'q) superadmin-neworders-create-manual-source
import { memo } from "react";
import { Warehouse } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "../../../shared/ui/primitives/Badge";
import { readFulfillmentSource } from "../model/fulfillment";

/**
 * «Ombordan · <ombor nomi>» — buyurtma viloyat ombori orqali ketadi (6kHnNH9j). Maket yo'q — eng yaqini
 * `superadmin-neworders-create-manual-source` dagi «Yangi buyurtmalar» kartasi: neytral `.el-badge` «Ombordan»;
 * ombor nomi qo'shildi (qaysi filial terib beradi). HQ buyurtmasida hech narsa.
 */
export const FulfillmentSourceTag = memo(({ order, className }: { order: unknown; className?: string }) => {
  const { t } = useTranslation("orders");
  const { fromWarehouse, warehouseName } = readFulfillmentSource(order);
  if (!fromWarehouse) return null;
  const label = warehouseName ? t("fulfillment.tagNamed", { name: warehouseName }) : t("fulfillment.tag");
  return (
    <Badge
      icon={Warehouse}
      data-testid="fulfillment-source-badge"
      title={t("fulfillment.tagTitle")}
      className={className}
    >
      <span className="max-w-[240px] truncate">{label}</span>
    </Badge>
  );
});
FulfillmentSourceTag.displayName = "FulfillmentSourceTag";
