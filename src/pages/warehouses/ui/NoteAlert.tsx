// dizayn-v2: superadmin-warehouse-create-dialog, superadmin-warehouse-stock-in-dialog, manager-warehouse-detail, market-products-warehouse-stock
import type { ReactNode } from "react";
import { Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cx } from "../../../shared/lib/cx";
import { TONE_FG, TONE_SOFT } from "../../../shared/ui/primitives";

/**
 * Izoh bloki — maketdagi `.el-alert.el-tone-info` (CODE-MAP 2.7, `role="note"`): ton foni, ton rangidagi ikonka (18),
 * qalin sarlavha, 13 px matn. Matn neytral (`text-text`) — faqat ikonka ton rangida.
 */
export const NoteAlert = ({
  tone = "info",
  title,
  children,
  icon,
  className,
}: {
  tone?: "info" | "warning";
  title?: ReactNode;
  children?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) => {
  const Icon = icon ?? (tone === "warning" ? TriangleAlert : Info);
  return (
    <div role="note" className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT[tone], className)}>
      <Icon size={18} aria-hidden="true" className={cx("mt-px shrink-0", TONE_FG[tone])} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-text">
        {title ? <p className="m-0 font-bold">{title}</p> : null}
        {children ? <div className="text-[13px] leading-[18px] wrap-break-word">{children}</div> : null}
      </div>
    </div>
  );
};
