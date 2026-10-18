// dizayn-v2: registrator-dispatch-list, manager-dispatch-scan
import type { ReactNode } from "react";
import { CircleX, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cx } from "../../../shared/lib/cx";
import { Spinner, TONE_SOFT } from "../../../shared/ui/primitives";

export type DispatchAlertTone = "info" | "warning" | "danger";

const DEFAULT_ICON: Record<DispatchAlertTone, LucideIcon> = {
  info: Info,
  warning: TriangleAlert,
  danger: CircleX,
};

type DispatchAlertProps = {
  tone: DispatchAlertTone;
  /** Qalin sarlavha (`.el-alert-title`). */
  title?: ReactNode;
  /** Matn (`.el-alert-body`); sarlavha bo'lsa — 13 px kulrang ikkinchi qator. */
  children?: ReactNode;
  /** Matn ostidagi amal («Qayta urinish»). */
  action?: ReactNode;
  /** Ikonka o'rnida spinner («N ta buyurtma tekshirilmoqda...»). */
  busy?: boolean;
  /** Sukut: `danger` → `alert`, qolganlari → `status`. */
  role?: "status" | "alert";
  className?: string;
};

/**
 * Sahifa ogohlantirishi — maketdagi `.el-alert` (CODE-MAP 2.7): ton foni, ton rangidagi ikonka, neytral matn.
 * Maketlar: `registrator-dispatch-list` / `manager-dispatch-scan` («Sahifa holatlari»: takror, xato skan,
 * tekshirilmoqda, kuryerlar yuklanmadi, filialda kuryer yo'q).
 */
export const DispatchAlert = ({ tone, title, children, action, busy = false, role, className }: DispatchAlertProps) => {
  const Icon = DEFAULT_ICON[tone];
  const hasTitle = title != null && title !== false && title !== "";
  const hasBody = children != null && children !== false && children !== "";

  return (
    <div
      role={role ?? (tone === "danger" ? "alert" : "status")}
      data-tone={tone}
      className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT[tone], className)}
    >
      {busy ? (
        <Spinner size="sm" className="mt-0.5 shrink-0" />
      ) : (
        <Icon size={20} aria-hidden="true" className="mt-px shrink-0" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-text">
        {hasTitle ? <div className="font-bold">{title}</div> : null}
        {hasBody ? (
          <div className={cx("wrap-break-word", hasTitle && "text-[13px] leading-[18px] text-text-muted")}>{children}</div>
        ) : null}
        {action ? <div className="flex flex-wrap gap-2 pt-2">{action}</div> : null}
      </div>
    </div>
  );
};
