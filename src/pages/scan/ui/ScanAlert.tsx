// dizayn-v2: superadmin-scan-result, manager-scan-result, registrator-scan-result, courier-scan-order-detail, courier-scan-package-detail, courier-scan-post-detail
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../../shared/lib/cx";
import { TONE_SOFT } from "../../../shared/ui/primitives";

type ScanAlertProps = {
  tone: "success" | "danger" | "info" | "warning";
  icon: LucideIcon;
  /** Qalin birinchi qator (`.el-alert-title`). */
  title: ReactNode;
  /** Ikkinchi qator (`.el-small .el-muted`). */
  children?: ReactNode;
  role?: "status" | "alert";
  /** Telefondagi ixcham ko'rinish (maket: `padding: 10px 12px`, sarlavha 13px, matn 12px). */
  compact?: boolean;
  className?: string;
  "data-testid"?: string;
};

/**
 * Skaner natijasi ogohlantirishi — maketdagi `.el-alert` (CODE-MAP 2.7): ikonka (ton rangida) + qalin
 * sarlavha + yordamchi matn. «QR muvaffaqiyatli o'qildi», «Bu QR kod skaner uchun yaroqsiz», amal natijasi
 * (O'zimga olish / Qabul qilish), «Kuryerda: …».
 */
export const ScanAlert = ({
  tone,
  icon: Icon,
  title,
  children,
  role,
  compact = false,
  className,
  "data-testid": testId,
}: ScanAlertProps) => (
  <div
    role={role}
    data-testid={testId}
    className={cx(
      "flex rounded-xl",
      compact ? "items-center gap-2.5 px-3 py-2.5" : "items-start gap-3 px-4 py-3 text-sm",
      TONE_SOFT[tone],
      className,
    )}
  >
    <Icon size={20} aria-hidden="true" className={cx("shrink-0", !compact && "mt-px")} />
    <div className="flex min-w-0 flex-1 flex-col text-text [overflow-wrap:anywhere]">
      <div className={cx("font-bold", compact && "text-[13px]")}>{title}</div>
      {children ? (
        <div className={cx("text-text-muted", compact ? "text-xs" : "text-[13px]")}>{children}</div>
      ) : null}
    </div>
  </div>
);
