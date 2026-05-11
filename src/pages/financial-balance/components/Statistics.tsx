import { memo, useMemo } from 'react';
import {
  Cell,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
} from 'recharts';
import { TrendingDown } from 'lucide-react';
import type { ReactNode } from "react";

interface FinancialBalanceData {
  currentSituation?: number;
  main?: {
    balance?: number;
  };
  markets?: {
    marketsTotalBalans?: number;
    marketsTotalBalance?: number;
  };
  couriers?: {
    couriersTotalBalanse?: number;
    couriersTotalBalance?: number;
  };
  difference?: number;
}

interface StatisticsProps {
  data?: FinancialBalanceData;
}

interface ChartItem {
  name: string;
  amount: number;
  color: string;
}

const formatAmount = (val: number) =>
  val.toLocaleString('ru-RU').replace(/\s/g, ',') + ' UZS';

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#1C1A28] border border-[#2E2B3E] rounded-xl px-3 py-2 text-xs text-white shadow-lg">
        <p className="font-semibold">{payload[0].payload.name}</p>
        <p className="text-slate-300 mt-0.5">{formatAmount(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const Statistics = ({ data: financialData }: StatisticsProps) => {
  const chartData = useMemo<ChartItem[]>(() => {
    const cashAmount = toNumber(financialData?.main?.balance);
    const courierAmount = toNumber(
      financialData?.couriers?.couriersTotalBalanse ??
      financialData?.couriers?.couriersTotalBalance,
    );
    const marketAmount = toNumber(
      financialData?.markets?.marketsTotalBalans ??
      financialData?.markets?.marketsTotalBalance,
    );

    return [
      { name: 'Kassa', amount: cashAmount, color: '#7C3AED' },
      { name: 'Kuryerlar', amount: courierAmount, color: '#10B981' },
      { name: 'Marketlar', amount: marketAmount, color: '#E24B4A' },
    ];
  }, [financialData]);

  const maxAmount = useMemo(
    () => Math.max(...chartData.map((item) => Math.abs(item.amount)), 1),
    [chartData],
  );

  const netTotal =
    toNumber(financialData?.currentSituation) || toNumber(financialData?.difference);
  const isNegative = netTotal < 0;
  const trendIcon: ReactNode = isNegative
    ? <TrendingDown size={15} className="text-red-100" />
    : <TrendingDown size={15} className="rotate-180 text-emerald-100" />;
  const trendBackground = isNegative
    ? 'linear-gradient(90deg, #8f1d1d, #9f1d1d)'
    : 'linear-gradient(90deg, #065f46, #047857)';
  const trendBorder = isNegative ? '#7f1d1d' : '#14532d';

  return (
    <div className="flex flex-col gap-4">
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {/* Bar Chart */}
      <div className="bg-primary dark:bg-maindark border border-glass-border rounded-2xl p-5">
        <p className="text-white font-semibold text-sm mb-5">
          Moliyaviy ko'rsatkichlar
        </p>

        <div className="mb-5 space-y-4">
          {chartData.map((item) => {
            const pct = (Math.abs(item.amount) / maxAmount) * 100;
            return (
              <div key={item.name} className="flex items-center gap-3">
                <span className="text-slate-400 text-xs w-20 text-right shrink-0">
                  {item.name}
                </span>
                <div className="flex-1 h-7 bg-primary dark:bg-maindark rounded-md overflow-hidden">
                  <div
                    className="h-full rounded-md transition-all duration-700"
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

        <div className="flex flex-wrap items-center gap-3 border-t border-[#2E2B3E] pt-3">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: item.color }}
              />
              <span className="text-xs text-slate-300">{item.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Donut Chart */}
      <div className="bg-primary dark:bg-maindark border border-glass-border rounded-2xl p-5">
        <p className="text-white font-semibold text-sm mb-4">Taqsimot</p>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          <div className="h-40 w-40 shrink-0 self-center sm:self-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={68}
                  paddingAngle={2}
                  dataKey="amount"
                  strokeWidth={0}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} opacity={0.9} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="w-full flex-1 space-y-3">
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
                  <span className="text-xs text-slate-300">{item.name}</span>
                </div>
                <span className="text-right text-xs font-semibold tabular-nums text-white">
                  {item.amount.toLocaleString('ru-RU').replace(/\s/g, ',')} UZS
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

      {/* Total Balance Bar */}
      <div
        className="flex flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
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
            <p className="text-white text-sm font-semibold leading-tight">Total Balans</p>
            <p className="text-slate-300 text-xs mt-0.5">Kassa + Kuryerlar + Marketlar</p>
          </div>
        </div>

        <p
          className={`text-right text-xl font-black tabular-nums tracking-wide sm:text-2xl ${
            isNegative ? "text-red-100" : "text-emerald-100"
          }`}
        >
          {netTotal.toLocaleString('ru-RU').replace(/\s/g, ',')} UZS
        </p>
      </div>
    </div>
  );
};

export default memo(Statistics);
