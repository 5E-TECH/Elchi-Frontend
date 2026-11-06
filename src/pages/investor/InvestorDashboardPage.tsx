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
  useInvestorDashboardOf,
  useInvestorInvestments,
  useInvestorProfits,
  type InvestorDashboard,
  type InvestorMonthsWindow,
  type InvestorSummary,
} from "../../entities/investors";
import { formatDateLocalized } from "../../shared/lib/formatDateTime";
import { getErrorStatus } from "../../shared/lib/errorKind";
import { formatNumberLocalized } from "../../shared/lib/formatMoney";
import type { ChartView } from "../../shared/ui/charts";
import { Badge, Card, ErrorState, PageHeader, StatCard } from "../../shared/ui/primitives";
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
 *  - Davr almashganda xato (12 oy yuklangan, «24 oy» — 500): KPI oxirgi muvaffaqiyatli javobdan qoladi (davrga
 *    bog'liq emas), «Oylik foyda» kartasi boshqaruvlari bilan joyida, xato faqat grafik o'rnida — boshqa davrga qaytish
 *    mumkin (butun karta xatosi faqat birinchi yuklanishda, maket `investor-dashboard-error`).
 * Xom backend matni ko'rsatilmaydi; pul — `formatMoney`, sana — `formatDateLocalized`.
 *
 * NAZORAT (`investorId`, vpKijXce): superadmin `/investor/:id` da shu kabinetni faqat o'qiydi — `GET
 * investors/:id/dashboard` (javob investorniki bilan bir xil). Ro'yxatlar (`investors/me/*`) faqat investorga ochiq,
 * so'ralmaydi; 403/404/409 holat ekrani (ichida «Chiqish») ko'rsatilmaydi — superadmin tizimdan chiqarilmasin.
 */
const InvestorDashboardPage = ({ now, investorId }: { now?: Date; investorId?: string }) => {
  const { t, i18n } = useTranslation(["investor", "ui"]);
  const language = i18n.language;
  const [months, setMonths] = useState<InvestorMonthsWindow>(12);
  const [view, setView] = useState<ChartView>("chart");
  const control = investorId !== undefined;

  const ownDashboard = useInvestorDashboard(months, { silentError: true, enabled: !control });
  const otherDashboard = useInvestorDashboardOf(investorId ?? "", months, { silentError: true, enabled: control });
  const dashboard = control ? otherDashboard : ownDashboard;
  const investments = useInvestorInvestments(RECENT_INVESTMENTS, { silentError: true, enabled: !control });
  const profits = useInvestorProfits(RECENT_PROFITS, { silentError: true, enabled: !control });
  const fallbackName = useSelector((state: RootState) => state.user.user?.name || state.role.name || "");
  // Oxirgi muvaffaqiyatli javob: `keepPreviousData` yangi davr xato bo'lganda eski ma'lumotni tashlaydi (TanStack v5).
  const [lastGood, setLastGood] = useState<InvestorDashboard | undefined>(undefined);
  if (dashboard.data && dashboard.data !== lastGood) setLastGood(dashboard.data);

  const problem = control ? null : investorAccessProblem(dashboard.error);
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

  const data = dashboard.data ?? lastGood;
  const name = data?.investor?.name || (control ? "" : fallbackName);
  const loading = dashboard.isPending && !data;
  // Hech qachon yuklanmagan bo'lsa — butun karta xatosi; aks holda xato faqat «Oylik foyda» grafigi o'rnida.
  const failed = dashboard.isError && !data;
  const windowFailed = dashboard.isError && !dashboard.data && data != null;
  const retryDashboard = () => void dashboard.refetch();

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      {control ? (
        <PageHeader
          back="/ops?tab=investors"
          backLabel={t("control.back")}
          title={name ? t("home.cabinetOf", { name }) : t("home.cabinet")}
          meta={<Badge>{t("control.badge")}</Badge>}
          description={t("control.description")}
        />
      ) : (
        <PageHeader
          title={t("home.title")}
          description={name ? t("home.cabinetOf", { name }) : t("home.cabinet")}
        />
      )}

      {failed ? (
        <Card title={t("monthly.errorCard")} padding="none">
          <ErrorState
            error={dashboard.error}
            title={control && getErrorStatus(dashboard.error) === 404 ? t("control.notFound") : t("monthly.errorTitle")}
            description={`${loadErrorText(t, dashboard.error)} ${control ? "" : t("monthly.errorBelow")}`.trim()}
            onRetry={retryDashboard}
            retrying={dashboard.isFetching}
          />
        </Card>
      ) : (
        <>
          <InvestorKpis
            summary={data?.summary}
            agreedShare={data?.investor?.sharePercent ?? null}
            loading={loading}
            language={language}
          />
          <MonthlyProfitCard
            months={months}
            onMonthsChange={setMonths}
            view={view}
            onViewChange={setView}
            items={windowFailed ? [] : data?.monthly.items}
            error={
              windowFailed
                ? { error: dashboard.error, onRetry: retryDashboard, retrying: dashboard.isFetching }
                : undefined
            }
            empty={
              !windowFailed &&
              data != null &&
              data.summary.profitSharesCount === 0 &&
              data.monthly.items.every((item) => item.total === 0)
            }
            refreshing={dashboard.isPlaceholderData}
            now={now}
          />
        </>
      )}

      {control ? (
        <p className="text-[13px] text-text-muted">{t("control.listsNote")}</p>
      ) : (
        <InvestorListCards investments={investments} profits={profits} />
      )}
    </div>
  );
};

/**
 * To'rt KPI (maket `.el-kpi-row`): pul ixcham («450» + «mln so'm»), foiz — «12,5» + «%». «Ulush» — investor
 * yaratilganda kelishilgan «Ulush (%)» (BeePost formasi), kiritilmagan bo'lsa oxirgi foyda davri stavkasi.
 */
const InvestorKpis = ({
  summary,
  agreedShare,
  loading,
  language,
}: {
  summary: InvestorSummary | undefined;
  agreedShare: number | null;
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
  const share = agreedShare ?? summary?.currentPercentage ?? null;
  const shareHint =
    agreedShare != null ? t("kpi.shareAgreed") : share == null ? t("kpi.shareNone") : t("kpi.shareHint");

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
        hint={loading ? undefined : shareHint}
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
