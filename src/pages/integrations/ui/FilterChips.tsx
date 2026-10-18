// dizayn-v2: superadmin-integrations-panel-shipments, superadmin-integrations-panel-events, superadmin-integrations-panel-settlement
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Pressable } from "../../../shared/ui/primitives";

export type FilterChipOption<V extends string = string> = {
  value: V;
  label: string;
  /** Son — `null`/`undefined` bo'lsa ko'rsatilmaydi («hali sanalmagan» ≠ «nol»). */
  count?: number | null;
  icon?: LucideIcon;
  /** Sonning ma'no rangi (maket: «Yiqilgan 3» — danger, «Nomuvofiqlik 2» — warning). */
  countTone?: "danger" | "warning";
};

/**
 * FILTR CHIPLARI — maketdagi `.el-chip` (`aria-pressed`, CODE-MAP 2.2): bitta qiymat tanlanadi,
 * har chipda ixtiyoriy son. Eski `FilterPills` (v1 binafsha) o'rniga.
 *
 * ⚠️ `count` `null` ni ham qabul qiladi: «hali sanalmagan» va «nol» bir xil emas — `null` da son
 * umuman chizilmaydi, `0` deb ko'rsatish «bo'sh» degan yolg'on bo'lardi.
 */
export const FilterChips = <V extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  trailing,
}: {
  value: V;
  onChange: (next: V) => void;
  options: readonly FilterChipOption<V>[];
  ariaLabel: string;
  className?: string;
  /** Chiplardan keyingi qo'shimcha (masalan «Yangilash» tugmasi) — o'ngga suriladi. */
  trailing?: ReactNode;
}) => {
  const { i18n } = useTranslation();
  return (
    <div className={cx("flex min-w-0 flex-wrap items-center gap-2", className)}>
      <div role="group" aria-label={ariaLabel} className="flex min-w-0 flex-[1_1_auto] flex-wrap items-center gap-2">
        {options.map((option) => {
          const active = option.value === value;
          const Icon = option.icon;
          return (
            <Pressable
              key={option.value}
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={cx(
                "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-border-strong bg-surface px-3 text-[13px] font-medium text-text",
                "transition-[background-color,border-color,color] duration-150 hover:border-text-subtle motion-reduce:transition-none",
                "aria-pressed:border-action aria-pressed:bg-action-soft aria-pressed:font-semibold aria-pressed:text-action-fg max-md:h-11",
              )}
            >
              {Icon ? <Icon size={14} aria-hidden="true" className="shrink-0" /> : null}
              <span>{option.label}</span>
              {option.count != null ? (
                <span
                  className={cx(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
                    active
                      ? "bg-surface text-action-fg"
                      : option.countTone === "danger"
                        ? "bg-danger-soft text-danger-fg"
                        : option.countTone === "warning"
                          ? "bg-warning-soft text-warning-fg"
                          : "bg-sunken text-text-muted",
                  )}
                >
                  {formatNumberLocalized(option.count, { language: i18n.language })}
                </span>
              ) : null}
            </Pressable>
          );
        })}
      </div>
      {trailing ? <div className="ml-auto flex flex-none items-center gap-2">{trailing}</div> : null}
    </div>
  );
};

export default FilterChips;
