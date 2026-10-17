// dizayn-v2: tizim-charts
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";
import { formatCompactMoneyLocalized } from "../../lib/formatMoney";

export interface WaterfallStep {
  key: string;
  label: string;
  /** `up`/`down` — o'zgarish miqdori (ishorasi `kind` dan, qiymat moduli olinadi); `start`/`total` — daraja. */
  value: number;
  kind: "start" | "up" | "down" | "total";
}

export interface WaterfallProps {
  steps: WaterfallStep[];
  ariaLabel: string;
  /** Ustun ustidagi yorliq (sukut — ixcham pul, valyutasiz: «24,6 mln», «+11,4 mln»). */
  formatValue?: (step: WaterfallStep) => string;
  className?: string;
}

// O'sish — ko'k, kamayish — qizil (ikki qutbli, `tizim-charts`), boshlanish va jami — neytral.
const BAR: Record<WaterfallStep["kind"], string> = {
  start: "bg-text-muted",
  up: "bg-chart-1",
  down: "bg-chart-8",
  total: "bg-text-muted",
};

/** Har qadamning past/yuqori darajasi (yig'ma hisob). */
const waterfallBars = (steps: WaterfallStep[]) => {
  let running = 0;
  return steps.map((step) => {
    const amount = Math.abs(step.value);
    let from = running;
    let to = running;
    if (step.kind === "start" || step.kind === "total") {
      from = 0;
      to = step.value;
    } else if (step.kind === "up") {
      to = running + amount;
    } else {
      to = running - amount;
    }
    running = to;
    return { step, low: Math.min(from, to), high: Math.max(from, to), end: to };
  });
};

/**
 * SHARSHARA (`.el-waterfall`, `.el-wf-*`): qo'shiladi va ayiriladi — «Pochta kassasi + Yo'ldagi pul −
 * Marketlar = Joriy holat». Oddiy div (recharts emas). Manfiy daraja ham chiziladi (nol chizig'i).
 */
export const Waterfall = ({ steps, ariaLabel, formatValue, className }: WaterfallProps) => {
  const { i18n } = useTranslation();
  const language = i18n.language;

  const bars = waterfallBars(steps);

  const top = Math.max(0, ...bars.map((bar) => bar.high));
  const bottom = Math.min(0, ...bars.map((bar) => bar.low));
  const span = top - bottom || 1;
  const pct = (value: number) => ((value - bottom) / span) * 100;

  const label = (step: WaterfallStep) => {
    if (formatValue) return formatValue(step);
    const text = formatCompactMoneyLocalized(Math.abs(step.value), { language, withCurrency: false });
    if (step.kind === "up") return `+${text}`;
    if (step.kind === "down") return `−${text}`;
    return formatCompactMoneyLocalized(step.value, { language, withCurrency: false });
  };

  return (
    <figure role="img" aria-label={ariaLabel} className={cx("m-0 flex min-w-0 flex-col gap-2", className)}>
      <div className="relative grid h-[180px] auto-cols-fr grid-flow-col gap-1 pt-6 max-md:h-[150px]">
        {bottom < 0 ? (
          <span aria-hidden="true" className="absolute inset-x-0 border-t border-border" style={{ bottom: `${pct(0)}%` }} />
        ) : null}
        {bars.map((bar, index) => {
          const next = bars[index + 1];
          return (
            <div key={bar.step.key} className="relative h-full min-w-0">
              <span
                data-wf-bar={bar.step.kind}
                className={cx("absolute left-1/2 -ml-3 w-6 rounded-[4px]", BAR[bar.step.kind])}
                style={{ bottom: `${pct(bar.low)}%`, height: `max(2px, ${pct(bar.high) - pct(bar.low)}%)` }}
              />
              <span
                className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold text-text"
                style={{ bottom: `calc(${pct(bar.high)}% + 4px)` }}
              >
                {label(bar.step)}
              </span>
              {next && next.step.kind !== "start" ? (
                // Bog'lovchi: shu ustun oxiridan keyingisining boshigacha.
                <span
                  aria-hidden="true"
                  className="absolute left-[calc(50%+12px)] w-[calc(100%-20px)] border-t border-border"
                  style={{ bottom: `${pct(bar.end)}%` }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <div aria-hidden="true" className="grid auto-cols-fr grid-flow-col gap-1 border-t border-border pt-2 text-center text-xs text-text-muted">
        {steps.map((step) => (
          <span key={step.key} className="min-w-0 [overflow-wrap:anywhere]">
            {step.label}
          </span>
        ))}
      </div>
    </figure>
  );
};
