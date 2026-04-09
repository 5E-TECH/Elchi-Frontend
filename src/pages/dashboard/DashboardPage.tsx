import { memo, useCallback, useEffect, useMemo, useState } from "react";
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

// ─── Sana yordamchilari ───────────────────────────────────────────────────────

const toISO = (d: Date) => d.toISOString().slice(0, 10);

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
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                  style={
                    isActive
                      ? {
                        background: "var(--color-main)",
                        color: "var(--color-primary)",
                      }
                      : {
                        background: "var(--color-glass)",
                        color: "var(--color-maindark)",
                        opacity: 0.75,
                      }
                  }
                >
                  {t(`quickRanges.${key}`)}
                </button>
              );
            })}
          </div>

          {/* Sanalar va tozalash */}
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
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
            {hasDateFilter && (
              <button
                type="button"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                  dispatch(removeFilterValue("dashboardFromDate"));
                  dispatch(removeFilterValue("dashboardToDate"));
                }}
                className="rounded-xl border border-error/20 bg-error/8 px-3 py-2 text-xs font-semibold text-error transition-opacity hover:opacity-85 sm:w-auto"
              >
                {t("quickRanges.clear")}
              </button>
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
