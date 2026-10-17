// dizayn-v2: superadmin-regions-map, admin-regions-map, manager-regions-scoped, courier-regions-scoped
import type { ReactNode } from "react";
import { cx } from "../../../shared/lib/cx";
import { CHART_FILL } from "../../../shared/ui/charts";

/** KPI ostidagi meter qatori: «Jamidan ulushi … 77,2%» (telefonda qisqa yorliq — maket `SM`). */
export const KpiMeter = ({
  label,
  shortLabel,
  value,
  children,
}: {
  label: ReactNode;
  shortLabel?: ReactNode;
  value: ReactNode;
  children: ReactNode;
}) => (
  <div className="mt-auto flex min-w-0 flex-col gap-1.5 pt-2">
    <span className="flex min-w-0 items-center justify-between gap-2 text-xs text-text-muted">
      <span className="min-w-0 truncate">
        {shortLabel != null ? (
          <>
            <span className="max-md:hidden">{label}</span>
            <span className="md:hidden">{shortLabel}</span>
          </>
        ) : (
          label
        )}
      </span>
      <span className="shrink-0 font-semibold text-text proportional-nums">{value}</span>
    </span>
    {children}
  </div>
);

export interface SummaryItem {
  key: string;
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
}

/** Xulosa qatori (`.el-summary`, karta ichida `bg-sunken`): yorliq · qiymat · izoh. */
export const SummaryRow = ({ items, className }: { items: SummaryItem[]; className?: string }) => (
  <dl
    className={cx(
      "m-0 grid gap-4 rounded-xl bg-sunken px-4 py-3.5 max-md:grid-cols-1 max-md:gap-3",
      items.length === 3 ? "grid-cols-3" : "grid-cols-2",
      className,
    )}
  >
    {items.map((item) => (
      <div key={item.key} className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-xs text-text-muted">{item.label}</dt>
        <dd className="m-0 flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-text">{item.value}</span>
          {item.meta != null ? <span className="text-xs text-text-muted">{item.meta}</span> : null}
        </dd>
      </div>
    ))}
  </dl>
);

/** Holat chizig'i (sotilgan · jarayonda · bekor) — jadval va reyting qatorida, bezak (ma'nosi yonidagi matnda). */
export const StatusBar = ({
  sold,
  pending,
  cancelled,
  ariaLabel,
  className,
}: {
  sold: number;
  pending: number;
  cancelled: number;
  ariaLabel?: string;
  className?: string;
}) => {
  const parts = [
    { key: "sold", value: sold, fill: CHART_FILL.success },
    { key: "pending", value: pending, fill: CHART_FILL.warning },
    { key: "cancelled", value: cancelled, fill: CHART_FILL.danger },
  ].filter((part) => part.value > 0);
  return (
    <span
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={cx("flex h-1.5 min-w-0 gap-0.5", className)}
    >
      {parts.length > 0 ? (
        parts.map((part) => (
          <span
            key={part.key}
            className={cx("block min-w-1 first:rounded-l-[3px] last:rounded-r-[3px]", part.fill)}
            style={{ flex: `${part.value} 1 0` }}
          />
        ))
      ) : (
        <span className="block flex-1 rounded-[3px] bg-sunken" />
      )}
    </span>
  );
};
