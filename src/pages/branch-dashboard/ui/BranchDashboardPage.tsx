import { memo, useCallback, useMemo, useState } from "react";
import { Building2, CalendarRange, PackageCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import HeaderName from "../../../shared/components/headerName";
import { useDashboard } from "../../../entities/dashboard";
import {
  ActivePackagesCard,
  CourierActivityCard,
  MarketsPerformanceCard,
  OrdersOverviewCard,
} from "./BranchDashboardCards";
import { adaptBranchDashboard } from "./branchDashboardAdapter";
import PageContainer from "../../../shared/ui/PageContainer";
import QuickDateRangeFilter from "../../../shared/ui/QuickDateRangeFilter";
import QueryErrorState from "../../../shared/ui/QueryErrorState";
import TopPerformers from "../../../widgets/dashboard-top-performers/ui/TopPerformers";
import { getCurrentBranchId } from "../../../shared/lib/currentBranch";
import { getTodayRange } from "../../../shared/lib/dateRange";
import { removeFilterValue, setMultipleFilters } from "../../../features/Select/model/FilterSlice";
import type { RootState } from "../../../app/config/store";

const statCardClassName =
  "rounded-2xl border border-[color:var(--color-border-soft)] bg-white/70 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/[0.05]";

const BranchDashboardPage = () => {
  const { t } = useTranslation("branchDashboard");
  const dispatch = useDispatch();
  const userRole = useSelector((state: RootState) => state.role.role);
  const userId = useSelector((state: RootState) => state.user.user?.id);
  const branchId = useSelector(getCurrentBranchId);
  const storedFromDate = useSelector((state: RootState) => state.filter.dashboardFromDate);
  const storedToDate = useSelector((state: RootState) => state.filter.dashboardToDate);
  const defaultDateRange = useMemo(() => getTodayRange(), []);
  const [fromDate, setFromDate] = useState(
    typeof storedFromDate === "string" && storedFromDate ? storedFromDate : defaultDateRange.from,
  );
  const [toDate, setToDate] = useState(
    typeof storedToDate === "string" && storedToDate ? storedToDate : defaultDateRange.to,
  );
  const hasDateFilter = Boolean(fromDate && toDate);
  const analyticsScope = `${userRole || "unknown"}:${userId || "unknown"}`;
  const analyticsParams = useMemo(
    () => ({
      branch_id: branchId || "",
      start_day: hasDateFilter ? fromDate : "",
      end_day: hasDateFilter ? toDate : "",
    }),
    [branchId, fromDate, hasDateFilter, toDate],
  );
  const { getDashboard } = useDashboard();
  const { data, isLoading, isError, refetch } = getDashboard(
    analyticsParams,
    true,
    analyticsScope,
  );
  const hasBranchScope = Boolean(branchId);
  const branchDashboard = useMemo(
    () =>
      adaptBranchDashboard(
        data?.data?.branchDashboard,
        userRole || "OPERATOR",
        data?.data?.orders,
        hasBranchScope || hasDateFilter,
      ),
    [data?.data?.branchDashboard, data?.data?.orders, hasBranchScope, hasDateFilter, userRole],
  );
  const displayDashboard = branchDashboard;

  const isManager = displayDashboard.role === "MANAGER";
  const topBranches = data?.data?.topBranches ?? [];
  const applyRange = useCallback(
    (range: { from: string; to: string }) => {
      setFromDate(range.from);
      setToDate(range.to);
      dispatch(
        setMultipleFilters({
          dashboardFromDate: range.from,
          dashboardToDate: range.to,
        }),
      );
    },
    [dispatch],
  );
  const clearRange = useCallback(() => {
    setFromDate(defaultDateRange.from);
    setToDate(defaultDateRange.to);
    dispatch(removeFilterValue("dashboardFromDate"));
    dispatch(removeFilterValue("dashboardToDate"));
  }, [defaultDateRange.from, defaultDateRange.to, dispatch]);

  if (isError) {
    return (
      <PageContainer>
        <QueryErrorState
          description={t("loadError")}
          onRetry={() => void refetch()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="flex flex-col">
      <section className="mb-3 overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-main)_18%,var(--color-primary)_82%)_0%,color-mix(in_srgb,var(--color-sidebar)_92%,white_8%)_100%)] p-3.5 shadow-[0_18px_40px_rgba(87,106,219,0.12)] xl:shrink-0 dark:bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-main)_22%,var(--color-primarydark)_78%)_0%,color-mix(in_srgb,var(--color-maindark)_95%,var(--color-primarydark)_5%)_100%)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <HeaderName
              name={t("title")}
              description={t("subtitle")}
              icon={<Building2 />}
            />

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className={statCardClassName}>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                  <CalendarRange size={14} />
                  <span>{t("totalOrdersCount")}</span>
                </div>
                <p className="mt-1.5 text-[1.7rem] font-black leading-none text-maindark dark:text-white">
                  {displayDashboard.orderSummary.total}
                </p>
              </div>

              <div className={statCardClassName}>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                  <PackageCheck size={14} />
                  <span>{t("deliveredOrdersCount")}</span>
                </div>
                <p className="mt-1.5 text-[1.7rem] font-black leading-none text-maindark dark:text-white">
                  {displayDashboard.orderSummary.delivered}
                </p>
              </div>

              <div className={statCardClassName}>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                  <PackageCheck size={14} />
                  <span>{t("cancelledOrdersCount")}</span>
                </div>
                <p className="mt-1.5 text-[1.7rem] font-black leading-none text-maindark dark:text-white">
                  {displayDashboard.orderSummary.returned}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2.5 xl:items-end">
            <span className="inline-flex w-max rounded-xl border border-main/20 bg-main/10 px-3.5 py-2 text-sm font-extrabold text-main dark:text-white">
              {isManager ? t("managerMode") : t("operatorMode")}
            </span>
            <QuickDateRangeFilter
              fromDate={fromDate}
              toDate={toDate}
              onChange={applyRange}
              onClear={clearRange}
              includeAll
              className="xl:items-end"
              pickerClassName="w-full sm:w-88"
              clearClassName="sm:w-auto"
            />
            <div className="rounded-2xl border border-dashed border-main/20 bg-white/45 px-4 py-2.5 text-sm font-medium text-[color:var(--color-text-muted)] shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-[color:var(--color-text-muted-dark)]">
              {isLoading ? t("loading") : t("liveData")}
            </div>
          </div>
        </div>
      </section>

      <div className="grid content-start gap-3 xl:grid-cols-2">
        {displayDashboard.visibility.orders ? (
          <OrdersOverviewCard summary={displayDashboard.orderSummary} />
        ) : null}
        {displayDashboard.visibility.markets ? (
          <MarketsPerformanceCard markets={displayDashboard.markets} />
        ) : null}
        {displayDashboard.visibility.packages ? (
          <ActivePackagesCard packages={displayDashboard.packages} />
        ) : null}
        {displayDashboard.visibility.couriers ? (
          <CourierActivityCard couriers={displayDashboard.couriers} />
        ) : null}
      </div>

      {!isLoading ? (
        <section className="mt-3 xl:shrink-0">
          <TopPerformers branches={topBranches} compact />
        </section>
      ) : null}
    </PageContainer>
  );
};

export default memo(BranchDashboardPage);
