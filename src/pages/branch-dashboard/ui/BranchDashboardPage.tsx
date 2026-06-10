import { memo, useMemo } from "react";
import { Building2, CalendarRange, PackageCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
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
import QueryErrorState from "../../../shared/ui/QueryErrorState";
import type { RootState } from "../../../app/config/store";

const statCardClassName =
  "rounded-2xl border border-[color:var(--color-border-soft)] bg-white/70 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/[0.05]";

const BranchDashboardPage = () => {
  const { t } = useTranslation("branchDashboard");
  const userRole = useSelector((state: RootState) => state.role.role);
  const userId = useSelector((state: RootState) => state.user.user?.id);
  const analyticsScope = `${userRole || "unknown"}:${userId || "unknown"}`;
  const { getDashboard } = useDashboard();
  const { data, isLoading, isError, refetch } = getDashboard(
    undefined,
    true,
    analyticsScope,
  );

  const branchDashboard = useMemo(
    () => adaptBranchDashboard(data?.data?.branchDashboard, userRole || "OPERATOR"),
    [data?.data?.branchDashboard, userRole],
  );

  const isManager = branchDashboard.role === "MANAGER";

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
                  <span>{t("todayOrdersCount")}</span>
                </div>
                <p className="mt-1.5 text-[1.7rem] font-black leading-none text-maindark dark:text-white">
                  {branchDashboard.todayOrdersCount}
                </p>
              </div>

              <div className={statCardClassName}>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                  <PackageCheck size={14} />
                  <span>{t("weekOrdersCount")}</span>
                </div>
                <p className="mt-1.5 text-[1.7rem] font-black leading-none text-maindark dark:text-white">
                  {branchDashboard.weekOrdersCount}
                </p>
              </div>

              <div className={statCardClassName}>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                  <PackageCheck size={14} />
                  <span>{t("activeBatchesCount")}</span>
                </div>
                <p className="mt-1.5 text-[1.7rem] font-black leading-none text-maindark dark:text-white">
                  {branchDashboard.activeBatchesCount}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2.5 xl:items-end">
            <span className="inline-flex w-max rounded-xl border border-main/20 bg-main/10 px-3.5 py-2 text-sm font-extrabold text-main dark:text-white">
              {isManager ? t("managerMode") : t("operatorMode")}
            </span>
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
