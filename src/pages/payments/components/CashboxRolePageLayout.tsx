import { memo, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarClock, ListFilter, Repeat2 } from "lucide-react";
import HeaderName from "../../../shared/components/headerName";
import DateRangePicker from "../../../shared/ui/DateRangePicker";
import PaymentHistoryList from "./PaymentHistoryList";
import CashboxSummaryCard from "./CashboxSummaryCard";
import type { PaymentRow } from "./patmentHistoryTable";
import PageContainer from "../../../shared/ui/PageContainer";
import BackButton from "../../../shared/ui/BackButton";
import { useTranslation } from "react-i18next";

interface CashboxRolePageLayoutProps {
  entityName: string;
  description: string;
  headerIcon: ReactNode;
  onBack?: () => void;
  accentClass: string;
  accentIcon: ReactNode;
  summarySubtitle: string;
  balance: number;
  balanceLabel?: string;
  balanceVisible: boolean;
  onToggleBalanceVisibility: () => void;
  dateRangeValue: {
    startDate: Date | null;
    endDate: Date | null;
  };
  onDateRangeChange: (params: { startDate: Date | null; endDate: Date | null }) => void;
  dateRangePlaceholder: string;
  incomeAmount: number;
  expenseAmount: number;
  historyRows: PaymentRow[];
  incomeLabel: string;
  expenseLabel: string;
  todayTransactionsLabel: string;
  todayOperationsLabel: string;
  actionForm?: ReactNode;
  summaryDetails?: ReactNode;
  historyTab?: "all" | "payments";
  onHistoryTabChange?: (tab: "all" | "payments") => void;
  allHistoryLabel?: string;
  paymentsHistoryLabel?: string;
}

const fmt = (n: number) => n.toLocaleString("uz-UZ");

const sectionClassName =
  "overflow-hidden rounded-[1.5rem] border border-[color:var(--color-border-soft)] bg-primary shadow-sm dark:bg-primarydark";

const sectionHeaderClassName =
  "border-b border-[color:var(--color-border-soft)] px-4 py-3.5";

const CashboxRolePageLayout = ({
  entityName,
  description,
  headerIcon,
  onBack,
  accentClass,
  accentIcon,
  summarySubtitle,
  balance,
  balanceLabel,
  balanceVisible,
  onToggleBalanceVisibility,
  dateRangeValue,
  onDateRangeChange,
  dateRangePlaceholder,
  incomeAmount,
  expenseAmount,
  historyRows,
  incomeLabel,
  expenseLabel,
  todayTransactionsLabel,
  todayOperationsLabel,
  actionForm,
  summaryDetails,
  historyTab = "all",
  onHistoryTabChange,
  allHistoryLabel,
  paymentsHistoryLabel,
}: CashboxRolePageLayoutProps) => {
  const { t } = useTranslation("payments");
  const tabs = [
    {
      key: "all" as const,
      label: allHistoryLabel ?? t("allHistory"),
      icon: <ListFilter size={15} />,
    },
    {
      key: "payments" as const,
      label: paymentsHistoryLabel ?? t("paymentTransfers"),
      icon: <Repeat2 size={15} />,
    },
  ];

  return (
    <PageContainer className="flex min-w-0 flex-col gap-3 overflow-x-hidden">
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(19rem,0.42fr)_minmax(0,0.58fr)]">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex items-center gap-3 px-1">
            {onBack ? (
              <BackButton onClick={onBack} className="h-11 min-w-11 shrink-0 rounded-2xl px-2" label="" />
            ) : null}
            <HeaderName
              name={entityName}
              description={description}
              icon={headerIcon}
            />
          </div>

          <CashboxSummaryCard
            accentClass={accentClass}
            accentIcon={accentIcon}
            title="ELCHI"
            subtitle={summarySubtitle}
            holderName={entityName}
            balance={balance}
            balanceLabel={balanceLabel}
            balanceVisible={balanceVisible}
            onToggleVisibility={onToggleBalanceVisibility}
          />

          {actionForm}
          {summaryDetails}
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-3 xl:pt-1">
          <div className={sectionClassName}>
            <div className={sectionHeaderClassName}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-main text-primary shadow-lg shadow-main/20">
                    <CalendarClock size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {todayTransactionsLabel}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-white/40">
                      {todayOperationsLabel}
                    </p>
                  </div>
                </div>

                <DateRangePicker
                  value={dateRangeValue}
                  onChange={onDateRangeChange}
                  placeholder={dateRangePlaceholder}
                  className="w-full lg:max-w-[360px]"
                />
              </div>
            </div>
            <div className="p-3 sm:p-4">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => {
                  const active = historyTab === tab.key;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => onHistoryTabChange?.(tab.key)}
                      className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-all ${
                        active
                          ? "border-main bg-main text-primary shadow-lg shadow-main/20"
                          : "border-[color:var(--color-border-soft)] bg-white/5 text-gray-500 hover:text-gray-900 dark:text-white/55 dark:hover:text-white"
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                  <ArrowUpRight size={18} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500/70">
                    {incomeLabel}
                  </p>
                  <p className="text-lg font-black text-emerald-500">
                    +{fmt(incomeAmount)} {t("currency")}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/8 p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
                  <ArrowDownRight size={18} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-500/70">
                    {expenseLabel}
                  </p>
                  <p className="text-lg font-black text-rose-400">
                    -{fmt(expenseAmount)} {t("currency")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-[16rem] flex-1 overflow-hidden xl:min-h-0 xl:max-h-[calc(100vh-18rem)]">
            <PaymentHistoryList
              data={historyRows}
            />
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default memo(CashboxRolePageLayout);
