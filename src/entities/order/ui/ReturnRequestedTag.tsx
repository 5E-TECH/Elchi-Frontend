// dizayn-v2: (maket yo'q) superadmin-orders-list
import { memo } from "react";
import { Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "../../../shared/ui/primitives/Badge";
import { readReturnRequest } from "../model/returnRequest";

/**
 * «Qaytarish so'ralgan» — ro'yxatdagi holat yonida (dizayn v2). Maket yo'q — eng yaqini
 * `superadmin-orders-list` holat ustuni: `Badge` (`warning`, `Undo2` ikonka). Sabab — maslahatda va
 * ekran o'quvchi nomida. So'ralmagan buyurtmada hech narsa. Buyurtma tafsiloti sarlavhasida ham shu belgi.
 */
export const ReturnRequestedTag = memo(({ order }: { order: unknown }) => {
  const { t } = useTranslation("orders");
  const { requested, reason } = readReturnRequest(order);
  if (!requested) return null;

  const label = t("returnRequested");
  const reasonText = reason ? t("returnRequestedReason", { reason }) : null;

  return (
    <Badge
      tone="warning"
      icon={Undo2}
      data-testid="return-requested-badge"
      title={reasonText ?? undefined}
      aria-label={reasonText ? `${label}. ${reasonText}` : label}
    >
      {label}
    </Badge>
  );
});
ReturnRequestedTag.displayName = "ReturnRequestedTag";
