import { memo, useEffect, useMemo, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import DashboardStatistics from "../../widgets/dashboard-statistics/ui/DashboardStatistics";
import FinancialAnalysis from "../../widgets/financial-analysis/ui/FinancialAnalysis";
import { useDashboard } from "../../entities/dashboard";
import CustomDatePicker from "../../shared/ui/CustomDatePicker";
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

  const quickRanges = useMemo(() => {
    const today = new Date();
    const formatDate = (date: Date) => date.toISOString().slice(0, 10);

    const weekStart = new Date(today);
    const day = weekStart.getDay();
    const diff = day === 0 ? 6 : day - 1;
    weekStart.setDate(weekStart.getDate() - diff);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const todayIso = formatDate(today);

    return [
      { key: "today", label: t("quickRanges.today"), from: todayIso, to: todayIso },
      { key: "week", label: t("quickRanges.week"), from: formatDate(weekStart), to: todayIso },
      { key: "month", label: t("quickRanges.month"), from: formatDate(monthStart), to: todayIso },
    ];
  }, [t]);

  const hasDateFilter = Boolean(fromDate || toDate);

  const { getDashboard } = useDashboard();
  const { data } = getDashboard({
    start_day: fromDate,
    end_day: toDate,
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
        <div className="flex flex-col items-end gap-3">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {quickRanges.map((range) => {
              const isActive = fromDate === range.from && toDate === range.to;

              return (
                <button
                  key={range.key}
                  type="button"
                  onClick={() => {
                    setFromDate(range.from);
                    setToDate(range.to);
                  }}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-main text-primary shadow-sm shadow-main/20"
                      : "border border-gray-200 bg-white text-maindark hover:border-main/30 hover:text-main dark:border-white/10 dark:bg-primarydark dark:text-primary"
                  }`}
                >
                  {range.label}
                </button>
              );
            })}

            {hasDateFilter && (
              <button
                type="button"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                  dispatch(removeFilterValue("dashboardFromDate"));
                  dispatch(removeFilterValue("dashboardToDate"));
                }}
                className="rounded-xl border border-error/20 bg-error/8 px-3 py-2 text-xs font-semibold text-error transition-opacity hover:opacity-85"
              >
                {t("quickRanges.clear")}
              </button>
            )}
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <CustomDatePicker
              value={fromDate}
              onChange={setFromDate}
              placeholder={t("datePicker.from")}
              maxDate={toDate || undefined}
              className="w-full sm:w-44"
            />
            <span className="hidden text-sm text-maindark/30 dark:text-primary/30 sm:inline">-</span>
            <CustomDatePicker
              value={toDate}
              onChange={setToDate}
              placeholder={t("datePicker.to")}
              minDate={fromDate || undefined}
              className="w-full sm:w-44"
            />
          </div>
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
