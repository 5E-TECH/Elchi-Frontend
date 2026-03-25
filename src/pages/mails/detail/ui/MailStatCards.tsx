import { memo } from "react";
import { Package, Home, Building2 } from "lucide-react";
import { formatPrice } from "../lib/helpers";

interface HomeOrderStats {
  homeOrders: number;
  homeOrdersTotalPrice: number;
}

interface CenterOrderStats {
  centerOrders: number;
  centerOrdersTotalPrice: number;
}

interface MailStatCardsProps {
  totalOrders: number;
  selectedCount: number;
  homeStats?: HomeOrderStats;
  centerStats?: CenterOrderStats;
}

// ─── Yagona stat kard ─────────────────────────────────────────────────────────
const StatCard = memo(
  ({
    icon,
    label,
    main,
    sub,
    highlighted = false,
  }: {
    icon: React.ReactNode;
    label: string;
    main: React.ReactNode;
    sub?: string;
    highlighted?: boolean;
  }) => (
    <div
      className={`flex items-center gap-4 px-5 py-4 rounded-2xl border ${highlighted
          ? "bg-linear-to-br from-main to-primarydark border-main/40 text-white"
          : "bg-white dark:bg-primarydark border-gray-100 dark:border-white/10"
        }`}
    >
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${highlighted ? "bg-white/20" : "bg-main/10 dark:bg-main/20"
          }`}
      >
        <span className={highlighted ? "text-white" : "text-main"}>{icon}</span>
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          className={`text-xs font-medium ${highlighted ? "text-white" : "text-gray-400 dark:text-white"}`}
        >
          {label}
        </span>
        <div
          className={`text-lg font-bold leading-tight ${highlighted ? "text-white" : "text-gray-800 dark:text-white"}`}
        >
          {main}
        </div>
        {sub && (
          <span
            className={`text-xs font-medium ${highlighted ? "text-white" : "text-gray-400 dark:text-white"}`}
          >
            {sub}
          </span>
        )}
      </div>
    </div>
  ),
);
StatCard.displayName = "StatCard";

// ─── 3 ta stat kard ───────────────────────────────────────────────────────────
const MailStatCards = memo(
  ({
    totalOrders,
    selectedCount,
    homeStats,
    centerStats,
  }: MailStatCardsProps) => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Tanlangan */}
      <StatCard
        highlighted
        icon={<Package size={18} />}
        label="Tanlangan"
        main={
          <span>
            {selectedCount}{" "}
            <span className="text-white/60 font-normal text-base">
              / {totalOrders}
            </span>
          </span>
        }
        sub={
          selectedCount > 0
            ? `${selectedCount} ta tanlandi`
            : "Hech biri tanlanmagan"
        }
      />

      {/* Uyga yetkazish */}
      <StatCard
        highlighted
        icon={<Home size={18} />}
        label="Uyga yetkazish"
        main={
          <span>
            {homeStats?.homeOrders ?? 0}{" "}
            <span className="text-gray-400 dark:text-white font-normal text-sm">
              ta
            </span>
          </span>
        }
        sub={homeStats ? formatPrice(homeStats.homeOrdersTotalPrice) : "—"}
      />

      {/* Markazga */}
      <StatCard
        highlighted
        icon={<Building2 size={18} />}
        label="Markazga"
        main={
          <span>
            {centerStats?.centerOrders ?? 0}{" "}
            <span className="text-gray-400 dark:text-white font-normal text-sm">
              ta
            </span>
          </span>
        }
        sub={
          centerStats ? formatPrice(centerStats.centerOrdersTotalPrice) : "—"
        }
      />
    </div>
  ),
);
MailStatCards.displayName = "MailStatCards";

export default MailStatCards;
