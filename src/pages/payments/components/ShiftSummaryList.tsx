// dizayn-v2: superadmin-payments-main-cashbox-shift-open-dialog, superadmin-payments-main-cashbox-shift-dialog, superadmin-payments-main-cashbox-shift-result-dialog
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../../shared/lib/cx";

/**
 * Smena oynalaridagi «atama — qiymat» bloki (maket: `<dl>` `padding: 4px 16px; border-radius: 12px;
 * background: var(--sunken)`, qatorlar orasida `border-top`). Qiymat sukut bo'yicha qalin (`emphasis`), `strong`
 * qatorda atama ham qalin («Jami», «Farq»).
 */

export type ShiftSummaryRow = {
  key: string;
  label: ReactNode;
  value: ReactNode;
  icon?: LucideIcon;
  /** Atama ham qalin (yakuniy qator). */
  strong?: boolean;
  /** Qiymat qalin emas (oddiy matn). */
  plain?: boolean;
};

type ShiftSummaryListProps = {
  rows: ShiftSummaryRow[];
  label?: string;
  className?: string;
};

const ShiftSummaryList = ({ rows, label, className }: ShiftSummaryListProps) => (
  <dl aria-label={label} className={cx("m-0 flex flex-col rounded-xl bg-sunken px-4 py-1 text-sm", className)}>
    {rows.map((row, index) => {
      const Icon = row.icon;
      return (
        <div
          key={row.key}
          className={cx(
            "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2",
            index > 0 && "border-t border-border",
          )}
        >
          <dt className={cx("inline-flex items-center gap-2", row.strong ? "font-semibold text-text" : "text-text-muted")}>
            {Icon ? <Icon aria-hidden="true" size={16} className="shrink-0" /> : null}
            {row.label}
          </dt>
          <dd
            className={cx(
              "m-0 inline-flex flex-wrap items-center justify-end gap-2 text-text",
              row.plain ? "font-normal" : "font-semibold",
            )}
          >
            {row.value}
          </dd>
        </div>
      );
    })}
  </dl>
);

export default ShiftSummaryList;
