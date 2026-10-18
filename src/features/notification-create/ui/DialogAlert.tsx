// dizayn-v2: superadmin-notifications-create-dialog
import type { ReactNode } from "react";
import { Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cx } from "../../../shared/lib/cx";
import { TONE_SOFT } from "../../../shared/ui/primitives";

type DialogAlertTone = "info" | "warning";

const ICON: Record<DialogAlertTone, LucideIcon> = { info: Info, warning: TriangleAlert };

/**
 * Oyna ichidagi ogohlantirish — maket `.el-alert` (CODE-MAP 2.7): ton foni, ton rangidagi ikonka, qalin
 * sarlavha va neytral matn. Maket: «Telegram guruhga bildirishnoma ulash» (`info`).
 */
const DialogAlert = ({
  tone,
  title,
  children,
  className,
}: {
  tone: DialogAlertTone;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) => {
  const Icon = ICON[tone];
  return (
    <div
      role={tone === "warning" ? "alert" : "note"}
      className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT[tone], className)}
    >
      <Icon size={18} aria-hidden="true" className="mt-px shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-text">
        <div className="font-bold">{title}</div>
        {children ? <div className="text-[13px] leading-[18px] wrap-break-word">{children}</div> : null}
      </div>
    </div>
  );
};

export default DialogAlert;
