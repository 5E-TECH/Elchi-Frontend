import { memo, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarClock } from "lucide-react";
import HeaderName from "../../../shared/components/headerName";
import DateRangePicker from "../../../shared/ui/DateRangePicker";
import PaymentHistoryList from "./PaymentHistoryList";
import CashboxSummaryCard from "./CashboxSummaryCard";
import type { PaymentRow } from "./patmentHistoryTable";

interface CashboxRolePageLayoutProps {
  entityName: string;
  description: string;
  headerIcon: ReactNode;
  onHeaderIconClick?: () => void;
  accentClass: string;
  accentIcon: ReactNode;
  summarySubtitle: string;
  balance: number;
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
  onHeaderIconClick,
  accentClass,
  accentIcon,
  summarySubtitle,
  balance,
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
}: CashboxRolePageLayoutProps) => {
  return (
    <div className="flex min-h-full flex-col gap-3 overflow-x-hidden rounded-2xl p-2.5 sm:p-3 md:p-4 lg:p-5">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(18rem,0.42fr)_minmax(24rem,0.58fr)] lg:gap-4">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="px-1">
            <HeaderName
              name={entityName}
              description={description}
              icon={headerIcon}
              onIconClick={onHeaderIconClick}
            />
          </div>

          <CashboxSummaryCard
            accentClass={accentClass}
            accentIcon={accentIcon}
            title="ELCHI"
            subtitle={summarySubtitle}
            holderName={entityName}
            balance={balance}
            balanceVisible={balanceVisible}
            onToggleVisibility={onToggleBalanceVisibility}
          />

          {actionForm}
        </div>

        <div className="flex min-h-0 flex-col gap-3 lg:pt-1">
          <div className={sectionClassName}>
            <div className={sectionHeaderClassName}>
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
            </div>
            <div className="p-3 sm:p-4">
              <DateRangePicker
                value={dateRangeValue}
                onChange={onDateRangeChange}
                placeholder={dateRangePlaceholder}
                className="w-full md:max-w-[360px]"
              />
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
                    +{fmt(incomeAmount)} UZS
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
                    -{fmt(expenseAmount)} UZS
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-[16rem] flex-1 overflow-hidden max-h-none lg:min-h-0 lg:max-h-[52vh] xl:max-h-[calc(100vh-18rem)]">
            <PaymentHistoryList
              data={historyRows}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(CashboxRolePageLayout);
