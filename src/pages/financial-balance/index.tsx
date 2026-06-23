import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import HeaderName from "../../shared/components/headerName";
import { Scale, Briefcase, Store, Truck, History, ChartColumn } from "lucide-react";
import Statistics from "./components/Statistics";
import HistoryTab from "./components/HistoryTab";
import { useCashBox } from "../../entities/payments";
import PageContainer from "../../shared/ui/PageContainer";
import { formatFinancialAmount, normalizeFinancialBalance } from "./lib/financialBalance";

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


const FinancialBalance = () => {
  const { t } = useTranslation("payments");
  const { getFinancialBalance } = useCashBox();
  const { data: response, isLoading, isError } = getFinancialBalance();
  const data = normalizeFinancialBalance(response);
  const currencyLabel = t("currency");
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "analysis">("overview");

  if (!isLoading && (isError || !data)) {
    return null;
  }

  if (!data) {
    return null;
  }

  const total = data.currentSituation;
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
      amount: data.main.balance,
      icon: <Briefcase size={18} />,
      colorClass: "purple",
    },
    {
      label: t("financialBalanceMarkets"),
      subLabel: t("financialBalanceMarketsDebt"),
      subType: "negative",
      amount: data.markets.marketsTotalBalans,
      icon: <Store size={18} />,
      colorClass: "red",
    },
    {
      label: t("financialBalanceCouriers"),
      subLabel: t("financialBalanceCouriersMoney"),
      subType: "positive",
      amount: data.couriers.couriersTotalBalanse,
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
              className="rounded-2xl border border-gray-200 bg-white/60 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-main/40 dark:border-glass-border dark:bg-transparent dark:hover:border-[#4A476A]"
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
        <div className="grid grid-cols-1 gap-2 rounded-2xl border border-[var(--color-border-soft)] bg-primary p-2 dark:border-primarydark/60 dark:bg-maindark sm:grid-cols-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${isActive
                  ? "bg-[var(--color-main-soft)] text-[var(--color-main)] dark:bg-primarydark/70 dark:text-primary"
                  : "text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)] hover:bg-[var(--color-table-row-alt)] dark:hover:bg-primarydark/70 hover:text-[var(--color-maindark)] dark:hover:text-[var(--color-primary)]"
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
        {activeTab === "overview" ? <Statistics data={data} /> : activeTab === "history" ? (
          <HistoryTab />
        ) : (
          <div className="rounded-2xl border border-gray-200 dark:border-glass-border bg-white dark:bg-maindark px-6 py-10 text-center">
            <p className="text-base font-semibold text-maindark dark:text-white/85">
              {t("financialBalanceAnalysis")}
            </p>
            <p className="mt-2 text-sm text-maindark/50 dark:text-slate-400">
              {t("financialBalanceComingSoon")}
            </p>
          </div>
        )}
      </div>
      </div>
    </PageContainer>
  );
};

export default memo(FinancialBalance);
