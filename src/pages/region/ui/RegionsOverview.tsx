// dizayn-v2: superadmin-regions-map, admin-regions-map
import { Banknote, CircleX, Map as MapIcon, PackageCheck, ShoppingBag } from "lucide-react";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { shareOf, splitCompactMoney, useRegionStats } from "../../../entities/region";
import { formatMoneyLocalized, formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { EmptyState, ErrorState, SkeletonChart, StatCard } from "../../../shared/ui/primitives";
import { LegendKey, Meter, SegBar } from "../../../shared/ui/charts";
import { summarizeRegions, toRegionRows, type RegionRow } from "../model/regionsModel";
import { KpiMeter } from "./regionBlocks";
import RegionsMapCard from "./RegionsMapCard";
import RegionsSuccessCards from "./RegionsSuccessCards";

// Viloyat oynasi — faqat bosilganda yuklanadi (umumiy widget, dashboard ham shunday ochadi).
const RegionDetailDialog = lazy(() => import("../../../widgets/region-detail"));

export interface RegionsOverviewProps {
  dateParams: { startDate?: string; endDate?: string };
  /** «Bugun», «Bu hafta», «01.10 – 08.10». */
  periodLabel: string;
  /** Kichik harfli: «bugun». */
  periodLower: string;
}

/**
 * SUPERADMIN / ADMIN `/regions` tanasi (`GET region/stats/all`): KPI 4 → «Viloyatlar xaritasi» →
 * [«Muvaffaqiyat darajasi» · «Viloyatlar muvaffaqiyati»]. Viloyat bosilsa — `RegionDetailDialog` (lazy).
 * Maketdagi «Boshqa holatlar» bloki sahifaga chizilmaydi — holatlar shu yerda (skelet, xato, bo'sh).
 */
const RegionsOverview = ({ dateParams, periodLabel, periodLower }: RegionsOverviewProps) => {
  const { t, i18n } = useTranslation("region");
  const language = i18n.language;
  // en — birliksiz («312»), uz «ta», ru «шт.».
  const unitTa = t("v2.common.ta") || undefined;
  const query = useRegionStats(dateParams, true);
  const [selected, setSelected] = useState<RegionRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const rows = useMemo(() => toRegionRows(query.data?.regions ?? []), [query.data?.regions]);
  const summary = useMemo(() => summarizeRegions(rows, query.data?.summary), [rows, query.data?.summary]);

  const number = (value: number) => formatNumberLocalized(value, { language });
  const percent = (value: number) => formatPercentLocalized(value, { language });
  const loading = !query.data && !query.isError;
  const compact = splitCompactMoney(summary.revenue, language);
  const average = summary.sold > 0 ? summary.revenue / summary.sold : 0;

  const openRegion = useCallback((row: RegionRow) => {
    setSelected(row);
    setDialogOpen(true);
  }, []);

  if (query.isError && !query.data) {
    return (
      <ErrorState
        framed
        error={query.error}
        title={t("v2.states.error.title")}
        description={t("v2.states.error.text")}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }

  return (
    <>
      <div
        role="group"
        aria-label={t("v2.kpi.aria")}
        className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:gap-3"
      >
        <StatCard
          label={t("v2.kpi.total")}
          icon={ShoppingBag}
          loading={loading}
          value={number(summary.total)}
          unit={unitTa}
          hint={t("v2.kpi.totalHint", { pending: number(summary.pending), regions: number(summary.active.length) })}
        >
          <div className="mt-auto flex min-w-0 flex-col gap-2 pt-2">
            <SegBar
              showLegend={false}
              ariaLabel={t("v2.common.statusAria", {
                total: number(summary.total),
                sold: number(summary.sold),
                pending: number(summary.pending),
                cancelled: number(summary.cancelled),
              })}
              segments={[
                { key: "sold", label: t("v2.status.sold"), value: summary.sold, tone: "success" },
                { key: "pending", label: t("v2.status.pending"), value: summary.pending, tone: "warning" },
                { key: "cancelled", label: t("v2.status.cancelledShort"), value: summary.cancelled, tone: "danger" },
              ]}
            />
            {/* Ixcham legenda (`.el-kpi` ichida 12 px) — ChartLegend 13 px kartaga sig'maydi. */}
            <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-xs text-text-muted">
              {(
                [
                  { key: "sold", tone: "success", label: t("v2.status.sold") },
                  { key: "pending", tone: "warning", label: t("v2.status.pending") },
                  { key: "cancelled", tone: "danger", label: t("v2.status.cancelledShort") },
                ] as const
              ).map((item) => (
                <li key={item.key} className="inline-flex items-center gap-1.5">
                  <LegendKey tone={item.tone} />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        </StatCard>
        <StatCard
          label={t("v2.kpi.sold")}
          icon={PackageCheck}
          loading={loading}
          value={number(summary.sold)}
          unit={unitTa}
          hint={t("v2.kpi.soldHint")}
        >
          <KpiMeter label={t("v2.kpi.shareOfTotal")} value={percent(shareOf(summary.sold, summary.total))}>
            <Meter
              value={shareOf(summary.sold, summary.total)}
              tone="success"
              thickness="thin"
              ariaLabel={t("v2.kpi.soldShareAria")}
            />
          </KpiMeter>
        </StatCard>
        <StatCard
          label={t("v2.kpi.cancelled")}
          icon={CircleX}
          loading={loading}
          value={number(summary.cancelled)}
          unit={unitTa}
          hint={t("v2.kpi.cancelledHint")}
        >
          <KpiMeter label={t("v2.kpi.shareOfTotal")} value={percent(shareOf(summary.cancelled, summary.total))}>
            <Meter
              value={shareOf(summary.cancelled, summary.total)}
              tone="danger"
              thickness="thin"
              ariaLabel={t("v2.kpi.cancelledShareAria")}
            />
          </KpiMeter>
        </StatCard>
        <StatCard
          label={t("v2.kpi.revenue")}
          icon={Banknote}
          loading={loading}
          value={compact.value}
          unit={compact.unit}
          hint={t("v2.kpi.revenueHint", { average: formatMoneyLocalized(average, { language }) })}
        >
          {summary.topRevenue ? (
            <KpiMeter
              label={t("v2.kpi.revenueShare", { region: summary.topRevenue.short })}
              shortLabel={summary.topRevenue.short}
              value={percent(shareOf(summary.topRevenue.revenue, summary.revenue))}
            >
              <Meter
                value={shareOf(summary.topRevenue.revenue, summary.revenue)}
                thickness="thin"
                ariaLabel={t("v2.kpi.revenueShareAria", { region: summary.topRevenue.short })}
              />
            </KpiMeter>
          ) : null}
        </StatCard>
      </div>

      {loading ? (
        <SkeletonChart className="h-[420px] rounded-[14px] border border-border bg-surface" />
      ) : rows.length === 0 ? (
        <EmptyState framed icon={MapIcon} title={t("v2.states.empty.title")} description={t("v2.states.empty.text")} />
      ) : (
        <>
          <RegionsMapCard rows={rows} summary={summary} periodLower={periodLower} onSelect={openRegion} />
          <RegionsSuccessCards summary={summary} periodLabel={periodLabel} />
        </>
      )}

      {selected ? (
        <Suspense fallback={null}>
          <RegionDetailDialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            region={{ id: selected.id, name: selected.name }}
            dateParams={dateParams}
            periodLabel={periodLabel}
            fallback={selected.item}
            company={{ totalOrders: summary.total, totalRevenue: summary.revenue, successRate: summary.rate }}
          />
        </Suspense>
      ) : null}
    </>
  );
};

export default RegionsOverview;
