// dizayn-v2: tizim-charts
import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";
import { MINUS_SIGN, formatPercentLocalized } from "../../lib/formatMoney";
import { TONE_SOFT } from "../primitives";

export interface DeltaChipProps {
  /** O'zgarish (foiz yoki p.p.). Ishora yo'nalishni beradi. */
  value: number;
  /** Qaysi yo'nalish yaxshi (sukut `up`); `none` — neytral kulrang. */
  goodWhen?: "up" | "down" | "none";
  /** Matn (`+2,4 p.p.`, `−25 daq`); berilmasa — `+6,4%`. */
  text?: ReactNode;
  className?: string;
}

/**
 * DELTA CHIPI (`.el-delta`, `.is-up/.is-down` × `.is-good/.is-bad`) — grafik sarlavhasidagi
 * «+2,4 p.p.» va xulosa raqamlari ostidagi «+8,9%». Rang = yo'nalish × yaxshi/yomon, o'q bilan birga.
 */
export const DeltaChip = ({ value, goodWhen = "up", text, className }: DeltaChipProps) => {
  const { i18n } = useTranslation();
  const flat = text == null ? Math.round(Math.abs(value) * 10) === 0 : value === 0;
  const direction = flat ? "flat" : value > 0 ? "up" : "down";
  const quality = direction === "flat" || goodWhen === "none" ? "neutral" : direction === goodWhen ? "success" : "danger";
  const sign = direction === "up" ? "+" : direction === "down" ? MINUS_SIGN : "";
  const label = text ?? `${sign}${formatPercentLocalized(Math.abs(value), { language: i18n.language })}`;
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : null;
  return (
    <span
      data-delta=""
      data-direction={direction}
      className={cx(
        "inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-xs font-bold leading-none",
        TONE_SOFT[quality],
        className,
      )}
    >
      {Icon ? <Icon size={14} aria-hidden="true" className="shrink-0" /> : null}
      {label}
    </span>
  );
};
