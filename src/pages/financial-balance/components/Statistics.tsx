import { memo } from 'react';
import {
  Cell,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
} from 'recharts';
import { TrendingDown } from 'lucide-react';

const data = [
  { name: 'Kassa', amount: 16_470_000, color: '#7C3AED' },
  { name: 'Kuryerlar', amount: 70_778_846, color: '#10B981' },
  { name: 'Marketlar', amount: 330_808_849, color: '#E24B4A' },
];

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

const Statistics = () => {
  const netTotal = -260_030_003;
  const isNegative = netTotal < 0;

  return (
    <div className="flex flex-col gap-4">
    <div className="grid grid-cols-2 gap-4">
      {/* Bar Chart */}
      <div className="bg-primary dark:bg-maindark border border-glass-border rounded-2xl p-5">
        <p className="text-white font-semibold text-sm mb-5">
          Moliyaviy ko'rsatkichlar
        </p>

        <div className="space-y-4 mb-5">
          {data.map((item) => {
            const max = Math.max(...data.map((d) => d.amount));
            const pct = (item.amount / max) * 100;
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

        <div className="flex items-center gap-4 pt-3 border-t border-[#2E2B3E]">
          {data.map((item) => (
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

        <div className="flex items-center gap-6">
          <div className="w-40 h-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={68}
                  paddingAngle={2}
                  dataKey="amount"
                  strokeWidth={0}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} opacity={0.9} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 space-y-3">
            {data.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: item.color }}
                  />
                  <span className="text-slate-300 text-xs">{item.name}</span>
                </div>
                <span className="text-white text-xs font-semibold tabular-nums">
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
        className="flex items-center justify-between px-5 py-4 rounded-2xl border"
        style={{
          background: 'linear-gradient(90deg, #8f1d1d, #9f1d1d)',
          borderColor: isNegative ? '#7f1d1d' : '#14532d',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <TrendingDown size={15} className="text-red-100" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">Total Balans</p>
            <p className="text-slate-300 text-xs mt-0.5">Kassa + Kuryerlar + Marketlar</p>
          </div>
        </div>

        <p
          className="text-2xl font-black tabular-nums tracking-wide text-red-100"
        >
          {netTotal.toLocaleString('ru-RU').replace(/\s/g, ',')} UZS
        </p>
      </div>
    </div>
  );
};

export default memo(Statistics);