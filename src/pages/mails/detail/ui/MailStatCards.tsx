import { memo } from "react";
import { Package, Home, Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  showSelectionCard?: boolean;
  variant?: "cards" | "compact";
}

// ─── Yagona stat kard ─────────────────────────────────────────────────────────
const StatCard = memo(
  ({
    icon,
    label,
    main,
    sub,
    highlighted = false,
    tone = "primary",
  }: {
    icon: React.ReactNode;
    label: string;
    main: React.ReactNode;
    sub?: string;
    highlighted?: boolean;
    tone?: "primary" | "success" | "danger";
  }) => (
    <div
      className={`flex items-center gap-4 px-5 py-4 rounded-2xl border ${highlighted
          ? tone === "success"
            ? "bg-linear-to-br from-emerald-500 to-emerald-400 border-emerald-300/40 text-white"
            : tone === "danger"
              ? "bg-linear-to-br from-rose-500 to-red-500 border-rose-300/40 text-white"
              : "bg-linear-to-br from-main to-primarydark border-main/40 text-white"
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
    showSelectionCard = true,
    variant = "cards",
  }: MailStatCardsProps) => {
    const { t } = useTranslation(["mails", "orders"]);

    if (variant === "compact") {
      const isFullySelected = totalOrders > 0 && selectedCount === totalOrders;
      const compactItems = [
        showSelectionCard
          ? {
              key: "selected",
              icon: <Package size={15} />,
              label: t("mails:selected"),
              value: `${selectedCount}/${totalOrders}`,
              hint: selectedCount > 0 ? t("mails:selectedCountLabel", { count: selectedCount }) : t("mails:noneSelected"),
              completed: isFullySelected,
            }
          : null,
        {
          key: "home",
          icon: <Home size={15} />,
          label: t("orders:deliveryToHome"),
          value: `${homeStats?.homeOrders ?? 0} ${t("mails:piece")}`,
          hint: homeStats ? formatPrice(homeStats.homeOrdersTotalPrice) : "—",
          completed: false,
        },
        {
          key: "center",
          icon: <Building2 size={15} />,
          label: t("orders:deliveryToCenter"),
          value: `${centerStats?.centerOrders ?? 0} ${t("mails:piece")}`,
          hint: centerStats ? formatPrice(centerStats.centerOrdersTotalPrice) : "—",
          completed: false,
        },
      ].filter(Boolean) as Array<{
        key: string;
        icon: React.ReactNode;
        label: string;
        value: string;
        hint: string;
        completed: boolean;
      }>;

      return (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[color:var(--color-border-soft)] bg-white/70 p-2.5 dark:border-white/10 dark:bg-white/[0.04]">
          {compactItems.map((item) => (
            <div
              key={item.key}
              className={`flex min-w-[180px] flex-1 items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                item.completed
                  ? "border-emerald-300/50 bg-emerald-500/15 dark:border-emerald-300/30 dark:bg-emerald-500/18"
                  : "border-[color:var(--color-border-soft)] bg-primary dark:border-white/10 dark:bg-primarydark"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  item.completed
                    ? "bg-emerald-500 text-white"
                    : "bg-main/12 text-main dark:bg-main/20 dark:text-white"
                }`}
              >
                {item.icon}
              </span>
              <span className="min-w-0">
                <span
                  className={`block truncate text-[11px] font-bold uppercase tracking-[0.12em] ${
                    item.completed ? "text-emerald-700 dark:text-emerald-100" : "text-[color:var(--color-text-muted)] dark:text-white/55"
                  }`}
                >
                  {item.label}
                </span>
                <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className={`text-base font-black ${item.completed ? "text-emerald-700 dark:text-emerald-100" : "text-maindark dark:text-white"}`}>
                    {item.value}
                  </span>
                  <span className={`text-xs font-semibold ${item.completed ? "text-emerald-700/80 dark:text-emerald-100/75" : "text-[color:var(--color-text-muted)] dark:text-white/60"}`}>
                    {item.hint}
                  </span>
                </span>
              </span>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className={`grid grid-cols-1 gap-4 ${showSelectionCard ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {showSelectionCard && (
          <StatCard
            highlighted
            tone={selectedCount === totalOrders && totalOrders > 0 ? "success" : "danger"}
            icon={<Package size={18} />}
            label={t("mails:selected")}
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
                ? t("mails:selectedCountLabel", { count: selectedCount })
                : t("mails:noneSelected")
            }
          />
        )}

        <StatCard
          highlighted
          icon={<Home size={18} />}
          label={t("orders:deliveryToHome")}
          main={
            <span>
              {homeStats?.homeOrders ?? 0}{" "}
              <span className="text-gray-400 dark:text-white font-normal text-sm">
                {t("mails:piece")}
              </span>
            </span>
          }
          sub={homeStats ? formatPrice(homeStats.homeOrdersTotalPrice) : "—"}
        />

        <StatCard
          highlighted
          icon={<Building2 size={18} />}
          label={t("orders:deliveryToCenter")}
          main={
            <span>
              {centerStats?.centerOrders ?? 0}{" "}
              <span className="text-gray-400 dark:text-white font-normal text-sm">
                {t("mails:piece")}
              </span>
            </span>
          }
          sub={
            centerStats ? formatPrice(centerStats.centerOrdersTotalPrice) : "—"
          }
        />
      </div>
    );
  },
);
MailStatCards.displayName = "MailStatCards";

export default MailStatCards;
