// dizayn-v2: (maket yo'q) superadmin-balance-analysis, superadmin-payments-overview
import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PnlMonth } from "../../../entities/payments/financePnl";
import { MINUS_SIGN, formatCompactMoneyLocalized, formatSignedMoneyLocalized } from "../../../shared/lib/formatMoney";
import { buildTicks } from "../../payments/components/lib/chartScale";

/** O'q va tooltip uchun oy nomlari (joriy tilda). */
export type PnlMonthLabels = {
  /** `YYYY-MM` → «Noy». */
  short: (month: string) => string;
  /** `YYYY-MM` → «Noyabr 2026». */
  full: (month: string) => string;
};

type PlotRow = { month: string; gross: number; opex: number; net: number; otherIncome: number };

type PnlMonthlyChartProps = {
  months: readonly PnlMonth[];
  labels: PnlMonthLabels;
  /** Grafik mazmuni bir jumlada (ekran o'quvchi). */
  ariaLabel: string;
};

const AXIS_TICK = { fill: "var(--color-text-subtle)", fontSize: 12 } as const;

type TooltipText = { gross: string; opex: string; net: string; otherIncome: string };

type PnlTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: PlotRow }>;
  language: string;
  text: TooltipText;
  title: (month: string) => string;
};

/** `.el-tip` — `RAISED` karta: avval qiymat, keyin yorliq. Qo'lda kirim — chiziq ostida, alohida. */
const PnlTooltip = ({ active, payload, language, text, title }: PnlTooltipProps) => {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const signed = (value: number) => formatSignedMoneyLocalized(value, { language });
  return (
    <div className="flex min-w-[220px] flex-col gap-1.5 rounded-xl border border-border bg-raised px-3 py-2.5 shadow-xl">
      <span className="whitespace-nowrap text-xs font-semibold text-text-muted">{title(row.month)}</span>
      <div className="flex items-center gap-2 whitespace-nowrap text-[13px]">
        <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-chart-1" />
        <span className="font-bold text-text">{signed(row.gross)}</span>
        <span className="text-text-muted">{text.gross}</span>
      </div>
      <div className="flex items-center gap-2 whitespace-nowrap text-[13px]">
        <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-chart-8" />
        <span className="font-bold text-text">{signed(row.opex)}</span>
        <span className="text-text-muted">{text.opex}</span>
      </div>
      <div className="h-px bg-border" />
      <div className="flex items-center gap-2 whitespace-nowrap text-[13px]">
        <span aria-hidden="true" className="h-0.5 w-3 rounded-full bg-text" />
        <span className={row.net < 0 ? "font-bold text-danger-fg" : "font-bold text-text"}>{signed(row.net)}</span>
        <span className="text-text-muted">{text.net}</span>
      </div>
      {row.otherIncome !== 0 ? (
        <span className="whitespace-nowrap text-xs text-text-subtle">
          {text.otherIncome}: {signed(row.otherIncome)}
        </span>
      ) : null}
    </div>
  );
};

/**
 * OYLIK DAROMAD, XARAJAT VA SOF FOYDA (`.el-plot` + `.el-bars`, retsept — `DailyFlowChart`, maket
 * `superadmin-payments-overview`): daromad noldan yuqoriga (`chart-1`), xarajat pastga (`chart-8`), sof foyda — chiziq
 * (`text`, zarar oyida noldan pastda). Qiymatlar backend'dan (`GET /finance/pnl`) — qayta hisoblanmaydi.
 * Telefonda tooltip yashirin: ustunga teginilsa pastdagi qatorda o'sha oy (sukut — oxirgi, joriy oy).
 */
const PnlMonthlyChart = ({ months, labels, ariaLabel }: PnlMonthlyChartProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // Xarajat pastga chiziladi (stackOffset="sign"): grafikda manfiy, tooltipda ham «−» bilan.
  const rows = useMemo<PlotRow[]>(
    () => months.map((item) => ({ ...item, opex: -item.opex })),
    [months],
  );
  const ticks = buildTicks(rows.flatMap((row) => [row.gross, row.opex, row.net]));
  const compact = (value: number) => {
    const text = formatCompactMoneyLocalized(Math.abs(value), { language, withCurrency: false });
    return value < 0 ? `${MINUS_SIGN}${text}` : text;
  };
  const selected = rows.find((row) => row.month === selectedMonth) ?? rows[rows.length - 1];
  const signedShort = (value: number) => formatSignedMoneyLocalized(value, { language, withCurrency: false });

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <figure className="m-0 min-w-0" role="img" aria-label={ariaLabel}>
        <div className="h-[290px] min-w-0 max-md:h-44" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={rows}
              stackOffset="sign"
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              onClick={(state) => {
                const label = state?.activeLabel;
                if (typeof label === "string") setSelectedMonth(label);
              }}
            >
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis
                dataKey="month"
                tickFormatter={labels.short}
                tickLine={false}
                axisLine={false}
                tick={AXIS_TICK}
                interval="preserveStartEnd"
                minTickGap={16}
                tickMargin={8}
              />
              <YAxis
                tickFormatter={compact}
                width={64}
                tickLine={false}
                axisLine={false}
                tick={AXIS_TICK}
                ticks={ticks}
                domain={[ticks[0], ticks[ticks.length - 1]]}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: "var(--color-row-hover)" }}
                wrapperClassName="max-md:hidden"
                content={
                  <PnlTooltip
                    language={language}
                    title={labels.full}
                    text={{
                      gross: t("v2Balance.analysis.pnl.gross"),
                      opex: t("v2Balance.analysis.pnl.opex"),
                      net: t("v2Balance.analysis.pnl.net"),
                      otherIncome: t("v2Balance.analysis.pnl.otherIncomeShort"),
                    }}
                  />
                }
              />
              <ReferenceLine y={0} stroke="var(--color-border-strong)" />
              <Bar dataKey="gross" stackId="pnl" fill="var(--color-chart-1)" maxBarSize={28} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="opex" stackId="pnl" fill="var(--color-chart-8)" maxBarSize={28} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Line
                type="monotone"
                dataKey="net"
                stroke="var(--color-text)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--color-text)", strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </figure>
      {selected ? (
        <div
          role="status"
          className="hidden items-center justify-between gap-2 rounded-[10px] bg-sunken px-3 py-2.5 max-md:flex"
        >
          <span className="whitespace-nowrap text-[13px] font-semibold text-text">{labels.full(selected.month)}</span>
          <span className="flex flex-wrap justify-end gap-x-2.5 whitespace-nowrap text-[13px]">
            <span className="text-success-fg">{signedShort(selected.gross)}</span>
            <span className="text-danger-fg">{signedShort(selected.opex)}</span>
            <span className={selected.net < 0 ? "font-semibold text-danger-fg" : "font-semibold text-text"}>
              = {signedShort(selected.net)}
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
};

export default memo(PnlMonthlyChart);
