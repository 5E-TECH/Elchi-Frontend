import { memo } from "react";
import { useTranslation } from "react-i18next";
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
  suffix?: string;
  compact?: boolean;
}

export interface DashboardStatisticsProps {
  totalOrders: number;
  sold: number;
  cancelled: number;
  profit: number;
  loading?: boolean;
}

// ─── Color Map ────────────────────────────────────────────────────────────────

const VARIANT_COLOR: Record<ColorVariant, string> = {
  info: "#2563eb",
  success: "#059669",
  error: "#e11d48",
  warning: "#d97706",
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("uz-UZ").format(value);

const formatMoney = (value: number) =>
  formatNumber(value).replace(/\u00A0/g, " ");

// ─── StatCard ─────────────────────────────────────────────────────────────────

const StatCard = memo(
  ({ title, value, icon, variant, badge, suffix, compact = false }: StatCardProps) => {
    const color = VARIANT_COLOR[variant];

    return (
      <div
        className="el-card group relative flex min-h-[144px] cursor-pointer flex-col overflow-hidden rounded-2xl
        transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-border-strong)]"
      >
        <span
          className="absolute left-0 right-0 top-0 h-1"
          style={{ background: color }}
        />

        <div className="flex flex-1 flex-col justify-between p-4 pt-5">
          <div className="mb-6 flex items-start justify-between">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-white/10"
              style={{
                background: color,
                color: "var(--color-primary)",
              }}
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

          <p className="mb-2 text-[12px] font-semibold text-maindark/60 dark:text-primary/70">
            {title}
          </p>

          <div className="flex items-baseline gap-1.5">
            <span
              className={`min-w-0 break-words font-bold leading-none tracking-tight text-maindark dark:text-primary ${
                compact ? "text-[22px] sm:text-[24px]" : "text-[28px]"
              }`}
            >
              {value}
            </span>
            {suffix && (
              <span className="shrink-0 text-[11px] font-semibold uppercase text-maindark/50 dark:text-primary/50">
                {suffix}
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
  ({ totalOrders, sold, cancelled, profit, loading = false }: DashboardStatisticsProps) => {
    const { t } = useTranslation("dashboard");

    if (loading) {
      return (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="el-card min-h-[144px] rounded-2xl p-4"
              style={{ opacity: 1 - index * 0.08 }}
            >
              <div className="mb-7 h-10 w-10 animate-pulse rounded-xl bg-slate-200 dark:bg-white/12" />
              <div className="mb-4 h-3 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-white/12" />
              <div className="h-7 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-white/12" />
            </div>
          ))}
        </div>
      );
    }

    const stats: StatCardProps[] = [
      {
        title: t("cards.total_orders"),
        value: totalOrders,
        icon: <ShoppingCart size={20} />,
        variant: "info",
      },
      {
        title: t("cards.sold"),
        value: sold,
        icon: <CheckCircle2 size={20} />,
        variant: "success",
      },
      {
        title: t("cards.cancelled"),
        value: cancelled,
        icon: <XCircle size={20} />,
        variant: "error",
      },
      {
        title: t("cards.profit"),
        value: formatMoney(profit),
        icon: <DollarSign size={20} />,
        variant: "warning",
        suffix: t("currency_sum"),
        compact: true,
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
