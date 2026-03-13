import { memo } from "react";
import {
  ShoppingCart,
  CheckCircle2,
  XCircle,
  DollarSign,
  Calendar,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ColorVariant = "info" | "success" | "error" | "warning";

interface StatCardProps {
  title:    string;
  value:    string | number;
  hint:     string;
  icon:     React.ReactNode;
  variant:  ColorVariant;
  badge?:   string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const STATS: StatCardProps[] = [
  {
    title:   "Total Orders",
    value:   19,
    hint:    "Active today",
    icon:    <ShoppingCart size={18} />,
    variant: "info",
  },
  {
    title:   "Sold",
    value:   64,
    hint:    "vs yesterday",
    icon:    <CheckCircle2 size={18} />,
    variant: "success",
    badge:   "336.8%",
  },
  {
    title:   "Cancelled",
    value:   63,
    hint:    "Needs attention",
    icon:    <XCircle size={18} />,
    variant: "error",
  },
  {
    title:   "Profit",
    value:   "930,000",
    hint:    "Net revenue",
    icon:    <DollarSign size={18} />,
    variant: "warning",
  },
];

// ─── StatCard ─────────────────────────────────────────────────────────────────

const StatCard = memo(({ title, value, hint, icon, variant, badge }: StatCardProps) => {
  const isProfit = title === "Profit";
  const color    = `var(--color-${variant})`;

  return (
    <div
      className="
        relative rounded-2xl p-4.5 border cursor-pointer
        transition-all duration-200 hover:-translate-y-px overflow-hidden
        bg-primary dark:bg-maindark
        border-primarydark
      "
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-main)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-primarydark)")}
    >
      {/* Top accent bar */}
      <span
        className="absolute top-0 left-0 right-0 h-[2.5px] rounded-t-2xl"
        style={{ background: color }}
      />

      {/* Icon + badge/arrow */}
      <div className="flex items-start justify-between mb-3.5">
        <div
          className="w-9.5 h-9.5 rounded-[10px] flex items-center justify-center
            bg-sidebar dark:bg-background"
          style={{ color }}
        >
          {icon}
        </div>

        {badge ? (
          <span
            className="flex items-center gap-1 px-2 py-0.75 rounded-md text-[10px] font-bold tracking-wide
              bg-sidebar dark:bg-background"
            style={{ color }}
          >
            <TrendingUp size={9} strokeWidth={3} />
            {badge}
          </span>
        ) : (
          <div
            className="w-6.5 h-6.5 rounded-lg flex items-center justify-center
              bg-sidebar dark:bg-background"
            style={{ borderColor: "var(--color-primarydark)" }}
          >
            <ArrowUpRight size={13} style={{ color: "var(--color-primarydark)" }} />
          </div>
        )}
      </div>

      {/* Label */}
      <p
        className="text-[10px] font-semibold uppercase tracking-[0.8px] mb-1.25
          text-maindark dark:text-sidebar"
        style={{ opacity: 0.6 }}
      >
        {title}
      </p>

      {/* Value */}
      <div className="flex items-baseline gap-1">
        <h3
          className="text-[24px] font-bold leading-none tracking-tight
            text-maindark dark:text-primary"
        >
          {value}
        </h3>
        {isProfit && (
          <span
            className="text-[10px] font-semibold
              text-maindark dark:text-sidebar"
            style={{ opacity: 0.5 }}
          >
            UZS
          </span>
        )}
      </div>

      {/* Bottom hint */}
      <div
        className="flex items-center gap-1.5 mt-2.5 pt-2.5 text-[10px]
          text-maindark dark:text-sidebar
          border-t border-primarydark"
        style={{ opacity: 0.6 }}
      >
        <span
          className="w-1.25 h-1.25 rounded-full shrink-0"
          style={{ background: color }}
        />
        {hint}
      </div>
    </div>
  );
});

StatCard.displayName = "StatCard";

// ─── DashboardStatistics ──────────────────────────────────────────────────────

const DashboardStatistics = () => (
  <section className="mb-6">

    {/* Header */}
    <div className="flex items-center justify-between mb-4.5">
      <div className="flex items-center gap-2">
        <Calendar size={18} style={{ color: "var(--color-main)" }} />
        <h2
          className="text-[15px] font-semibold tracking-[-0.2px]
            text-maindark dark:text-primary"
        >
          Today's Statistics
        </h2>
      </div>

      {/* Date range */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px]
          bg-sidebar dark:bg-maindark
          border border-primarydark"
      >
        <Calendar size={12} className="shrink-0" style={{ color: "var(--color-primarydark)" }} />
        <input
          type="text"
          placeholder="Start date"
          className="bg-transparent border-none outline-none w-18 text-[11px]
            text-maindark dark:text-sidebar
            placeholder:text-primarydark"
        />
        <div className="w-px h-3 shrink-0 bg-primarydark" />
        <input
          type="text"
          placeholder="End date"
          className="bg-transparent border-none outline-none w-18 text-[11px]
            text-maindark dark:text-sidebar
            placeholder:text-primarydark"
        />
      </div>
    </div>

    {/* Grid */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
      {STATS.map((stat) => (
        <StatCard key={stat.title} {...stat} />
      ))}
    </div>

  </section>
);

export default memo(DashboardStatistics);