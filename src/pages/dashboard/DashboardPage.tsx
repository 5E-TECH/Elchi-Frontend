import { memo } from "react";
import { LayoutDashboard, Calendar } from "lucide-react";
import DashboardStatistics from "../../widgets/dashboard-statistics/ui/DashboardStatistics";
import FinancialAnalysis from "../../widgets/financial-analysis/ui/FinancialAnalysis";
import { useDashboard } from "../../entities/dashboard";

// ─── DateRangePicker ──────────────────────────────────────────────────────────

const DateRangePicker = memo(() => (
  <div
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px]
      bg-sidebar dark:bg-maindark border border-primarydark"
  >
    <input
      type="text"
      placeholder="Start date"
      className="bg-transparent border-none outline-none w-20 text-[11px]
        text-maindark dark:text-primary placeholder:text-primarydark"
    />
    <span className="text-primarydark">—</span>
    <input
      type="text"
      placeholder="End date"
      className="bg-transparent border-none outline-none w-20 text-[11px]
        text-maindark dark:text-primary placeholder:text-primarydark"
    />
    <Calendar size={13} className="text-primarydark shrink-0" />
  </div>
));

DateRangePicker.displayName = "DateRangePicker";

// ─── DashboardPage ────────────────────────────────────────────────────────────

const DashboardPage = () => {
  const { getDashboard } = useDashboard();
  const { data } = getDashboard();

  const orders = data?.orders;

  return (
    <div className="min-h-full rounded-2xl p-5 bg-primary dark:bg-maindark">
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "var(--color-main)", color: "var(--color-primary)" }}
          >
            <LayoutDashboard size={18} />
          </div>
          <div>
            <h1 className="text-[16px] font-bold leading-tight text-maindark dark:text-primary">
              Today's Statistics
            </h1>
            <p className="text-[11px] text-maindark/50 dark:text-sidebar/50">
              Date Range
            </p>
          </div>
        </div>
        <DateRangePicker />
      </div>

      {/* Stat cards */}
      <div className="mb-5">
        <DashboardStatistics
          totalOrders={orders?.acceptedCount ?? 0}
          sold={orders?.soldAndPaid ?? 0}
          cancelled={orders?.cancelled ?? 0}
          profit={orders?.profit ?? 0}
        />
      </div>

      {/* Financial analysis */}
      <FinancialAnalysis
        totalOrders={orders?.acceptedCount ?? 0}
        sold={orders?.soldAndPaid ?? 0}
        profit={orders?.profit ?? 0}
      />
    </div>
  );
};

export default memo(DashboardPage);