// dizayn-v2: (maket yo'q) superadmin-orders-list
import { memo } from "react";
import { Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "../../../shared/ui/primitives/Badge";
import { formatReplacementOrderRef, readOrderReplacement } from "../model/orderReplacement";

const RETURN_STATE_KEYS = {
  awaiting_old_pickup: "replacementTag.returnAwaiting",
  old_collected: "replacementTag.returnCollected",
  old_returned: "replacementTag.returnReturned",
} as const;

/**
 * ALMASHTIRISH BELGISI (lQjt6sKP) — ro'yxat qatorida holat yonida va buyurtma tafsiloti sarlavhasida. Maket yo'q —
 * `ReturnRequestedTag` naqshida: `Badge` (`warning`, `Repeat` ikonka — BeePost `ReplacementBadge` dagi ikonka).
 *  - yangi buyurtma (`replacement_of_order_id`): «Almashtirish», maslahatda «… eski №EL-… o'rniga»;
 *  - eski buyurtma (`is_replacement_return`): «Almashtirish qaytarmasi», maslahatda eski mahsulot qayerdaligi.
 * Oddiy buyurtmada hech narsa.
 */
export const ReplacementTag = memo(({ order }: { order: unknown }) => {
  const { t } = useTranslation("orders");
  const info = readOrderReplacement(order);

  if (info.isReplacement && info.oldOrderId) {
    const label = t("replacementTag.replacement");
    const hint = t("replacementTag.replacementTitle", { ref: formatReplacementOrderRef(info.oldOrderId) });
    return (
      <Badge tone="warning" icon={Repeat} data-testid="replacement-badge" title={hint} aria-label={`${label}. ${hint}`}>
        {label}
      </Badge>
    );
  }

  if (info.isReplacementReturn) {
    const label = t("replacementTag.return");
    const hint = info.state ? t(RETURN_STATE_KEYS[info.state]) : null;
    return (
      <Badge
        tone="warning"
        icon={Repeat}
        data-testid="replacement-return-badge"
        title={hint ?? undefined}
        aria-label={hint ? `${label}. ${hint}` : label}
      >
        {label}
      </Badge>
    );
  }

  return null;
});
ReplacementTag.displayName = "ReplacementTag";
