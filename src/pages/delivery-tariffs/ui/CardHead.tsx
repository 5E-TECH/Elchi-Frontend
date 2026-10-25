// dizayn-v2: superadmin-regions-delivery-tariffs, admin-regions-delivery-tariffs
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Karta sarlavhasi (maket `.el-card-head`: `.el-stat-icon` + `.el-h2` + `.el-small.el-muted`). `Card` sarlavhasida
 * ikonka joyi yo'q — karta `padding="none"` + `aria-labelledby={id}` bilan shu bo'lakni ishlatadi.
 */
export const CardHead = ({
  id,
  icon: Icon,
  title,
  description,
}: {
  id: string;
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
}) => (
  <div className="flex min-w-0 items-center gap-3 border-b border-border px-5 py-4 max-md:px-4">
    <span
      aria-hidden="true"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
    >
      <Icon size={18} strokeWidth={2} />
    </span>
    <div className="flex min-w-0 flex-col gap-0.5">
      <h2 id={id} className="m-0 text-base font-bold text-text">
        {title}
      </h2>
      {description ? <p className="m-0 text-[13px] leading-[18px] text-text-muted">{description}</p> : null}
    </div>
  </div>
);
