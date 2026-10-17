// dizayn-v2: manager-branch-dashboard-main
import { CircleCheck, CircleX, PackagePlus, Trophy, Truck } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { canViewBatchesPage } from "../../../app/lib/access";
import type { RootState } from "../../../app/config/store";
import { useDashboard } from "../../../entities/dashboard";
import { periodLabel, resolveDashboardPeriod, share } from "../../../entities/dashboard/lib/period";
import { readProfileBranchName } from "../../../entities/dashboard/lib/profile";
import { getCurrentBranchId } from "../../../shared/lib/currentBranch";
import { getTodayRange } from "../../../shared/lib/dateRange";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { removeFilterValue, setMultipleFilters } from "../../../shared/model/filterSlice";
import { Card, EmptyState, ErrorState } from "../../../shared/ui/primitives";
import DashboardHeader from "../../../widgets/dashboard-statistics/ui/DashboardHeader";
import { CardRow, LoadingChartCard } from "../../../widgets/dashboard-statistics/ui/DashboardGrid";
import OrderStatusCard from "../../../widgets/dashboard-statistics/ui/OrderStatusCard";
import SuccessRateCard from "../../../widgets/dashboard-statistics/ui/SuccessRateCard";
import { branchRows, toRankItems } from "../../../widgets/dashboard-top-performers/lib/rankItems";
import TopRankCard from "../../../widgets/dashboard-top-performers/ui/TopRankCard";
import { adaptBranchDashboard } from "./branchDashboardAdapter";
import { ActivePackagesCard, CouriersCard, MarketsBreakdownCard } from "./BranchCards";

const GOOD_ZONE = 0.7;

/**
 * FILIAL PANELI — menejer (`/branch-dashboard`, maket `manager-branch-dashboard-main`).
 *
 * Saqlanadigan xulq: davr redux'da, sukut — bugun (`getTodayRange`), «Barchasi» — aniq sanalar (`all` emas),
 * `branch_id` so'rovda; ma'lumot `adaptBranchDashboard` (o'zgarmaydi); filial paneli kelmasa yoki
 * `stats_unavailable` — nollar o'rniga `ErrorState` «Statistika vaqtincha mavjud emas» (fix3 C9);
 * kartalar `visibility.*` bo'yicha; so'rov xatosi — `loadError` + «Qayta urinish».
 */
const BranchDashboardPage = () => {
  const { t, i18n } = useTranslation("branchDashboard");
  const { t: tDash } = useTranslation("dashboard");
  const language = i18n.language;
  const dispatch = useDispatch();
  const userRole = useSelector((state: RootState) => state.role.role);
  const user = useSelector((state: RootState) => state.user.user);
  const userId = user?.id;
  const branchId = useSelector(getCurrentBranchId);
  const canOpenBatches = useSelector(canViewBatchesPage);
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
  const { data, isLoading, isError, refetch } = getDashboard(analyticsParams, true, analyticsScope);
  const rawBranchDashboard = data?.data?.branchDashboard;
  // fix3 C9 (CODE-23): filial raqamlari olinmadi — nollar haqiqiy emas, ko'rsatilmaydi.
  const isStatsUnavailable = Boolean(data) && (!rawBranchDashboard || rawBranchDashboard.stats_unavailable === true);
  const dashboard = adaptBranchDashboard(rawBranchDashboard, userRole || "OPERATOR", undefined, false);

  const applyRange = useCallback(
    (range: { from: string; to: string }) => {
      setFromDate(range.from);
      setToDate(range.to);
      dispatch(setMultipleFilters({ dashboardFromDate: range.from, dashboardToDate: range.to }));
    },
    [dispatch],
  );
  const clearRange = useCallback(() => {
    setFromDate(defaultDateRange.from);
    setToDate(defaultDateRange.to);
    dispatch(removeFilterValue("dashboardFromDate"));
    dispatch(removeFilterValue("dashboardToDate"));
  }, [defaultDateRange.from, defaultDateRange.to, dispatch]);

  const period = resolveDashboardPeriod(fromDate, toDate);
  const periodText = periodLabel(tDash, period);
  const branchName = readProfileBranchName(user) ?? t("branchFallback");
  const count = (value: number) => formatNumberLocalized(value, { language });
  const summary = dashboard.orderSummary;
  const rate = share(summary.delivered, summary.total);
  const needed = Math.ceil(GOOD_ZONE * summary.total) - summary.delivered;

  const description = (
    <>
      <span>{t("v2.subtitle", { branch: branchName })}</span>{" "}
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-success-fg">
        <span aria-hidden="true" className="size-2 rounded-full bg-success" />
        {isLoading ? t("loading") : t("liveData")}
      </span>
    </>
  );

  const header = (
    <DashboardHeader
      description={description}
      fromDate={fromDate}
      toDate={toDate}
      onChange={applyRange}
      onClear={clearRange}
      showYear={false}
      clearable={!(fromDate === defaultDateRange.from && toDate === defaultDateRange.to)}
    />
  );

  if (isError) {
    return (
      <div className="flex flex-col gap-6 max-md:gap-4">
        {header}
        <Card>
          <ErrorState description={t("loadError")} onRetry={() => void refetch()} />
        </Card>
      </div>
    );
  }

  // «Top filiallar»: top 5 + o'z filiali 6-qator (top 5 da bo'lmasa).
  const rows = branchRows(data?.data?.topBranches);
  const ownIndex = branchId ? rows.findIndex((row) => row.id === String(branchId)) : -1;
  const selfBadge = { label: t("v2.top.yourBranch"), tone: "neutral" as const, outline: true };
  const items = toRankItems(rows.slice(0, 5), { t: tDash, language, selfId: branchId, selfBadge });
  const pinned =
    ownIndex >= 5
      ? toRankItems([rows[ownIndex]], { t: tDash, language, selfId: branchId, selfBadge, startRank: ownIndex + 1 })[0]
      : undefined;
  const meta = data?.data?.topBranchesMeta;

  const visibility = dashboard.visibility;
  const showOrders = visibility.orders;
  const showSide = visibility.packages || visibility.couriers;

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      {header}

      {isStatsUnavailable ? (
        <Card>
          <ErrorState description={t("statsUnavailable")} onRetry={() => void refetch()} />
        </Card>
      ) : isLoading ? (
        <CardRow>
          <LoadingChartCard title={tDash("v2Dashboard.success.title")} />
          <LoadingChartCard title={tDash("v2Dashboard.status.title")} />
        </CardRow>
      ) : (
        <CardRow>
          {showOrders ? (
            <SuccessRateCard
              rate={rate}
              sold={summary.delivered}
              cancelled={summary.returned}
              description={tDash("v2Dashboard.success.subScoped", { period: periodText, scope: branchName })}
              gaugeLabel={tDash("v2Dashboard.success.gaugeTotal")}
              showThreshold={false}
              note={summary.total > 0 && needed > 0 ? t("v2.success.needed", { count: needed }) : undefined}
            />
          ) : null}
          {showOrders ? (
            <OrderStatusCard
              total={summary.total}
              description={t("v2.status.sub", { period: periodText })}
              centerLabel={t("totalOrdersCount")}
              listHref="/orders"
              note={t("v2.status.note", { count: count(summary.total) })}
              segments={[
                { key: "new", label: t("new"), value: summary.new, tone: "info", icon: PackagePlus },
                { key: "road", label: t("onTheRoad"), value: summary.onTheRoad, tone: "warning", icon: Truck },
                { key: "sold", label: t("delivered"), value: summary.delivered, tone: "success", icon: CircleCheck },
                { key: "cancelled", label: t("returned"), value: summary.returned, tone: "danger", icon: CircleX },
              ]}
            />
          ) : null}
          {showSide ? (
            <div className="flex min-w-0 flex-col gap-4 max-md:gap-3">
              {visibility.packages ? <ActivePackagesCard packages={dashboard.packages} canOpenBatches={canOpenBatches} /> : null}
              {visibility.couriers ? <CouriersCard couriers={dashboard.couriers} /> : null}
            </div>
          ) : null}
        </CardRow>
      )}

      {!isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3 max-md:gap-3">
          {!isStatsUnavailable && visibility.markets ? (
            <MarketsBreakdownCard markets={dashboard.markets} className="lg:col-span-2" />
          ) : null}
          <TopRankCard
            className={!isStatsUnavailable && visibility.markets ? undefined : "lg:col-span-3"}
            title={tDash("v2Dashboard.top.branches")}
            description={t("v2.top.sub")}
            items={items}
            pinned={pinned}
            expandable
            empty={<EmptyState size="chart" icon={Trophy} title={tDash("v2Dashboard.top.emptyTitle")} />}
            note={items.length > 0 && ((meta?.filtered_out ?? 0) > 0 || items.length < 5) ? tDash("v2Dashboard.top.limited") : undefined}
          />
        </div>
      ) : null}
    </div>
  );
};

export default memo(BranchDashboardPage);
