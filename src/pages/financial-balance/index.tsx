import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import HeaderName from "../../shared/components/headerName";
import { Scale, Briefcase, Store, Truck, History, ChartColumn, MapPin } from "lucide-react";
import Statistics from "./components/Statistics";
import HistoryTab from "./components/HistoryTab";
import AnalysisTab from "./components/AnalysisTab";
import { useCashBox } from "../../entities/payments";
import PageContainer from "../../shared/ui/PageContainer";
import QueryErrorState from "../../shared/ui/QueryErrorState";
import EmptyState from "../../shared/ui/EmptyState";
import {
  formatFinancialAmount,
  normalizeFinancialBalance,
  type FinancialBalanceParty,
} from "./lib/financialBalance";

interface BalanceCard {
  label: string;
  subLabel: string;
  subType: "neutral" | "negative" | "positive";
  amount: number;
  icon: React.ReactNode;
  colorClass: "purple" | "red" | "green";
}



const colorMap = {
  purple: {
    icon: "bg-purple-500/20 border border-purple-500/30 text-purple-500 dark:text-purple-400",
    amount: "text-purple-600 dark:text-purple-300",
    bar: "bg-purple-400",
  },
  red: {
    icon: "bg-red-500/20 border border-red-500/30 text-red-500 dark:text-red-400",
    amount: "text-red-600 dark:text-red-300",
    bar: "bg-red-400",
  },
  green: {
    icon: "bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
    amount: "text-emerald-600 dark:text-emerald-300",
    bar: "bg-emerald-400",
  },
};

const subLabelColor = {
  neutral: "text-maindark/50 dark:text-slate-400",
  negative: "text-red-500 dark:text-red-400",
  positive: "text-emerald-600 dark:text-emerald-400",
};

interface SettlementListCardProps {
  title: string;
  description: string;
  count: number;
  icon: React.ReactNode;
  iconClassName: string;
  total: number;
  rows: FinancialBalanceParty[];
  amountClassName: string;
  emptyText: string;
  countSuffix: string;
  totalLabel: string;
  currencyLabel: string;
}

const SettlementListCard = ({
  title,
  description,
  count,
  icon,
  iconClassName,
  total,
  rows,
  amountClassName,
  emptyText,
  countSuffix,
  totalLabel,
  currencyLabel,
}: SettlementListCardProps) => (
  <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-card-surface-strong)] dark:border-white/10 dark:bg-[color:var(--color-surface-elevated-dark)]">
    <div className="flex items-center justify-between gap-4 border-b border-[color:var(--color-border-soft)] px-5 py-4 dark:border-white/10">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-maindark dark:text-white">{title}</p>
          <p className="truncate text-xs text-maindark/50 dark:text-slate-400">{description}</p>
        </div>
      </div>
      <p className="shrink-0 text-sm font-semibold text-maindark/45 dark:text-slate-500">
        {count} {countSuffix}
      </p>
    </div>

    <div className="max-h-72 overflow-y-auto">
      {rows.length ? (
        rows.map((row, index) => (
          <div
            key={`${row.id}-${index}`}
            className="flex items-center gap-3 border-b border-[color:var(--color-border-soft)] px-5 py-3 last:border-b-0 dark:border-white/8"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-main-soft)] text-sm font-bold text-main dark:bg-white/8 dark:text-primary">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-maindark dark:text-white">{row.name}</p>
              {row.location ? (
                <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-maindark/45 dark:text-slate-400">
                  <MapPin size={12} className="shrink-0" />
                  <span className="truncate">{row.location}</span>
                </p>
              ) : null}
            </div>
            <p className={`shrink-0 text-right text-sm font-black tabular-nums ${amountClassName}`}>
              {formatFinancialAmount(row.balance, "comma")}
            </p>
          </div>
        ))
      ) : (
        <div className="px-5 py-10 text-center text-sm text-maindark/50 dark:text-slate-400">
          {emptyText}
        </div>
      )}
    </div>

    <div className="flex items-center justify-between gap-4 border-t border-[color:var(--color-border-soft)] bg-[color:var(--color-card-surface)] px-5 py-4 dark:border-white/10 dark:bg-white/5">
      <p className="text-base font-bold text-maindark dark:text-white">{totalLabel}</p>
      <p className={`text-right text-base font-black tabular-nums sm:text-lg ${amountClassName}`}>
        {formatFinancialAmount(total, "comma")} {currencyLabel}
      </p>
    </div>
  </div>
);


const FinancialBalance = () => {
  const { t } = useTranslation("payments");
  const { useGetFinancialBalance } = useCashBox();
  const { data: response, isLoading, isError, refetch } = useGetFinancialBalance();
  const data = normalizeFinancialBalance(response);
  const currencyLabel = t("currency");
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "analysis">("overview");

  if (isError) {
    return (
      <PageContainer>
        <QueryErrorState onRetry={() => void refetch()} />
      </PageContainer>
    );
  }

  if (!isLoading && !data) {
    return (
      <PageContainer>
        <EmptyState
          icon={<Scale size={28} />}
          title={t("financialBalanceCurrentSituation")}
          description={t("empty", { ns: "common" })}
        />
      </PageContainer>
    );
  }

  const balance = data ?? {
    currentSituation: 0,
    difference: 0,
    main: { balance: 0 },
    markets: { marketsTotalBalans: 0, marketsTotalBalance: 0, items: [] },
    couriers: { couriersTotalBalanse: 0, couriersTotalBalance: 0, items: [] },
  };
  const total = balance.currentSituation;
  const isNegative = total < 0;

  const tabs = [
    {
      key: "overview" as const,
      label: t("financialBalanceOverview"),
      icon: <Scale size={16} />,
    },
    {
      key: "history" as const,
      label: t("history"),
      icon: <History size={16} />,
    },
    {
      key: "analysis" as const,
      label: t("financialBalanceAnalysis"),
      icon: <ChartColumn size={16} />,
    },
  ];

  const cards: BalanceCard[] = [
    {
      label: t("cashbox"),
      subLabel: t("financialBalanceCashAvailable"),
      subType: "neutral",
      amount: balance.main.balance,
      icon: <Briefcase size={18} />,
      colorClass: "purple",
    },
    {
      label: t("financialBalanceMarkets"),
      subLabel: t("financialBalanceMarketsDebt"),
      subType: "negative",
      amount: balance.markets.marketsTotalBalans,
      icon: <Store size={18} />,
      colorClass: "red",
    },
    {
      label: t("financialBalanceCouriers"),
      subLabel: t("financialBalanceCouriersMoney"),
      subType: "positive",
      amount: balance.couriers.couriersTotalBalanse,
      icon: <Truck size={18} />,
      colorClass: "green",
    },
  ];

  return (
    <PageContainer className="flex flex-col">
      <div className="flex flex-col rounded-2xl bg-primary dark:bg-maindark">
      {/* Hero */}
      <div
        className={`relative shrink-0 overflow-hidden px-5 py-4 transition-colors duration-500 sm:px-6 ${isNegative
          ? "bg-linear-to-br from-red-800 via-red-600 to-red-800"
          : "bg-linear-to-br from-emerald-800 via-emerald-600 to-emerald-800"
          }`}
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative">
          <HeaderName
            name={t("financialBalanceCurrentSituation")}
            description={t("financialBalanceMarketsAndCouriers")}
            icon={<Scale />}
          />
          <div className="mt-2.5 flex items-end justify-between">
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <span
                className={`inline-block w-2 h-2 rounded-full animate-pulse ${isNegative ? "bg-red-300" : "bg-emerald-300"
                  }`}
              />
              {isNegative ? t("financialBalanceNegativeState") : t("financialBalancePositiveState")}
            </div>
            <div className="text-right">
              {isLoading ? (
                <div className="h-10 w-48 bg-white/10 animate-pulse rounded-lg" />
              ) : (
                <p
                  className={`text-3xl font-black leading-none tracking-wider sm:text-4xl ${isNegative ? "text-red-100" : "text-emerald-100"
                    }`}
                >
                  {formatFinancialAmount(total)}
                </p>
              )}
              <p className="text-white/50 text-xs tracking-widest mt-1">{currencyLabel}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="grid shrink-0 grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const colors = colorMap[card.colorClass];
          const maxAbs = Math.max(...cards.map((c) => Math.abs(c.amount)), 1);
          const barWidth = Math.round((Math.abs(card.amount) / maxAbs) * 100);

          return (
            <div
              key={card.label}
              className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-card-surface-strong)] p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-main/40 dark:border-white/10 dark:bg-white/5 dark:hover:border-main/50"
            >
              <div className="mb-2.5 flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${colors.icon}`}
                >
                  {card.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-maindark dark:text-white/90 leading-tight">
                    {card.label}
                  </p>
                  <p className={`text-xs mt-0.5 ${subLabelColor[card.subType]}`}>
                    {card.subLabel}
                  </p>
                </div>
              </div>

              {isLoading ? (
                <div className="h-8 w-32 bg-white/5 animate-pulse rounded-md" />
              ) : (
                <p
                  className={`font-black text-2xl tracking-wide leading-none ${colors.amount}`}
                >
                  {formatFinancialAmount(card.amount)}
                </p>
              )}
              <p className="text-[11px] text-maindark/40 dark:text-slate-500 tracking-widest mt-1">
                {currencyLabel}
              </p>

              <div className="mt-2.5 h-0.5 rounded-full bg-gray-200 dark:bg-white/5">
                <div
                  className={`h-full rounded-full ${colors.bar}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 px-4 pb-3">
        <div className="grid grid-cols-1 gap-2 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-card-surface)] p-2 shadow-sm dark:border-white/10 dark:bg-white/5 sm:grid-cols-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${isActive
                  ? "border-main bg-main text-white shadow-lg shadow-main/25"
                  : "border-[color:var(--color-border-soft)] bg-[color:var(--color-card-surface-strong)] text-[color:var(--color-maindark)] shadow-sm hover:border-main/50 hover:bg-main/10 hover:text-main dark:border-white/10 dark:bg-white/5 dark:text-primary dark:hover:bg-white/10 dark:hover:text-white"
                  }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pb-4">
        {activeTab === "overview" ? (
          <div className="flex flex-col gap-3">
            <Statistics data={balance} />
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <SettlementListCard
                title={t("financialBalanceMarkets")}
                description={t("financialBalanceMarketsSettlement")}
                count={balance.markets.items.length}
                icon={<Store size={18} />}
                iconClassName="bg-purple-600/20 text-purple-500 dark:text-purple-300"
                total={balance.markets.marketsTotalBalans}
                rows={balance.markets.items}
                amountClassName="text-red-500 dark:text-red-400"
                emptyText={t("financialBalanceListEmpty")}
                countSuffix={t("financialBalanceCountSuffix")}
                totalLabel={t("total")}
                currencyLabel={currencyLabel}
              />
              <SettlementListCard
                title={t("financialBalanceCouriers")}
                description={t("financialBalanceCouriersSettlement")}
                count={balance.couriers.items.length}
                icon={<Truck size={18} />}
                iconClassName="bg-blue-600/20 text-blue-600 dark:text-blue-300"
                total={balance.couriers.couriersTotalBalanse}
                rows={balance.couriers.items}
                amountClassName="text-emerald-600 dark:text-emerald-400"
                emptyText={t("financialBalanceListEmpty")}
                countSuffix={t("financialBalanceCountSuffix")}
                totalLabel={t("total")}
                currencyLabel={currencyLabel}
              />
            </div>
          </div>
        ) : activeTab === "history" ? (
          <HistoryTab />
        ) : (
          <AnalysisTab />
        )}
      </div>
      </div>
    </PageContainer>
  );
};

export default memo(FinancialBalance);
