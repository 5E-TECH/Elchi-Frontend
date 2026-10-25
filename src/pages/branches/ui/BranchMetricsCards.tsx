// dizayn-v2: superadmin-branches-detail
import { ChevronRight, CircleCheck, CircleX, Inbox, Trophy, Truck } from "lucide-react";
import { lazy, memo, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { RankingMeta, TopCourier } from "../../../entities/dashboard";
import { formatRangeShort } from "../../../shared/ui/primitives/date/calendarMath";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { ChartLegend, ChartNote, Donut, RankList, ViewToggle, type ChartView } from "../../../shared/ui/charts";
import {
  Badge,
  buttonClasses,
  Card,
  DataTable,
  EmptyState,
  SkeletonChart,
} from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import { courierRows, toRankItems } from "../../../widgets/dashboard-top-performers/lib/rankItems";
import { isLowDataRanking, rankingPeriodLabel } from "../../../widgets/dashboard-top-performers/model/ranking";
import type { TrendPoint } from "../../../widgets/financial-analysis/ui/FinancialTrendPlot";
import type { BranchCouriersActivity, DailyRevenuePoint, StatusGroups } from "../model/branchMetrics";

/**
 * «Filial ko'rsatkichlari» bo'limining kartalari (maket `superadmin-branches-detail`). Umumiy dashboard
 * widgetlari (`OrderStatusCard`, `TopRankCard`) bu yerda o'zgartirilmaydi: maketdagi yonma-yon donut
 * (`.el-donut.is-side`) va sarlavhadagi «x / y faol» belgisi ular API'sida yo'q — kartalar shu yerda
 * `Card` + `Donut` / `RankList` primitivlaridan yig'iladi. Trend plot — o'sha `FinancialTrendPlot` (lazy chunk).
 */

const FinancialTrendPlot = lazy(() => import("../../../widgets/financial-analysis/ui/FinancialTrendPlot"));

/** Maket: `--plot-h: 320px; --plot-h-phone: 170px`. */
const PLOT_HEIGHT = { desktop: 320, phone: 170 } as const;

// ─── Sparkline (`.el-spark`) ───────────────────────────────────────────────────

const SPARK_W = 100;
const SPARK_H = 40;
const SPARK_PAD = 4;
const fixed = (value: number) => value.toFixed(1);

/**
 * KPI sparkline (`.el-kpi .el-spark`, 40 px · telefonda 32): oxirgi 14 kun — tarix `chart-muted`, oxirgi kun
 * kesmasi va nuqtasi `chart-1`. Bezak — ma'nosi `aria-label` da (min – max, oxirgi kun).
 */
export const MetricSparkline = ({ values, label }: { values: readonly number[]; label: string }) => {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const points = values.map((value, index) => ({
    x: (index / (values.length - 1)) * SPARK_W,
    y: span > 0 ? SPARK_PAD + (1 - (value - min) / span) * (SPARK_H - 2 * SPARK_PAD) : SPARK_H / 2,
  }));
  // Silliq chiziq: har kesmada gorizontal urinmali kubik Bezye (o'ta oshib ketmaydi).
  const history = points.slice(0, -1).reduce((path, point, index, all) => {
    if (index === 0) return `M ${fixed(point.x)} ${fixed(point.y)}`;
    const previous = all[index - 1];
    const dx = (point.x - previous.x) / 3;
    return `${path} C ${fixed(previous.x + dx)} ${fixed(previous.y)} ${fixed(point.x - dx)} ${fixed(point.y)} ${fixed(point.x)} ${fixed(point.y)}`;
  }, "");
  const beforeLast = points[points.length - 2];
  const last = points[points.length - 1];
  return (
    <span role="img" aria-label={label} data-sparkline="" className="relative block h-10 min-w-0 max-md:h-8">
      <svg
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-0 size-full overflow-visible"
      >
        {points.length > 2 ? (
          <path
            d={history}
            fill="none"
            stroke="var(--color-chart-muted)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        <path
          d={`M ${fixed(beforeLast.x)} ${fixed(beforeLast.y)} L ${fixed(last.x)} ${fixed(last.y)}`}
          fill="none"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-1 ring-2 ring-surface"
        style={{ left: "100%", top: `${(last.y / SPARK_H) * 100}%` }}
      />
    </span>
  );
};

// ─── Yuklanish kartasi ─────────────────────────────────────────────────────────

/** Grafik kartasi skeleti (sarlavha joyida) — `LoadingChartCard` ning `className` qabul qiladigan egizagi. */
export const MetricsLoadingCard = ({ title, className }: { title: string; className?: string }) => (
  <Card divided={false} title={title} className={className} aria-busy="true">
    <SkeletonChart />
  </Card>
);

// ─── «Kunlik daromad» ──────────────────────────────────────────────────────────

export interface BranchRevenueCardProps {
  points: readonly DailyRevenuePoint[];
  /** «Bu hafta». */
  periodText: string;
  className?: string;
}

/**
 * «KUNLIK DAROMAD»: tanlangan davrning kunlik daromadi (`dailyRevenue`, sotilgan buyurtmalar `sold_at` bo'yicha —
 * KPI «Daromad» yig'indisi bilan bir xil). «Grafik | Jadval» egizagi. Oldingi davr chizig'i va «Kunlik · Haftalik ·
 * Oylik» chizilmaydi — filial kesimida backend faqat joriy davrning kunlik bandlarini beradi.
 */
export const BranchRevenueCard = memo(({ points, periodText, className }: BranchRevenueCardProps) => {
  const { t, i18n } = useTranslation("branches");
  const { t: tDash } = useTranslation("dashboard");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isPhone = useIsPhone();
  const [view, setView] = useState<ChartView>("chart");

  const first = points[0]?.period;
  const last = points[points.length - 1]?.period;
  const rangeText = first && last ? (formatRangeShort({ from: first, to: last }) ?? "") : "";
  const hasRevenue = points.some((point) => point.revenue !== 0);
  const plotPoints: TrendPoint[] = points.map((point) => ({
    label: point.label,
    current: point.revenue,
    previous: null,
    orders: point.ordersCount,
  }));

  return (
    <Card
      divided={false}
      className={className}
      title={t("v2.metrics.revenue.title")}
      description={[periodText, rangeText].filter(Boolean).join(" · ")}
      actions={hasRevenue ? <ViewToggle value={view} onChange={setView} ariaLabel={t("v2.metrics.revenue.viewLabel")} /> : undefined}
      bodyClassName="flex flex-1 flex-col gap-4"
      data-testid="branch-metrics-revenue"
    >
      {!hasRevenue ? (
        <EmptyState size="chart" title={tDash("v2Dashboard.finance.empty")} />
      ) : view === "chart" ? (
        <figure className="m-0 min-w-0" aria-label={tDash("v2Dashboard.finance.chartAria", { range: rangeText })}>
          <Suspense fallback={<SkeletonChart className="h-[320px] max-md:h-[170px]" />}>
            <FinancialTrendPlot
              points={plotPoints}
              showPrevious={false}
              height={isPhone ? PLOT_HEIGHT.phone : PLOT_HEIGHT.desktop}
              currentName={tDash("v2Dashboard.finance.current")}
              previousName={tDash("v2Dashboard.finance.previous")}
            />
          </Suspense>
        </figure>
      ) : (
        <DataTable
          rows={plotPoints}
          getRowKey={(row, index) => `${row.label}-${index}`}
          label={t("v2.metrics.revenue.title")}
          density="compact"
          renderCard={(row) => (
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-text">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-semibold">{row.label}</span>
                <span className="text-[13px] text-text-muted">
                  {row.orders == null ? "—" : tDash("v2Charts.countTa", { value: formatNumberLocalized(row.orders, { language }) })}
                </span>
              </span>
              <span className="whitespace-nowrap font-semibold tabular-nums">{formatMoneyLocalized(row.current, { language })}</span>
            </div>
          )}
          columns={[
            { id: "label", header: tDash("v2Dashboard.finance.tableDate"), cell: (row) => row.label },
            {
              id: "current",
              header: t("v2.metrics.revenue.amount"),
              align: "end",
              cell: (row) => formatMoneyLocalized(row.current, { language }),
            },
            {
              id: "orders",
              header: tDash("v2Dashboard.finance.orders"),
              align: "end",
              cell: (row) =>
                row.orders == null ? "—" : tDash("v2Charts.countTa", { value: formatNumberLocalized(row.orders, { language }) }),
            },
          ]}
        />
      )}
      {hasRevenue ? (
        <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4">
          <ChartLegend
            items={[
              {
                key: "current",
                tone: "action",
                line: true,
                keyClassName: "bg-chart-1",
                label: tDash("v2Dashboard.finance.currentRange", { range: rangeText }),
              },
            ]}
          />
        </div>
      ) : null}
    </Card>
  );
});
BranchRevenueCard.displayName = "BranchRevenueCard";

// ─── «Buyurtmalar holati» ──────────────────────────────────────────────────────

export interface BranchStatusCardProps {
  status: StatusGroups;
  periodText: string;
  /** «Ro'yxat ›» — filial va davr filtri bilan buyurtmalar ro'yxati. */
  listHref: string;
  className?: string;
}

/** «BUYURTMALAR HOLATI»: yonma-yon donut (`.el-donut.is-side`, telefonda ustma-ust) + legenda-jadval. */
export const BranchStatusCard = memo(({ status, periodText, listHref, className }: BranchStatusCardProps) => {
  const { t, i18n } = useTranslation("branches");
  const { t: tDash } = useTranslation("dashboard");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const segments = [
    { key: "sold", label: t("v2.metrics.status.sold"), value: status.sold, tone: "success" as const, icon: CircleCheck },
    { key: "road", label: t("v2.metrics.status.road"), value: status.road, tone: "warning" as const, icon: Truck },
    { key: "new", label: t("v2.metrics.status.new"), value: status.fresh, tone: "info" as const, icon: Inbox },
    { key: "cancelled", label: t("v2.metrics.status.cancelled"), value: status.cancelled, tone: "danger" as const, icon: CircleX },
  ];
  const centerLabel = tDash("v2Dashboard.status.centerAccepted");
  const list = segments
    .map((segment) => `${segment.label.toLocaleLowerCase()} ${formatNumberLocalized(segment.value, { language })}`)
    .join(", ");

  return (
    <Card
      divided={false}
      className={className}
      title={tDash("v2Dashboard.status.title")}
      description={tDash("v2Dashboard.status.subAccepted", { period: periodText })}
      actions={
        <Link to={listHref} className={buttonClasses({ variant: "link", size: "sm" })}>
          {tDash("v2Dashboard.status.list")}
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      }
      bodyClassName="flex flex-1 flex-col gap-4"
      data-testid="branch-metrics-status"
    >
      {status.total > 0 ? (
        <Donut
          layout="side"
          segments={segments}
          total={status.total}
          centerLabel={centerLabel}
          ariaLabel={tDash("v2Dashboard.status.aria", {
            label: centerLabel,
            total: formatNumberLocalized(status.total, { language }),
            list,
          })}
          legendLabel={tDash("v2Dashboard.status.legend")}
        />
      ) : (
        <EmptyState size="chart" title={t("v2.metrics.status.empty")} />
      )}
    </Card>
  );
});
BranchStatusCard.displayName = "BranchStatusCard";

// ─── «Kuryerlar reytingi» ──────────────────────────────────────────────────────

export interface BranchCouriersCardProps {
  couriers: readonly TopCourier[];
  meta: RankingMeta | null;
  /** «x / y faol» (bugun faol / filial kuryerlari); `null` — belgi yo'q. */
  activity: BranchCouriersActivity | null;
  /** Izohdagi davr: «bu hafta». */
  periodText: string;
  /** Kuryerga biriktirilmagan (yangi) buyurtmalar — reytingga kirmaydi; reyting oynasi davr bilan bir xil bo'lsa. */
  unassigned: number | null;
  className?: string;
}

/**
 * «KURYERLAR REYTINGI»: shu filial kuryerlari, sotuv foizi (sotilgan / biriktirilgan), top 5 (telefonda 3) va
 * «Yana ko'rsatish». Qisqa davrda backend reytingni oxirgi 30 kun bo'yicha beradi — izohda shu yoziladi.
 */
export const BranchCouriersCard = memo(
  ({ couriers, meta, activity, periodText, unassigned, className }: BranchCouriersCardProps) => {
    const { t, i18n } = useTranslation("branches");
    const { t: tDash } = useTranslation("dashboard");
    const language = i18n.resolvedLanguage ?? i18n.language;
    const rows = courierRows(couriers);
    const items = toRankItems(rows, { t: tDash, language });
    const title = t("v2.metrics.couriers.title");
    const count = (value: number) => formatNumberLocalized(value, { language });

    const rankWindow = rankingPeriodLabel(meta, (days) => tDash("v2Dashboard.top.periodLastDays", { count: days }));
    const sameWindow = meta?.periodRule !== "last_30_days";
    const noteParts = [
      t("v2.metrics.couriers.scope"),
      sameWindow ? periodText.toLocaleLowerCase() : rankWindow,
      sameWindow && unassigned != null && unassigned > 0 ? t("v2.metrics.couriers.unassigned", { value: count(unassigned) }) : null,
    ].filter(Boolean);

    return (
      <Card
        divided={false}
        className={className}
        title={title}
        description={t("v2.metrics.couriers.sub")}
        actions={
          activity ? (
            <Badge tone={activity.active > 0 ? "success" : "neutral"} dot>
              {t("v2.metrics.couriers.active", { active: count(activity.active), total: count(activity.total) })}
            </Badge>
          ) : undefined
        }
        bodyClassName="flex flex-1 flex-col gap-4"
        data-testid="branch-metrics-couriers"
      >
        {items.length === 0 ? (
          <EmptyState size="inline" icon={Trophy} title={tDash("v2Dashboard.top.emptyPeriod")} />
        ) : (
          <RankList items={items} ariaLabel={title} limit={5} mobileLimit={3} expandable />
        )}
        <div className="mt-auto flex flex-col gap-3">
          <ChartNote>{noteParts.join(" · ")}</ChartNote>
          {items.length > 0 && isLowDataRanking(rows, meta) ? <ChartNote>{tDash("v2Dashboard.top.limited")}</ChartNote> : null}
        </div>
      </Card>
    );
  },
);
BranchCouriersCard.displayName = "BranchCouriersCard";
