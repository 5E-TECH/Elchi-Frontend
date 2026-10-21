// dizayn-v2: investor-dashboard-home, investor-dashboard-home-table, investor-dashboard-loading, investor-dashboard-empty, investor-dashboard-error, investor-dashboard-forbidden, investor-dashboard-not-linked
import { CircleCheck, Hourglass, Percent, PiggyBank } from "lucide-react";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/config/store";
import { splitCompactMoney } from "../../entities/dashboard/lib/period";
import {
  investorAccessProblem,
  useInvestorDashboard,
  useInvestorInvestments,
  useInvestorProfits,
  type InvestorMonthsWindow,
  type InvestorSummary,
} from "../../entities/investors";
import { formatDateLocalized } from "../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../shared/lib/formatMoney";
import type { ChartView } from "../../shared/ui/charts";
import { Card, ErrorState, PageHeader, StatCard } from "../../shared/ui/primitives";
import { KpiRow } from "../../widgets/dashboard-statistics/ui/DashboardGrid";
import { loadErrorText } from "./lib/format";
import { InvestorAccessState } from "./ui/InvestorAccessState";
import { InvestorListCards } from "./ui/InvestorListCards";
import { MonthlyProfitCard } from "./ui/MonthlyProfitCard";

/** Bosh sahifadagi qisqa ro'yxatlar (route-map: investments `limit=3`, profits `limit=5`). */
const RECENT_INVESTMENTS = { limit: 3 } as const;
const RECENT_PROFITS = { limit: 5 } as const;

/**
 * INVESTOR KABINETI — `/` (IN-1, vpKijXce; maketlar `investor-dashboard-*`).
 *
 *  - Sarlavha «Bosh sahifa» · «Investor kabineti · <ism>» (ism `investors/me/dashboard` → `investor.name`).
 *  - KPI: «Mening investitsiyam» (soni, oxirgi sana), «Ulush» (oxirgi davr stavkasi — ega IN-S4), «To'langan foyda»
 *    (oxirgi to'lov), «Kutilayotgan foyda».
 *  - «Oylik foyda»: 6 · 12 · 24 oy, «Grafik | Jadval» (`MonthlyProfitCard`, `StackedBars`).
 *  - «So'nggi investitsiyalar» va «Foyda tarixi» — mustaqil so'rovlar.
 *  - Holatlar: yuklanish — skelet; bo'sh — KPI 0 + bo'sh grafik; xato — KPI/grafik o'rnida `ErrorState`, ro'yxatlar
 *    ishlayveradi; 403 / 404 / 409 — butun sahifa holati («Qayta urinish» + «Chiqish»).
 * Xom backend matni ko'rsatilmaydi; pul — `formatMoney`, sana — `formatDateLocalized`.
 */
const InvestorDashboardPage = ({ now }: { now?: Date }) => {
  const { t, i18n } = useTranslation(["investor", "ui"]);
  const language = i18n.language;
  const [months, setMonths] = useState<InvestorMonthsWindow>(12);
  const [view, setView] = useState<ChartView>("chart");

  const dashboard = useInvestorDashboard(months, { silentError: true });
  const investments = useInvestorInvestments(RECENT_INVESTMENTS, { silentError: true });
  const profits = useInvestorProfits(RECENT_PROFITS, { silentError: true });
  const fallbackName = useSelector((state: RootState) => state.user.user?.name || state.role.name || "");

  const problem = investorAccessProblem(dashboard.error);
  const retryAll = () => {
    void dashboard.refetch();
    void investments.refetch();
    void profits.refetch();
  };

  if (problem) {
    return (
      <div className="flex flex-col gap-6 max-md:gap-4">
        <PageHeader title={t("home.title")} description={t("home.cabinet")} />
        <InvestorAccessState problem={problem} onRetry={retryAll} retrying={dashboard.isFetching} />
      </div>
    );
  }

  const data = dashboard.data;
  const name = data?.investor?.name || fallbackName;
  const loading = dashboard.isPending;
  const failed = dashboard.isError && !data;

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t("home.title")}
        description={name ? t("home.cabinetOf", { name }) : t("home.cabinet")}
      />

      {failed ? (
        <Card title={t("monthly.errorCard")} padding="none">
          <ErrorState
            error={dashboard.error}
            title={t("monthly.errorTitle")}
            description={`${loadErrorText(t, dashboard.error)} ${t("monthly.errorBelow")}`}
            onRetry={() => void dashboard.refetch()}
            retrying={dashboard.isFetching}
          />
        </Card>
      ) : (
        <>
          <InvestorKpis summary={data?.summary} loading={loading} language={language} />
          <MonthlyProfitCard
            months={months}
            onMonthsChange={setMonths}
            view={view}
            onViewChange={setView}
            items={data?.monthly.items}
            empty={
              data != null &&
              data.summary.profitSharesCount === 0 &&
              data.monthly.items.every((item) => item.total === 0)
            }
            refreshing={dashboard.isPlaceholderData}
            now={now}
          />
        </>
      )}

      <InvestorListCards investments={investments} profits={profits} />
    </div>
  );
};

/** To'rt KPI (maket `.el-kpi-row`): pul ixcham («450» + «mln so'm»), foiz — «12,5» + «%». */
const InvestorKpis = ({
  summary,
  loading,
  language,
}: {
  summary: InvestorSummary | undefined;
  loading: boolean;
  language: string;
}) => {
  const { t } = useTranslation("investor");
  const money = (value: number) => splitCompactMoney(value, language);
  const date = (value: string | null) => formatDateLocalized(value);

  const invested = money(summary?.totalInvested ?? 0);
  const paid = money(summary?.totalPaidProfit ?? 0);
  const unpaid = money(summary?.totalUnpaidProfit ?? 0);
  const count = summary?.investmentsCount ?? 0;
  const share = summary?.currentPercentage ?? null;

  const investedHint =
    count === 0
      ? t("kpi.investedNone")
      : summary?.lastInvestedAt
        ? t("kpi.investedHint", { n: formatNumberLocalized(count, { language }), date: date(summary.lastInvestedAt) })
        : t("kpi.investedCount", { n: formatNumberLocalized(count, { language }) });
  const paidHint = summary?.lastPaidAt
    ? t("kpi.paidHint", { date: date(summary.lastPaidAt) })
    : (summary?.totalPaidProfit ?? 0) > 0
      ? undefined
      : t("kpi.paidNone");
  const unpaidHint = (summary?.totalUnpaidProfit ?? 0) > 0 ? t("kpi.unpaidHint") : t("kpi.unpaidNone");

  return (
    <KpiRow count={4} label={t("kpi.label")}>
      <StatCard
        label={t("kpi.invested")}
        icon={PiggyBank}
        loading={loading}
        value={invested.value}
        unit={invested.unit}
        hint={loading ? undefined : investedHint}
      />
      <StatCard
        label={t("kpi.share")}
        icon={Percent}
        loading={loading}
        value={share == null ? "—" : formatNumberLocalized(share, { language, fractionDigits: 2 })}
        unit={share == null ? undefined : "%"}
        hint={loading ? undefined : share == null ? t("kpi.shareNone") : t("kpi.shareHint")}
      />
      <StatCard
        label={t("kpi.paid")}
        icon={CircleCheck}
        loading={loading}
        value={paid.value}
        unit={paid.unit}
        hint={loading ? undefined : paidHint}
      />
      <StatCard
        label={t("kpi.unpaid")}
        icon={Hourglass}
        loading={loading}
        value={unpaid.value}
        unit={unpaid.unit}
        hint={loading ? undefined : unpaidHint}
      />
    </KpiRow>
  );
};

export default memo(InvestorDashboardPage);
