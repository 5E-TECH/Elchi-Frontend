import { memo, useCallback, useMemo, useState } from "react";
import { Building2, CalendarRange, PackageCheck } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import HeaderName from "../../../shared/components/headerName";
import { useDashboard } from "../../../entities/dashboard";
import { useOrders } from "../../../entities/order/api/orderApi";
import { useUser } from "../../../entities/user/api/userApi";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
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
import { getCurrentBranchId } from "../../../shared/lib/currentBranch";
import { getTodayRange } from "../../../shared/lib/dateRange";
import { removeFilterValue, setMultipleFilters } from "../../../features/Select/model/FilterSlice";
import type { RootState } from "../../../app/config/store";
import type { OrderListParams, OrderListResponse } from "../../../entities/order/types/order";

const statCardClassName =
  "rounded-2xl border border-[color:var(--color-border-soft)] bg-white/70 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/[0.05]";

const getOrdersTotal = (response?: OrderListResponse | null) => Number(response?.total ?? 0);

const SOLD_ORDER_STATUSES = ["sold", "paid"] as const;
const CANCELLED_ORDER_STATUSES = ["cancelled", "cancelled (sent)"] as const;

const getCourierOrders = (params: OrderListParams) =>
  api.get(API_ENDPOINTS.ORDERS.BASE, { params }).then((res) => res.data as OrderListResponse);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const extractList = (payload: unknown): unknown[] => {
  const source = asRecord(payload);
  const data = asRecord(source.data);

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(source.data)) return source.data as unknown[];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.couriers)) return data.couriers;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(source.items)) return source.items as unknown[];
  if (Array.isArray(source.couriers)) return source.couriers as unknown[];
  if (Array.isArray(source.rows)) return source.rows as unknown[];
  if (Array.isArray(source.results)) return source.results as unknown[];
  return [];
};

const getCourierId = (value: unknown) => {
  const item = asRecord(value);
  const user = asRecord(
    item.user ??
      item.employee ??
      item.courier ??
      item.identity_user ??
      item.identityUser ??
      item.profile ??
      item,
  );
  const id = user.id ?? item.user_id ?? item.userId ?? item.courier_id ?? item.courierId ?? item.id;

  return typeof id === "string" && id.trim()
    ? id
    : typeof id === "number"
      ? String(id)
      : "";
};

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
  const { useGetOrders } = useOrders();
  const { useGetCouriers } = useUser();
  const { data, isLoading, isError, refetch } = getDashboard(
    analyticsParams,
    true,
    analyticsScope,
  );
  const hasBranchScope = Boolean(branchId);
  const courierParams = useMemo(
    () => ({
      status: "active",
      branch_id: branchId,
      page: 1,
      limit: 100,
    }),
    [branchId],
  );
  const { data: couriersResponse } = useGetCouriers(courierParams, hasBranchScope);
  const branchOrderParams = useMemo(
    () => ({
      branch_id: branchId,
      start_day: hasDateFilter ? fromDate : "",
      end_day: hasDateFilter ? toDate : "",
      page: 1,
      limit: 10,
    }),
    [branchId, fromDate, hasDateFilter, toDate],
  );
  const branchOrdersQuery = useGetOrders(branchOrderParams, hasBranchScope);
  const branchSoldOrdersQuery = useGetOrders({
    ...branchOrderParams,
    status: [...SOLD_ORDER_STATUSES],
  }, hasBranchScope);
  const branchCancelledOrdersQuery = useGetOrders({
    ...branchOrderParams,
    status: [...CANCELLED_ORDER_STATUSES],
  }, hasBranchScope);
  const courierIds = useMemo(
    () =>
      extractList(couriersResponse)
        .map(getCourierId)
        .filter((id, index, items): id is string => Boolean(id) && items.indexOf(id) === index),
    [couriersResponse],
  );
  const courierOrderQueries = useQueries({
    queries: courierIds.flatMap((courierId) => {
      const baseParams = {
        courier_id: courierId,
        start_day: hasDateFilter ? fromDate : "",
        end_day: hasDateFilter ? toDate : "",
        page: 1,
        limit: 10,
      };

      return [
        {
          queryKey: ["branch-dashboard", "courier-orders", courierId, "all", baseParams],
          queryFn: () => getCourierOrders(baseParams),
          enabled: hasBranchScope,
        },
        {
          queryKey: ["branch-dashboard", "courier-orders", courierId, "sold", baseParams],
          queryFn: () => getCourierOrders({ ...baseParams, status: [...SOLD_ORDER_STATUSES] }),
          enabled: hasBranchScope,
        },
        {
          queryKey: ["branch-dashboard", "courier-orders", courierId, "cancelled", baseParams],
          queryFn: () => getCourierOrders({ ...baseParams, status: [...CANCELLED_ORDER_STATUSES] }),
          enabled: hasBranchScope,
        },
      ];
    }),
  });
  const courierOrderSummary = useMemo(
    () =>
      courierOrderQueries.reduce(
        (summary, query, index) => {
          const bucket = index % 3;
          const total = getOrdersTotal(query.data as OrderListResponse | undefined);

          if (bucket === 0) summary.acceptedCount += total;
          if (bucket === 1) summary.soldAndPaid += total;
          if (bucket === 2) summary.cancelled += total;

          return summary;
        },
        {
          acceptedCount: 0,
          soldAndPaid: 0,
          cancelled: 0,
        },
      ),
    [courierOrderQueries],
  );
  const branchOrderSummary = useMemo(
    () => {
      const orderListCancelled =
        getOrdersTotal(branchCancelledOrdersQuery.data) + courierOrderSummary.cancelled;
      const analyticsCancelled = Number(data?.data?.orders?.cancelled ?? 0);

      return {
        acceptedCount: getOrdersTotal(branchOrdersQuery.data) + courierOrderSummary.acceptedCount,
        soldAndPaid: getOrdersTotal(branchSoldOrdersQuery.data) + courierOrderSummary.soldAndPaid,
        cancelled: Math.max(orderListCancelled, analyticsCancelled),
        profit: 0,
        totalRevenue: 0,
      };
    },
    [
      branchCancelledOrdersQuery.data,
      branchOrdersQuery.data,
      branchSoldOrdersQuery.data,
      courierOrderSummary,
      data?.data?.orders?.cancelled,
    ],
  );

  const branchDashboard = useMemo(
    () =>
      adaptBranchDashboard(
        data?.data?.branchDashboard,
        userRole || "OPERATOR",
        hasBranchScope ? branchOrderSummary : data?.data?.orders,
        hasBranchScope || hasDateFilter,
      ),
    [branchOrderSummary, data?.data?.branchDashboard, data?.data?.orders, hasBranchScope, hasDateFilter, userRole],
  );

  const isManager = branchDashboard.role === "MANAGER";
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
    <PageContainer className="flex flex-col xl:h-full xl:min-h-0 xl:overflow-hidden">
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
                  {branchDashboard.orderSummary.total}
                </p>
              </div>

              <div className={statCardClassName}>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                  <PackageCheck size={14} />
                  <span>{t("deliveredOrdersCount")}</span>
                </div>
                <p className="mt-1.5 text-[1.7rem] font-black leading-none text-maindark dark:text-white">
                  {branchDashboard.orderSummary.delivered}
                </p>
              </div>

              <div className={statCardClassName}>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                  <PackageCheck size={14} />
                  <span>{t("cancelledOrdersCount")}</span>
                </div>
                <p className="mt-1.5 text-[1.7rem] font-black leading-none text-maindark dark:text-white">
                  {branchDashboard.orderSummary.returned}
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

      <div className="grid content-start gap-3 xl:min-h-0 xl:flex-1 xl:auto-rows-fr xl:content-stretch xl:grid-cols-2">
        {branchDashboard.visibility.orders ? (
          <OrdersOverviewCard summary={branchDashboard.orderSummary} />
        ) : null}
        {branchDashboard.visibility.markets ? (
          <MarketsPerformanceCard markets={branchDashboard.markets} />
        ) : null}
        {branchDashboard.visibility.packages ? (
          <ActivePackagesCard packages={branchDashboard.packages} />
        ) : null}
        {branchDashboard.visibility.couriers ? (
          <CourierActivityCard couriers={branchDashboard.couriers} />
        ) : null}
      </div>
    </PageContainer>
  );
};

export default memo(BranchDashboardPage);
