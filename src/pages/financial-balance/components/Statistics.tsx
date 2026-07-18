import { memo, useMemo } from "react";
import { TrendingDown } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  formatFinancialAmount,
  toFinancialNumber,
  type FinancialBalanceData,
} from "../lib/financialBalance";

interface StatisticsProps {
  data?: FinancialBalanceData;
}

interface ChartItem {
  name: string;
  amount: number;
  color: string;
}

const Statistics = ({ data: financialData }: StatisticsProps) => {
  const { t } = useTranslation("payments");
  const chartData = useMemo<ChartItem[]>(() => {
    const cashAmount = toFinancialNumber(financialData?.main?.balance);
    const courierAmount = toFinancialNumber(
      financialData?.couriers?.couriersTotalBalanse ??
      financialData?.couriers?.couriersTotalBalance,
    );
    const marketAmount = toFinancialNumber(
      financialData?.markets?.marketsTotalBalans ??
      financialData?.markets?.marketsTotalBalance,
    );

    return [
      { name: t("financialBalanceCashbox"), amount: cashAmount, color: "#7C3AED" },
      { name: t("financialBalanceCouriers"), amount: courierAmount, color: "#10B981" },
      { name: t("financialBalanceMarkets"), amount: marketAmount, color: "#E24B4A" },
    ];
  }, [financialData, t]);

  const maxAmount = useMemo(
    () => Math.max(...chartData.map((item) => Math.abs(item.amount)), 1),
    [chartData],
  );
  const donutBackground = useMemo(() => {
    const total = chartData.reduce((sum, item) => sum + Math.abs(item.amount), 0);

    if (total <= 0) {
      return "conic-gradient(rgba(148, 163, 184, 0.28) 0deg 360deg)";
    }

    let cursor = 0;
    const segments = chartData.map((item) => {
      const start = cursor;
      const size = (Math.abs(item.amount) / total) * 360;
      cursor += size;
      return `${item.color} ${start.toFixed(2)}deg ${cursor.toFixed(2)}deg`;
    });

    return `conic-gradient(${segments.join(", ")})`;
  }, [chartData]);

  const netTotal =
    toFinancialNumber(financialData?.currentSituation) || toFinancialNumber(financialData?.difference);
  const isNegative = netTotal < 0;
  const trendIcon: ReactNode = isNegative
    ? <TrendingDown size={15} className="text-red-100" />
    : <TrendingDown size={15} className="rotate-180 text-emerald-100" />;
  const trendBackground = isNegative
    ? "linear-gradient(90deg, #8f1d1d, #9f1d1d)"
    : "linear-gradient(90deg, #065f46, #047857)";
  const trendBorder = isNegative ? "#7f1d1d" : "#14532d";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="grid min-h-0 grid-cols-1 gap-3 xl:flex-1 xl:grid-cols-2">
        {/* Bar Chart */}
        <div className="rounded-2xl border border-glass-border bg-primary p-4 dark:bg-maindark">
          <p className="mb-4 text-sm font-semibold text-maindark dark:text-white">
            {t("financialBalanceIndicators")}
          </p>

          <div className="mb-4 space-y-3">
            {chartData.map((item) => {
              const pct = (Math.abs(item.amount) / maxAmount) * 100;
              return (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-right text-xs text-(--color-text-muted) dark:text-slate-400">
                    {item.name}
                  </span>
                  <div className="h-6 flex-1 overflow-hidden rounded-md bg-gray-100 dark:bg-primarydark/30">
                    <div
                      className="h-full rounded-md"
                      style={{
                        width: `${pct}%`,
                        background: item.color,
                        opacity: 0.85,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--color-border-soft)] pt-3 dark:border-white/10">
            {chartData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: item.color }}
                />
                <span className="text-xs text-(--color-text-muted) dark:text-slate-300">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Donut Chart */}
        <div className="rounded-2xl border border-glass-border bg-primary p-4 dark:bg-maindark">
          <p className="mb-3 text-sm font-semibold text-maindark dark:text-white">
            {t("financialBalanceDistribution")}
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="h-32 w-32 shrink-0 self-center sm:self-auto">
              <div
                className="relative h-28 w-28 rounded-full"
                style={{ background: donutBackground }}
                aria-label={t("financialBalanceDistribution")}
              >
                <div className="absolute inset-7 rounded-full bg-primary dark:bg-maindark" />
              </div>
            </div>

            <div className="w-full flex-1 space-y-2.5">
              {chartData.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: item.color }}
                    />
                    <span className="text-xs text-(--color-text-muted) dark:text-slate-300">{item.name}</span>
                  </div>
                  <span className="text-right text-xs font-semibold tabular-nums text-maindark dark:text-white">
                    {formatFinancialAmount(item.amount, "comma")} {t("currency")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Total Balance Bar */}
      <div
        className="flex shrink-0 flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
        style={{
          background: trendBackground,
          borderColor: trendBorder,
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            {trendIcon}
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">
              {t("financialBalanceTotal")}
            </p>
            <p className="text-slate-300 text-xs mt-0.5">
              {t("financialBalanceTotalFormula")}
            </p>
          </div>
        </div>

        <p
          className={`text-right text-xl font-black tabular-nums tracking-wide sm:text-2xl ${
            isNegative ? "text-red-100" : "text-emerald-100"
          }`}
        >
          {formatFinancialAmount(netTotal, "comma")} {t("currency")}
        </p>
      </div>
    </div>
  );
};

export default memo(Statistics);
