import { memo } from "react";
import { Building2, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import HeaderName from "../../../shared/components/headerName";
import {
  ActivePackagesCard,
  CourierActivityCard,
  MarketsPerformanceCard,
  OrdersOverviewCard,
} from "./BranchDashboardCards";
import { branchDashboardMock } from "./branchDashboardMock";

const BranchDashboardPage = () => {
  const { t } = useTranslation("branchDashboard");
  const role = useSelector((state: RootState) => state.role.role);
  const isManager = role === "manager";

  return (
    <div className="min-h-full rounded-2xl bg-sidebar p-4 md:p-6 dark:bg-maindark">
      <section className="relative overflow-hidden rounded-[34px] border border-[color:var(--color-border-soft)] bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--color-main)_22%,transparent)_0%,transparent_38%),linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_93%,white_7%)_0%,color-mix(in_srgb,var(--color-sidebar)_95%,white_5%)_100%)] p-5 shadow-[0_30px_70px_rgba(15,23,42,0.08)] dark:bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--color-main)_18%,transparent)_0%,transparent_38%),linear-gradient(135deg,color-mix(in_srgb,var(--color-primarydark)_93%,var(--color-maindark)_7%)_0%,color-mix(in_srgb,var(--color-maindark)_97%,var(--color-primarydark)_3%)_100%)]">
        <div className="pointer-events-none absolute -right-14 top-0 h-40 w-40 rounded-full bg-main/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <HeaderName
            name={`${t("title")} • ${branchDashboardMock.branchName}`}
            description={t("subtitle")}
            icon={<Building2 />}
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
            <div className="rounded-[24px] border border-[color:var(--color-border-soft)] bg-white/60 px-4 py-4 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.05]">
              <p className="m-0 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                {t("dashboardMode")}
              </p>
              <p className="m-0 mt-2 text-lg font-black text-maindark dark:text-white">
                {isManager ? t("managerMode") : t("operatorMode")}
              </p>
            </div>
            <div className="rounded-[24px] border border-[color:var(--color-border-soft)] bg-white/60 px-4 py-4 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.05]">
              <div className="flex items-center gap-2 text-main">
                <ShieldCheck size={16} />
                <p className="m-0 text-xs font-bold uppercase tracking-[0.2em]">
                  {t("previewMode")}
                </p>
              </div>
              <p className="m-0 mt-2 text-sm font-semibold leading-6 text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                {t("previewModeText")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <OrdersOverviewCard summary={branchDashboardMock.orderSummary} />
        {isManager ? <MarketsPerformanceCard markets={branchDashboardMock.markets} /> : null}
        <ActivePackagesCard packages={branchDashboardMock.packages} />
        {isManager ? <CourierActivityCard couriers={branchDashboardMock.couriers} /> : null}
      </div>
    </div>
  );
};

export default memo(BranchDashboardPage);
