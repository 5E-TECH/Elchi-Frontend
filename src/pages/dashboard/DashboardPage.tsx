import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import DashboardStatistics from "../../widgets/dashboard-statistics/ui/DashboardStatistics";
import FinancialAnalysis from "../../widgets/financial-analysis/ui/FinancialAnalysis";
import { useDashboard } from "../../entities/dashboard";
import HeaderName from "../../shared/components/headerName";
import DateRangePicker from "../../shared/ui/DateRangePicker";
import FilterClearButton from "../../shared/ui/FilterClearButton";
import type { RootState } from "../../app/config/store";
import {
  removeFilterValue,
  setMultipleFilters,
} from "../../features/Select/model/FilterSlice";

// ─── Sana yordamchilari ───────────────────────────────────────────────────────

const toISO = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const parseISO = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const getToday = () => {
  const now = new Date();
  return { from: toISO(now), to: toISO(now) };
};

const getThisWeek = () => {
  const now = new Date();
  const day = now.getDay() === 0 ? 6 : now.getDay() - 1; // Dushanba = 0
  const from = new Date(now);
  from.setDate(now.getDate() - day);
  return { from: toISO(from), to: toISO(now) };
};

const getThisMonth = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toISO(from), to: toISO(now) };
};

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

  // ─── Tezkor tugmalar ────────────────────────────────────────────────────────
  const applyRange = useCallback((range: { from: string; to: string }) => {
    setFromDate(range.from);
    setToDate(range.to);
  }, []);

  const todayRange = useMemo(() => getToday(), []);
  const weekRange = useMemo(() => getThisWeek(), []);
  const monthRange = useMemo(() => getThisMonth(), []);

  const activeQuick = useMemo(() => {
    if (fromDate === todayRange.from && toDate === todayRange.to) return "today";
    if (fromDate === weekRange.from && toDate === weekRange.to) return "week";
    if (fromDate === monthRange.from && toDate === monthRange.to) return "month";
    return null;
  }, [fromDate, toDate, todayRange, weekRange, monthRange]);

  const { getDashboard } = useDashboard();
  const { data } = getDashboard({
    start_day: fromDate,
    end_day: toDate,
  });

  const orders = data?.data?.orders;

  return (
    <div className="min-h-full rounded-2xl p-5 bg-primary dark:bg-maindark">
      {/* Page header */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <HeaderName
          name={hasDateFilter ? t("page_title_filtered") : t("page_title_today")}
          description={hasDateFilter ? t("page_subtitle_filtered") : t("page_subtitle_today")}
          icon={<LayoutDashboard />}
        />
        <div className="flex w-full flex-col gap-2 lg:w-auto lg:items-end">
          {/* Tezkor tugmalar */}
          <div className="flex gap-1.5">
            {(
              [
                { key: "today", range: todayRange },
                { key: "week", range: weekRange },
                { key: "month", range: monthRange },
              ] as const
            ).map(({ key, range }) => {
              const isActive = activeQuick === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyRange(range)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${isActive
                      ? "bg-(--color-main) text-white"
                      : "bg-glass text-maindark/70 dark:text-sidebar/80"
                    }`}
                >
                  {t(`quickRanges.${key}`)}
                </button>
              );
            })}
          </div>

          {/* Sanalar va tozalash */}
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
            <DateRangePicker
              value={{
                startDate: fromDate ? parseISO(fromDate) : null,
                endDate: toDate ? parseISO(toDate) : null,
              }}
              onChange={({ startDate, endDate }) => {
                setFromDate(startDate ? toISO(startDate) : "");
                setToDate(endDate ? toISO(endDate) : "");
              }}
              placeholder={`${t("datePicker.from")} → ${t("datePicker.to")}`}
              className="w-full sm:w-88"
            />
            {hasDateFilter && (
              <FilterClearButton
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                  dispatch(removeFilterValue("dashboardFromDate"));
                  dispatch(removeFilterValue("dashboardToDate"));
                }}
                className="sm:w-auto"
              />
            )}
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
