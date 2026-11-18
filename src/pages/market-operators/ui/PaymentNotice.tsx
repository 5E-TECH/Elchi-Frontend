// dizayn-v2: (maket yo'q) market_operator-earnings
import type { ReactNode } from "react";
import { Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cx } from "../../../shared/lib/cx";

const NOTICE_TONE: Record<"info" | "warning", { box: string; icon: LucideIcon }> = {
  info: { box: "bg-info-soft text-info-fg", icon: Info },
  warning: { box: "bg-warning-soft text-warning-fg", icon: TriangleAlert },
};

/**
 * Eslatma qutisi (`.el-alert`, CODE-MAP): «Elchi kassasiga ta'sir qilmaydi …» (F2qp6FtE). Sahifalararo import
 * qilinmaydi (FSD) — `pages/payments` dagi `CardNotice` retsepti.
 */
export const PaymentNotice = ({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "warning";
  children: ReactNode;
  className?: string;
}) => {
  const Icon = NOTICE_TONE[tone].icon;
  return (
    <div className={cx("flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px] leading-5", NOTICE_TONE[tone].box, className)}>
      <Icon aria-hidden="true" size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 text-text">{children}</div>
    </div>
  );
};
