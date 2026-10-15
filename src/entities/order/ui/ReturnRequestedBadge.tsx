import { memo } from "react";
import { Tooltip } from "antd";
import { Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { readReturnRequest } from "../model/returnRequest";

interface Props {
  order: unknown;
}

/** "Qaytarish so'ralgan" — sababi tooltipda. So'ralmagan buyurtmada hech narsa. */
const ReturnRequestedBadge = ({ order }: Props) => {
  const { t } = useTranslation("orders");
  const { requested, reason } = readReturnRequest(order);
  if (!requested) return null;

  const label = t("returnRequested");
  const reasonText = reason ? t("returnRequestedReason", { reason }) : null;

  return (
    <Tooltip title={reasonText}>
      <span
        data-testid="return-requested-badge"
        tabIndex={reasonText ? 0 : undefined}
        aria-label={reasonText ? `${label}. ${reasonText}` : label}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-400/50 bg-amber-100 px-2.5 py-1 text-[12px] font-semibold text-amber-800 dark:border-amber-400/35 dark:bg-amber-400/15 dark:text-amber-200"
      >
        <Undo2 size={12} aria-hidden="true" />
        {label}
      </span>
    </Tooltip>
  );
};

export default memo(ReturnRequestedBadge);
