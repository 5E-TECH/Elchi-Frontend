import { memo } from "react";
import {
  ShoppingCart,
  CheckCircle2,
  XCircle,
  DollarSign,
  TrendingUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ColorVariant = "info" | "success" | "error" | "warning";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  variant: ColorVariant;
  badge?: string;
}

export interface DashboardStatisticsProps {
  totalOrders: number;
  sold: number;
  cancelled: number;
  profit: number;
}

// ─── Color Map ────────────────────────────────────────────────────────────────

const VARIANT_COLOR: Record<ColorVariant, string> = {
  info: "var(--color-info)",
  success: "var(--color-success)",
  error: "var(--color-error)",
  warning: "var(--color-warning)",
};

// ─── StatCard ─────────────────────────────────────────────────────────────────

const StatCard = memo(
  ({ title, value, icon, variant, badge }: StatCardProps) => {
    const color = VARIANT_COLOR[variant];
    const isProfit = title === "Profit";

    return (
      <div
        className="relative flex flex-col rounded-xl overflow-hidden cursor-pointer
        transition-transform duration-200 hover:-translate-y-0.5
        bg-sidebar dark:bg-maindark
        border border-black/[0.07] dark:border-primarydark/25"
      >
        <span
          className="absolute top-0 left-0 right-0 h-0.75"
          style={{ background: color }}
        />

        <div className="p-4 pt-5">
          <div className="flex items-start justify-between mb-4">
            <div
              className="w-10 h-10 rounded-[10px] flex items-center justify-center"
              style={{ background: color, color: "var(--color-primary)" }}
            >
              {icon}
            </div>

            {badge && (
              <span
                className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md"
                style={{
                  background: `color-mix(in srgb, ${color} 15%, transparent)`,
                  color,
                }}
              >
                <TrendingUp size={10} strokeWidth={3} />
                {badge}
              </span>
            )}
          </div>

          <p className="text-[12px] font-medium mb-1.5 text-maindark/55 dark:text-sidebar/55">
            {title}
          </p>

          <div className="flex items-baseline gap-1.5">
            <span className="text-[28px] font-bold leading-none tracking-tight text-maindark dark:text-primary">
              {value}
            </span>
            {isProfit && (
              <span className="text-[11px] font-semibold text-maindark/50 dark:text-sidebar/50">
                UZS
              </span>
            )}
          </div>
        </div>
      </div>
    );
  },
);

StatCard.displayName = "StatCard";

// ─── DashboardStatistics ──────────────────────────────────────────────────────

const DashboardStatistics = memo(
  ({ totalOrders, sold, cancelled, profit }: DashboardStatisticsProps) => {
    const stats: StatCardProps[] = [
      {
        title: "Total Orders",
        value: totalOrders,
        icon: <ShoppingCart size={20} />,
        variant: "info",
      },
      {
        title: "Sold",
        value: sold,
        icon: <CheckCircle2 size={20} />,
        variant: "success",
      },
      {
        title: "Cancelled",
        value: cancelled,
        icon: <XCircle size={20} />,
        variant: "error",
      },
      {
        title: "Profit",
        value: profit,
        icon: <DollarSign size={20} />,
        variant: "warning",
      },
    ];

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>
    );
  },
);

DashboardStatistics.displayName = "DashboardStatistics";

export default DashboardStatistics;
