import { memo, useCallback, useEffect, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import DashboardStatistics from "../../widgets/dashboard-statistics/ui/DashboardStatistics";
import FinancialAnalysis from "../../widgets/financial-analysis/ui/FinancialAnalysis";
import { useDashboard } from "../../entities/dashboard";
import HeaderName from "../../shared/components/headerName";
import QuickDateRangeFilter from "../../shared/ui/QuickDateRangeFilter";
import type { RootState } from "../../app/config/store";
import {
  removeFilterValue,
  setMultipleFilters,
} from "../../features/Select/model/FilterSlice";

// ─── DashboardPage ────────────────────────────────────────────────────────────

const DashboardPage = () => {
  const { t } = useTranslation("dashboard");
  const dispatch = useDispatch();
  const filters = useSelector((state: RootState) => state.filter);

  const initialFromDate =
    typeof filters.dashboardFromDate === "string" ? filters.dashboardFromDate : "";
  const initialToDate =
    typeof filters.dashboardToDate === "string" ? filters.dashboardToDate : "";

  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);

  useEffect(() => {
    dispatch(
      setMultipleFilters({
        dashboardFromDate: fromDate,
        dashboardToDate: toDate,
      }),
    );
  }, [dispatch, fromDate, toDate]);

  const hasDateFilter = Boolean(fromDate || toDate);

  const applyRange = useCallback((range: { from: string; to: string }) => {
    setFromDate(range.from);
    setToDate(range.to);
  }, []);

  const { getDashboard } = useDashboard();
  const { data } = getDashboard({
    start_day: fromDate,
    end_day: toDate,
  });

  const orders = data?.data?.orders;

  return (
    <div className="min-h-full">
      {/* Page header */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <HeaderName
          name={hasDateFilter ? t("page_title_filtered") : t("page_title_today")}
          description={hasDateFilter ? t("page_subtitle_filtered") : t("page_subtitle_today")}
          icon={<LayoutDashboard />}
        />
        <div className="flex w-full flex-col gap-2 lg:w-auto lg:items-end">
          <QuickDateRangeFilter
            fromDate={fromDate}
            toDate={toDate}
            onChange={applyRange}
            onClear={() => {
              setFromDate("");
              setToDate("");
              dispatch(removeFilterValue("dashboardFromDate"));
              dispatch(removeFilterValue("dashboardToDate"));
            }}
            labels={{
              today: t("quickRanges.today"),
              week: t("quickRanges.week"),
              month: t("quickRanges.month"),
            }}
            placeholder={`${t("datePicker.from")} → ${t("datePicker.to")}`}
            className="lg:items-end"
            pickerClassName="w-full sm:w-88"
            clearClassName="sm:w-auto"
          />
        </div>
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
        startDate={fromDate}
        endDate={toDate}
      />
    </div>
  );
};

export default memo(DashboardPage);
