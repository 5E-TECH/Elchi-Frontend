// dizayn-v2: superadmin-branches-detail
import { Banknote, CircleCheck, PackageCheck, Wallet, type LucideIcon } from "lucide-react";
import { useCallback, useId, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import type { RootState } from "../../../app/config/store";
import { useDashboard } from "../../../entities/dashboard";
import {
  comparisonHint,
  percentChange,
  periodLabel,
  previousLabel,
  share,
  splitCompactMoney,
} from "../../../entities/dashboard/lib/period";
import { formatCompactMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Sparkline } from "../../../shared/ui/charts";
import { formatRangeShort } from "../../../shared/ui/primitives/date/calendarMath";
import { Card, EmptyState, ErrorState, SegmentedControl, StatCard } from "../../../shared/ui/primitives";
import { DashboardPartError } from "../../../widgets/dashboard-part-error/ui/DashboardPartError";
import { KpiRow } from "../../../widgets/dashboard-statistics/ui/DashboardGrid";
import SuccessRateCard from "../../../widgets/dashboard-statistics/ui/SuccessRateCard";
import {
  BRANCH_METRICS_PERIODS,
  BRANCH_METRICS_PERIOD_PARAM,
  DEFAULT_BRANCH_METRICS_PERIOD,
  branchMetricsParams,
  branchMetricsRange,
  isEmptyPeriod,
  parseBranchMetricsPeriod,
  readBranchMetrics,
  toDashboardPeriod,
  type BranchMetrics,
  type BranchMetricsPeriod,
  type MetricsTotals,
} from "../model/branchMetrics";
import {
  BranchCouriersCard,
  BranchRevenueCard,
  BranchStatusCard,
  MetricsLoadingCard,
} from "./BranchMetricsCards";

/** Maketdagi qatorlar (`flex: 1 1 340px` · `2 1 560px`, `3 1 520px` · `2 1 340px`): joy yetmasa ustma-ust. */
const ROW = "flex flex-wrap gap-4";
const SUCCESS_CELL = "min-w-0 flex-[1_1_340px]";
const REVENUE_CELL = "min-w-0 flex-[2_1_560px]";
const STATUS_CELL = "min-w-0 flex-[3_1_520px]";
const COURIERS_CELL = "min-w-0 flex-[2_1_340px]";

type KpiKey = keyof Pick<MetricsTotals, "acceptedCount" | "soldAndPaid" | "totalRevenue" | "profit">;

const KPIS: ReadonlyArray<{ key: KpiKey; labelKey: string; icon: LucideIcon; money: boolean }> = [
  { key: "acceptedCount", labelKey: "v2.metrics.kpi.accepted", icon: PackageCheck, money: false },
  { key: "soldAndPaid", labelKey: "v2.metrics.kpi.sold", icon: CircleCheck, money: false },
  { key: "totalRevenue", labelKey: "v2.metrics.kpi.revenue", icon: Banknote, money: true },
  { key: "profit", labelKey: "v2.metrics.kpi.profit", icon: Wallet, money: true },
];

export interface BranchMetricsSectionProps {
  branchId: string;
  branchName: string;
}

/**
 * «FILIAL KO'RSATKICHLARI» — `/branches/:id` (superadmin; 6CYRjoZG, maket `superadmin-branches-detail`).
 *
 * Sarlavha + davr («Bugun · Bu hafta · Bu oy · Barchasi», sukut — «Bu hafta», `?period=`), 4 KPI (Qabul qilingan,
 * Sotilgan, Daromad, Sof foyda — oldingi teng davrga nisbatan delta, 14 kunlik sparkline), «Muvaffaqiyat
 * darajasi», «Kunlik daromad», «Buyurtmalar holati», «Kuryerlar reytingi». Hammasi bitta
 * `GET /analytics/dashboard?branch_id=` so'rovidan (`model/branchMetrics.ts`).
 *
 * Holatlar: yuklanish — skelet (KPI va kartalar joyida); so'rov xatosi yoki backend filialni qo'llamagani —
 * `ErrorState` + «Qayta urinish» (kompaniya raqamlari filialniki bo'lib ko'rinmaydi); davrda buyurtma yo'q —
 * `EmptyState`; olinmagan bo'lak (`failed_parts`) — o'sha karta joyida `DashboardPartError`, nollar emas;
 * oldingi davr / seriya yo'q («Barchasi», `trend` olinmadi) — delta va sparkline chizilmaydi; filial paneli
 * olinmasa yoki `stats_unavailable` — «x / y faol» belgisi yo'q.
 */
const BranchMetricsSection = ({ branchId, branchName }: BranchMetricsSectionProps) => {
  const { t, i18n } = useTranslation("branches");
  const { t: tDash } = useTranslation("dashboard");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const headingId = useId();
  const role = useSelector((state: RootState) => state.role.role);
  const userId = useSelector((state: RootState) => state.user.user?.id);

  const [searchParams, setSearchParams] = useSearchParams();
  const period = parseBranchMetricsPeriod(searchParams.get(BRANCH_METRICS_PERIOD_PARAM));
  const setPeriod = useCallback(
    (next: BranchMetricsPeriod) =>
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (next === DEFAULT_BRANCH_METRICS_PERIOD) params.delete(BRANCH_METRICS_PERIOD_PARAM);
          else params.set(BRANCH_METRICS_PERIOD_PARAM, next);
          return params;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  const params = useMemo(() => branchMetricsParams(branchId, period), [branchId, period]);
  const { getDashboard } = useDashboard();
  const query = getDashboard(params, Boolean(branchId), `${role || "unknown"}:${userId || "unknown"}`);
  const metrics = useMemo(() => readBranchMetrics(query.data, branchId), [query.data, branchId]);

  const dashboardPeriod = toDashboardPeriod(period);
  const periodText = periodLabel(tDash, dashboardPeriod);
  const range = branchMetricsRange(period);
  const effective = metrics?.appliedRange?.clamped && metrics.appliedRange.from ? metrics.appliedRange : null;
  const rangeText =
    period === "all"
      ? effective?.from
        ? formatRangeShort({ from: effective.from, to: effective.to ?? range.to })
        : null
      : formatRangeShort(range);
  const subtitle = [periodText, rangeText, t("v2.metrics.scope", { branch: branchName })].filter(Boolean).join(" · ");

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id={headingId} className="m-0 text-base font-bold text-text">
          {t("v2.metrics.title")}
        </h2>
        <p className="m-0 text-[13px] text-text-muted">{subtitle}</p>
      </div>
      <SegmentedControl<BranchMetricsPeriod>
        ariaLabel={t("v2.metrics.periodLabel")}
        value={period}
        onValueChange={setPeriod}
        options={BRANCH_METRICS_PERIODS.map((value) => ({ value, label: tDash(`quickRanges.${value}`) }))}
      />
    </div>
  );

  const retry = () => void query.refetch();

  let body: ReactNode;
  if (query.isLoading) {
    body = (
      <>
        <KpiRow count={4} label={tDash("v2Dashboard.kpi.label")}>
          {KPIS.map((kpi) => (
            <StatCard key={kpi.key} label={t(kpi.labelKey)} icon={kpi.icon} loading />
          ))}
        </KpiRow>
        <div className={ROW}>
          <MetricsLoadingCard className={SUCCESS_CELL} title={tDash("v2Dashboard.success.title")} />
          <MetricsLoadingCard className={REVENUE_CELL} title={t("v2.metrics.revenue.title")} />
        </div>
        <div className={ROW}>
          <MetricsLoadingCard className={STATUS_CELL} title={tDash("v2Dashboard.status.title")} />
          <MetricsLoadingCard className={COURIERS_CELL} title={t("v2.metrics.couriers.title")} />
        </div>
      </>
    );
  } else if (query.isError || !metrics) {
    body = (
      <Card>
        <ErrorState
          description={t(query.isError ? "v2.metrics.loadError" : "v2.metrics.unavailable")}
          onRetry={retry}
          retrying={query.isFetching}
        />
      </Card>
    );
  } else if (isEmptyPeriod(metrics)) {
    body = (
      <Card padding="none">
        <EmptyState title={t("v2.metrics.empty")} description={t("v2.metrics.emptyHint")} />
      </Card>
    );
  } else {
    body = (
      <MetricsBody
        metrics={metrics}
        period={period}
        periodText={periodText}
        language={language}
        branchId={branchId}
        onRetry={retry}
        retrying={query.isFetching}
      />
    );
  }

  return (
    <section aria-labelledby={headingId} data-testid="branch-metrics" className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      {header}
      {body}
    </section>
  );
};

interface MetricsBodyProps {
  metrics: BranchMetrics;
  period: BranchMetricsPeriod;
  periodText: string;
  language: string;
  branchId: string;
  onRetry: () => void;
  retrying: boolean;
}

const MetricsBody = ({ metrics, period, periodText, language, branchId, onRetry, retrying }: MetricsBodyProps) => {
  const { t } = useTranslation("branches");
  const { t: tDash } = useTranslation("dashboard");
  const dashboardPeriod = toDashboardPeriod(period);
  const { current, previous, series } = metrics;
  const hint = comparisonHint(tDash, dashboardPeriod);
  const count = (value: number) => formatNumberLocalized(value, { language });
  const countTa = (value: number) => tDash("v2Charts.countTa", { value: count(value) });
  const money = (value: number) => formatCompactMoneyLocalized(value, { language });

  const kpiValue = (key: KpiKey, isMoney: boolean) => {
    if (!isMoney) return { value: count(current[key]), unit: tDash("unit.orders") };
    return splitCompactMoney(current[key], language);
  };

  const sparkLabel = (label: string, values: readonly number[], isMoney: boolean) => {
    const format = isMoney ? money : countTa;
    return t("v2.metrics.sparkAria", {
      label,
      days: values.length,
      min: format(Math.min(...values)),
      max: format(Math.max(...values)),
      last: format(values[values.length - 1]),
    });
  };

  const accepted = current.acceptedCount;
  const sold = current.soldAndPaid;
  const previousRate = previous && previous.acceptedCount > 0 ? share(previous.soldAndPaid, previous.acceptedCount) : null;
  const range = branchMetricsRange(period);
  const listParams = new URLSearchParams({ orderBranchId: branchId });
  if (period !== "all") {
    listParams.set("startDay", range.from);
    listParams.set("endDay", range.to);
  }
  // Reyting oynasi davr bilan bir xil bo'lsa — izohda «n ta yangi (biriktirilmagan) kirmaydi».
  const unassigned = metrics.status ? metrics.status.fresh : null;

  return (
    <>
      <KpiRow count={4} label={tDash("v2Dashboard.kpi.label")}>
        {KPIS.map((kpi) => {
          const label = t(kpi.labelKey);
          const { value, unit } = kpiValue(kpi.key, kpi.money);
          const delta = previous ? percentChange(current[kpi.key], previous[kpi.key]) : null;
          const values = series?.map((point) => point[kpi.key]) ?? null;
          return (
            <StatCard
              key={kpi.key}
              data-kpi={kpi.key}
              label={label}
              icon={kpi.icon}
              value={value}
              unit={unit}
              delta={delta}
              hint={delta != null ? hint : undefined}
              valueTone={kpi.key === "profit" && current.profit < 0 ? "danger" : undefined}
            >
              {values ? <Sparkline values={values} label={sparkLabel(label, values, kpi.money)} /> : undefined}
            </StatCard>
          );
        })}
      </KpiRow>

      <div className={ROW}>
        <SuccessRateCard
          className={SUCCESS_CELL}
          rate={share(sold, accepted)}
          sold={sold}
          cancelled={current.cancelled}
          description={periodText}
          gaugeLabel={tDash("v2Dashboard.success.gaugeAccepted")}
          previous={previousRate != null ? { rate: previousRate, label: previousLabel(tDash, dashboardPeriod) } : null}
          showThreshold={false}
        />
        {metrics.dailyRevenue ? (
          <BranchRevenueCard className={REVENUE_CELL} points={metrics.dailyRevenue} periodText={periodText} />
        ) : (
          <DashboardPartError
            className={REVENUE_CELL}
            data-testid="branch-metrics-revenue"
            title={t("v2.metrics.revenue.title")}
            onRetry={onRetry}
            retrying={retrying}
          />
        )}
      </div>

      <div className={ROW}>
        {metrics.status ? (
          <BranchStatusCard
            className={STATUS_CELL}
            status={metrics.status}
            periodText={periodText}
            listHref={`/orders?${listParams.toString()}`}
          />
        ) : (
          <DashboardPartError
            className={STATUS_CELL}
            data-testid="branch-metrics-status"
            title={tDash("v2Dashboard.status.title")}
            onRetry={onRetry}
            retrying={retrying}
          />
        )}
        {metrics.topCouriers ? (
          <BranchCouriersCard
            className={COURIERS_CELL}
            couriers={metrics.topCouriers}
            meta={metrics.topCouriersMeta}
            activity={metrics.couriers}
            periodText={periodText}
            unassigned={unassigned}
          />
        ) : (
          <DashboardPartError
            className={COURIERS_CELL}
            data-testid="branch-metrics-couriers"
            title={t("v2.metrics.couriers.title")}
            onRetry={onRetry}
            retrying={retrying}
          />
        )}
      </div>
    </>
  );
};

export default BranchMetricsSection;
