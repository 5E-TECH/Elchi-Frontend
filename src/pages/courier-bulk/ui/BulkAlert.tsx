// dizayn-v2: courier-courier-bulk-main, manager-courier-bulk-main, courier-courier-bulk-confirm-dialog
import type { ReactNode } from "react";
import { CircleX, TriangleAlert, type LucideIcon } from "lucide-react";
import { cx } from "../../../shared/lib/cx";
import { TONE_SOFT } from "../../../shared/ui/primitives";

type BulkAlertTone = "warning" | "danger";

const ICON: Record<BulkAlertTone, LucideIcon> = { warning: TriangleAlert, danger: CircleX };

/**
 * `.el-alert` (CODE-MAP 2.7): skan topilmadi (danger, `role="alert"`) va tasdiq oynasidagi «Bu amalni ortga
 * qaytarib bo'lmaydi» (warning, `role="note"` — maket `courier-courier-bulk-confirm-dialog`).
 */
export const BulkAlert = ({
  tone,
  title,
  children,
  role,
  className,
  "data-testid": testId,
}: {
  tone: BulkAlertTone;
  title?: ReactNode;
  children?: ReactNode;
  role?: "alert" | "status" | "note";
  className?: string;
  "data-testid"?: string;
}) => {
  const Icon = ICON[tone];
  return (
    <div
      role={role ?? (tone === "danger" ? "alert" : "status")}
      data-testid={testId}
      className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT[tone], className)}
    >
      <Icon size={20} aria-hidden="true" className="mt-px shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-text">
        {title != null ? <div className="font-bold">{title}</div> : null}
        {children != null ? <div className={cx(title != null && "text-[13px]")}>{children}</div> : null}
      </div>
    </div>
  );
};
