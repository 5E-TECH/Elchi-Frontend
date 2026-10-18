// dizayn-v2: superadmin-neworders-incoming-sources, admin-neworders-incoming-sources, manager-new-orders-incoming-sources
import type { TFunction } from "i18next";
import { Clock } from "lucide-react";
import { cx } from "../../../shared/lib/cx";
import { Badge } from "../../../shared/ui/primitives";
import { WAIT_METER_MAX_HOURS, WAIT_METER_TARGET_PERCENT, waitMeterPercent, type Waiting } from "../lib";
import { chartBg, waitingText } from "./sourceFormat";

/** Rang belgisi (maket `.el-legend-key`): kvadrat 12 px yoki legenda nuqtasi 10 px. */
export const SourceKey = ({ colorIndex, shape = "square" }: { colorIndex: number | null; shape?: "square" | "dot" }) => (
  <span
    aria-hidden="true"
    className={cx(
      "inline-block shrink-0",
      shape === "dot" ? "size-2.5 rounded-full" : "size-3 rounded-[3px]",
      chartBg(colorIndex),
    )}
  />
);

/**
 * Eng eski posilka qancha kutgani: oddiy holatda kulrang `Clock` + matn, 3 kundan oshgan bo'lsa —
 * sariq badge «4 kun kutmoqda» (unutilgan manba e'tiborga tushsin; rang matn bilan birga).
 */
export const WaitingLabel = ({ t, waiting }: { t: TFunction; waiting: Waiting }) => {
  if (waiting.unit === "none") return <span className="text-text-muted">—</span>;
  const text = waitingText(t, waiting);
  if (waiting.stale) {
    return (
      <Badge tone="warning" icon={Clock}>
        {t("incoming.waitStale", { wait: text })}
      </Badge>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-text-muted">
      <Clock size={16} aria-hidden="true" className="shrink-0" />
      {text}
    </span>
  );
};

/**
 * Kutish o'lchagichi (maket `.el-meter.is-thin` + `.el-meter-target`): shkala 4 kun, tik chiziq —
 * 3 kunlik chegara. Oddiy holatda kulrang (`text-subtle`), chegaradan oshganda — sariq.
 */
export const WaitMeter = ({ waiting, label }: { waiting: Waiting; label: string }) => (
  <div
    role="meter"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={WAIT_METER_MAX_HOURS}
    aria-valuenow={Math.min(waiting.hours, WAIT_METER_MAX_HOURS)}
    className={cx("relative h-1.5 w-[140px] rounded-full", waiting.stale ? "bg-warning-soft" : "bg-sunken")}
  >
    <span
      className={cx("block h-full rounded-full", waiting.stale ? "bg-warning" : "bg-text-subtle")}
      style={{ width: `${waitMeterPercent(waiting)}%` }}
    />
    <span
      aria-hidden="true"
      className="absolute -inset-y-1 w-0.5 rounded-full bg-text"
      style={{ left: `${WAIT_METER_TARGET_PERCENT}%` }}
    />
  </div>
);
