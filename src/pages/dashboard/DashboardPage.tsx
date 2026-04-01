import { memo } from "react";
import { LayoutDashboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardStatistics from "../../widgets/dashboard-statistics/ui/DashboardStatistics";
import FinancialAnalysis from "../../widgets/financial-analysis/ui/FinancialAnalysis";
import { useDashboard } from "../../entities/dashboard";
import FilterDateRange from "../../shared/ui/FilterDateRange";

import { useQueryParams } from "../../shared/lib/useQueryParams";

// ─── DashboardPage ────────────────────────────────────────────────────────────

const DashboardPage = () => {
  const { t } = useTranslation("dashboard");
  const { getParam, setParam } = useQueryParams();

  const startDate = getParam("startDate") ?? "";
  const endDate = getParam("endDate") ?? "";
  const hasDateFilter = Boolean(startDate || endDate);

  const { getDashboard } = useDashboard();
  const { data } = getDashboard({
    start_day: startDate,
    end_day: endDate,
  });

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
              {hasDateFilter ? t("page_title_filtered") : t("page_title_today")}
            </h1>
            <p className="text-[11px] text-maindark/50 dark:text-sidebar/50">
              {hasDateFilter ? t("page_subtitle_filtered") : t("page_subtitle_today")}
            </p>
          </div>
        </div>
        <FilterDateRange
          dateFrom={startDate}
          dateTo={endDate}
          onChangeDateFrom={(val) => setParam("startDate", val)}
          onChangeDateTo={(val) => setParam("endDate", val)}
        />
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
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
};

export default memo(DashboardPage);
