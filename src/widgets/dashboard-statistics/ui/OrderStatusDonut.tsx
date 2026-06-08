import { memo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { PackageCheck } from "lucide-react";
import {
  toneAccent,
  formatNumber,
  formatPercent,
  ratio,
  TYPO,
  TEXT,
} from "../../../shared/config/designSystem";

/**
 * OrderStatusDonut — buyurtmalar holatining taqsimoti (donut/halqa grafik).
 * Markazda jami qabul qilingan soni. Atrofida: sotilgan / jarayonda / bekor.
 * Dashboard'da boshqa kartalardan ajralib turadigan asosiy vizual.
 */
export interface OrderStatusDonutProps {
  accepted: number;
  sold: number;
  inProgress: number;
  cancelled: number;
  title: string;
  centerLabel: string;
  legend: { sold: string; inProgress: string; cancelled: string };
}

const OrderStatusDonut = memo(
  ({
    accepted,
    sold,
    inProgress,
    cancelled,
    title,
    centerLabel,
    legend,
  }: OrderStatusDonutProps) => {
    const total = accepted || sold + inProgress + cancelled;
    const allZero = total === 0;

    const segments = [
      { key: "sold", name: legend.sold, value: sold, color: toneAccent("success") },
      {
        key: "inProgress",
        name: legend.inProgress,
        value: inProgress,
        color: toneAccent("warning"),
      },
      {
        key: "cancelled",
        name: legend.cancelled,
        value: cancelled,
        color: toneAccent("danger"),
      },
    ];

    const chartData = allZero
      ? [{ key: "empty", name: "—", value: 1, color: "var(--color-border-soft)" }]
      : segments;

    return (
      <div className="el-card relative flex min-h-[300px] flex-col overflow-hidden rounded-2xl p-5">
        <div className="mb-1 flex items-center gap-2">
          <PackageCheck size={16} style={{ color: toneAccent("info") }} />
          <h3 className={`${TYPO.cardTitle} text-maindark dark:text-primary`}>
            {title}
          </h3>
        </div>

        <div className="relative flex flex-1 items-center justify-center">
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={88}
                paddingAngle={allZero ? 0 : 3}
                stroke="none"
                startAngle={90}
                endAngle={-270}
              >
                {chartData.map((d) => (
                  <Cell key={d.key} fill={d.color} />
                ))}
              </Pie>
              {!allZero && (
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border-soft)",
                    background: "var(--color-card-surface-strong)",
                    fontSize: 12,
                  }}
                  formatter={(value: any, name: any) => [formatNumber(Number(value)), name]}
                />
              )}
            </PieChart>
          </ResponsiveContainer>

          {/* Markaz: jami qabul qilingan */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[30px] font-bold leading-none tracking-tight text-maindark dark:text-primary">
              {formatNumber(total)}
            </span>
            <span className="mt-1 text-[11px] font-semibold" style={{ color: TEXT.soft }}>
              {centerLabel}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {segments.map((s) => (
            <div key={s.key} className="flex flex-col items-center gap-0.5">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: s.color }}
                />
                <span className="text-[15px] font-bold text-maindark dark:text-primary">
                  {formatNumber(s.value)}
                </span>
              </span>
              <span className="text-[10px] font-medium" style={{ color: TEXT.soft }}>
                {s.name} · {formatPercent(ratio(s.value, total), 0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  },
);

OrderStatusDonut.displayName = "OrderStatusDonut";

export default OrderStatusDonut;
