// dizayn-v2: superadmin-regions-map, admin-regions-map
import { ChevronDown, ChevronUp } from "lucide-react";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { shareOf } from "../../../entities/region";
import { cx } from "../../../shared/lib/cx";
import {
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
} from "../../../shared/lib/formatMoney";
import { Button, Card, SegmentedControl, SkeletonChart } from "../../../shared/ui/primitives";
import { ChartNote, RankList, ViewToggle, type ChartView, type RankItem } from "../../../shared/ui/charts";
import {
  escapeHtml,
  ORDER_STEPS,
  regionAvatar,
  STEP_CLASS,
  SUCCESS_STEPS,
  type MapStep,
  type RegionMetric,
  type RegionRow,
  type RegionsSummary,
} from "../model/regionsModel";
import { SummaryRow } from "./regionBlocks";

// Highcharts (≈138 KB gzip) — faqat xarita chiziladigan paytda yuklanadi.
const UzbekistanRegionMap = lazy(() => import("./UzbekistanRegionMap"));

const METRICS: readonly RegionMetric[] = ["orders", "success", "revenue"];
const RANK_LIMIT = 8;
const RANK_PHONE_LIMIT = 5;

export interface RegionsMapCardProps {
  rows: RegionRow[];
  summary: RegionsSummary;
  /** Kichik harfli davr: «bugun», «bu hafta», «01.10 – 08.10». */
  periodLower: string;
  onSelect: (row: RegionRow) => void;
}

/** Rang shkalasi (`.el-heat-scale`): metrika nomi + 4 pog'ona + «Yo'q». */
const MapScale = ({ metric, maxRevenue }: { metric: RegionMetric; maxRevenue: number }) => {
  const { t, i18n } = useTranslation("region");
  const language = i18n.language;
  const steps: { step: MapStep; label: string }[] = useMemo(() => {
    if (metric === "orders") {
      const [a, b, c] = ORDER_STEPS;
      const n = (value: number) => formatNumberLocalized(value, { language });
      return [
        { step: 1, label: `${n(1)}–${n(a - 1)}` },
        { step: 2, label: `${n(a)}–${n(b - 1)}` },
        { step: 3, label: `${n(b)}–${n(c - 1)}` },
        { step: 4, label: `${n(c)}+` },
      ];
    }
    if (metric === "success") {
      const [a, b, c] = SUCCESS_STEPS;
      return [
        { step: 1, label: t("v2.map.scale.below", { value: formatNumberLocalized(a, { language }) }) },
        { step: 2, label: `${formatNumberLocalized(a, { language })}–${formatPercentLocalized(b - 1, { language })}` },
        { step: 3, label: `${formatNumberLocalized(b, { language })}–${formatPercentLocalized(c - 1, { language })}` },
        { step: 4, label: `${formatPercentLocalized(c, { language })}+` },
      ];
    }
    // Tushum — eng katta viloyatga nisbatan choraklar.
    const q = (part: number) => formatCompactMoneyLocalized(maxRevenue * part, { language, withCurrency: false });
    return [
      { step: 1, label: t("v2.map.scale.upTo", { value: q(0.25) }) },
      { step: 2, label: t("v2.map.scale.upTo", { value: q(0.5) }) },
      { step: 3, label: t("v2.map.scale.upTo", { value: q(0.75) }) },
      { step: 4, label: t("v2.map.scale.upTo", { value: q(1) }) },
    ];
  }, [language, maxRevenue, metric, t]);

  return (
    <div
      role="img"
      aria-label={t("v2.map.scale.aria", {
        metric: t(`v2.map.metricLower.${metric}`),
        steps: steps.map((item) => item.label).join(", "),
      })}
      className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-1.5 text-xs text-text-muted"
    >
      <span className="pt-px font-semibold text-text max-md:w-full">{t(`v2.map.metric.${metric}`)}</span>
      <span className="flex gap-0.5">
        {steps.map((item) => (
          <span key={item.step} className="flex w-[60px] flex-col gap-1 max-md:w-auto max-md:min-w-12">
            <span className={cx("h-2.5 w-full rounded-[2px]", STEP_CLASS[item.step])} />
            <span className="whitespace-nowrap">{item.label}</span>
          </span>
        ))}
      </span>
      <span className="flex w-10 flex-col gap-1">
        <span className={cx("h-2.5 w-full rounded-[2px] ring-1 ring-inset ring-border", STEP_CLASS[0])} />
        <span>{t("v2.map.scale.none")}</span>
      </span>
    </div>
  );
};

/**
 * «VILOYATLAR XARITASI» kartasi: metrika (Buyurtmalar · Muvaffaqiyat · Tushum) + «Grafik | Jadval».
 * Grafik: chapda xarita (lazy Highcharts) + shkala, o'ngda «Viloyatlar reytingi» (top 8, telefonda 5),
 * pastda 3 xulosa. Jadval: barcha viloyatlar jadvali (xaritaning jadval egizagi). Viloyat bosilsa — oyna.
 */
const RegionsMapCard = ({ rows, summary, periodLower, onSelect }: RegionsMapCardProps) => {
  const { t, i18n } = useTranslation("region");
  const language = i18n.language;
  const [metric, setMetric] = useState<RegionMetric>("orders");
  const [view, setView] = useState<ChartView>("chart");
  const [expanded, setExpanded] = useState(false);

  const number = (value: number) => formatNumberLocalized(value, { language });
  const percent = (value: number, fractionDigits?: number) =>
    formatPercentLocalized(value, { language, fractionDigits });
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const countTa = (value: number) => t("v2.common.countTa", { count: number(value) });

  const valueLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const row of rows) {
      if (metric === "orders") labels.set(row.id, formatNumberLocalized(row.orders, { language }));
      else if (row.orders <= 0) labels.set(row.id, "—");
      else if (metric === "success") labels.set(row.id, formatPercentLocalized(row.rate, { language }));
      else labels.set(row.id, formatCompactMoneyLocalized(row.revenue, { language, withCurrency: false }));
    }
    return labels;
  }, [language, metric, rows]);

  // Barqaror (xarita `options` shu bilan qayta quriladi): faqat til, jami yoki matn o'zgarganda yangi.
  const totalOrders = summary.total;
  const tooltipHtml = useCallback(
    (row: RegionRow) => {
      const number = (value: number) => formatNumberLocalized(value, { language });
      const percent = (value: number, fractionDigits?: number) =>
        formatPercentLocalized(value, { language, fractionDigits });
      const money = (value: number) => formatMoneyLocalized(value, { language });
      const sep = '<span class="text-text-subtle"> · </span>';
      const bold = (value: string) => `<b class="font-bold text-text">${escapeHtml(value)}</b>`;
      const segments = [
        { value: row.sold, fill: "bg-success" },
        { value: row.pending, fill: "bg-warning" },
        { value: row.cancelled, fill: "bg-danger" },
      ].filter((part) => part.value > 0);
      const bar = segments.length
        ? `<span class="my-1 flex h-1.5 gap-0.5">${segments
            .map(
              (part) => `<span class="block min-w-1 rounded-[2px] ${part.fill}" style="flex:${part.value} 1 0"></span>`,
            )
            .join("")}</span>`
        : "";
      const couriers = row.couriersKnown
        ? `${bold(number(row.couriers))} ${escapeHtml(t("v2.map.tooltip.couriers"))}${sep}`
        : "";
      return `<div class="flex min-w-[220px] flex-col gap-1 rounded-xl border border-border bg-raised p-3 text-[13px] text-text-muted shadow-xl">
      <span class="text-[13px] font-semibold text-text">${escapeHtml(row.name)}</span>
      <span>${bold(number(row.orders))} ${escapeHtml(t("v2.map.tooltip.orders", { share: percent(shareOf(row.orders, totalOrders), 0) }))}</span>
      ${bar}
      <span>${escapeHtml(t("v2.map.tooltip.status", { sold: number(row.sold), pending: number(row.pending), cancelled: number(row.cancelled) }))}</span>
      <span class="mt-1 border-t border-border pt-1.5">${bold(row.orders > 0 ? percent(row.rate) : "—")} ${escapeHtml(t("v2.map.tooltip.success"))}</span>
      <span>${bold(money(row.revenue))} ${escapeHtml(t("v2.map.tooltip.revenue"))}</span>
      <span>${couriers}${bold(number(row.districts))} ${escapeHtml(t("v2.map.tooltip.districts"))}</span>
    </div>`;
    },
    [language, t, totalOrders],
  );

  const rankItems: RankItem[] = rows.map((row) => ({
    id: row.id,
    name: row.short,
    avatarText: regionAvatar(row),
    value: countTa(row.orders),
    sub: row.orders > 0 ? t("v2.map.rank.sold", { rate: percent(row.rate) }) : undefined,
    share: shareOf(row.orders, summary.maxOrders),
    onClick: () => onSelect(row),
    ariaLabel: t("v2.map.rank.rowAria", { name: row.name, count: number(row.orders), rate: percent(row.rate) }),
  }));

  const top3 = summary.active
    .slice(0, 3)
    .map((row) => t("v2.map.ariaItem", { name: row.name, count: number(row.orders) }));
  const least = summary.active.length > 3 ? summary.active[summary.active.length - 1] : undefined;
  const mapAria = t("v2.map.aria", {
    metric: t(`v2.map.metricLower.${metric}`),
    list: [...top3, least ? t("v2.map.ariaLeast", { name: least.name, count: number(least.orders) }) : null]
      .filter(Boolean)
      .join("; "),
  });

  const summaryItems = [
    {
      key: "top",
      label: t("v2.summary.topOrders"),
      value: summary.top?.short ?? "—",
      meta: summary.top
        ? t("v2.summary.topMeta", {
            count: number(summary.top.orders),
            share: percent(shareOf(summary.top.orders, summary.total), 0),
          })
        : undefined,
    },
    {
      key: "lowest",
      label: t("v2.summary.lowestRegion"),
      value: summary.lowest?.short ?? "—",
      meta: summary.lowest
        ? t("v2.common.rateMeta", {
            rate: percent(summary.lowest.rate),
            part: number(summary.lowest.sold),
            total: number(summary.lowest.orders),
          })
        : undefined,
    },
    {
      key: "couriers",
      label: t("v2.summary.activeCouriers"),
      value: summary.couriers != null ? countTa(summary.couriers) : "—",
      meta: t("v2.summary.couriersMeta", { regions: number(rows.length), districts: number(summary.districts) }),
    },
  ];

  const hiddenCount = Math.max(0, rows.length - RANK_LIMIT);

  return (
    <Card
      divided={false}
      // Telefonda sarlavha amallari (metrika + «Grafik | Jadval») to'liq en (maket) — Card amallar o'rami.
      className="max-md:[&>div:first-child>div:last-child]:w-full"
      title={t("v2.map.title")}
      description={t("v2.map.subtitle", { metric: t(`v2.map.metricLower.${metric}`), period: periodLower })}
      actions={
        <div className="flex min-w-0 flex-wrap items-center gap-2 max-md:w-full max-md:flex-col max-md:items-stretch">
          <SegmentedControl<RegionMetric>
            ariaLabel={t("v2.map.metricLabel")}
            value={metric}
            onValueChange={setMetric}
            options={METRICS.map((key) => ({ value: key, label: t(`v2.map.metric.${key}`) }))}
          />
          <ViewToggle value={view} onChange={setView} ariaLabel={t("v2.map.viewAria")} />
        </div>
      }
      bodyClassName="flex flex-col gap-5"
    >
      {view === "chart" ? (
        <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-8 max-lg:grid-cols-1 max-lg:gap-6">
          <div className="flex min-w-0 flex-col gap-3">
            <Suspense fallback={<SkeletonChart className="h-[360px] max-md:h-[220px]" />}>
              <UzbekistanRegionMap
                rows={rows}
                metric={metric}
                maxRevenue={summary.maxRevenue}
                valueLabels={valueLabels}
                tooltipHtml={tooltipHtml}
                onSelect={onSelect}
                ariaLabel={mapAria}
              />
            </Suspense>
            <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <MapScale metric={metric} maxRevenue={summary.maxRevenue} />
              <ChartNote>{t("v2.map.note")}</ChartNote>
            </div>
          </div>
          <section className="flex min-w-0 flex-col gap-3" aria-labelledby="regions-rank-title">
            <div className="flex flex-col gap-0.5">
              <h3 id="regions-rank-title" className="text-sm font-semibold text-text">
                {t("v2.map.rank.title")}
              </h3>
              <p className="text-[13px] text-text-muted">{t("v2.map.rank.subtitle")}</p>
            </div>
            <RankList
              items={rankItems}
              ariaLabel={t("v2.map.rank.aria")}
              limit={expanded ? rankItems.length : RANK_LIMIT}
              mobileLimit={expanded ? rankItems.length : RANK_PHONE_LIMIT}
            />
            {rankItems.length > RANK_PHONE_LIMIT ? (
              <Button
                variant="ghost"
                size="sm"
                className={cx("self-center", hiddenCount === 0 && !expanded && "md:hidden")}
                aria-expanded={expanded}
                rightIcon={expanded ? ChevronUp : ChevronDown}
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? t("v2.common.showLess") : t("v2.map.rank.showAll", { count: number(rows.length) })}
              </Button>
            ) : null}
          </section>
        </div>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-sm [&_tbody_tr:last-child_td]:border-b-0">
            <caption className="sr-only">{t("v2.map.title")}</caption>
            <thead>
              <tr>
                {[
                  { key: "name", label: t("v2.table.region"), className: "text-left" },
                  { key: "orders", label: t("v2.table.orders"), className: "text-right" },
                  { key: "sold", label: t("v2.table.sold"), className: "text-right max-md:hidden" },
                  { key: "pending", label: t("v2.table.pending"), className: "text-right max-md:hidden" },
                  { key: "cancelled", label: t("v2.table.cancelled"), className: "text-right max-md:hidden" },
                  { key: "rate", label: t("v2.table.success"), className: "text-right" },
                  { key: "revenue", label: t("v2.table.revenue"), className: "text-right max-lg:hidden" },
                ].map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cx(
                      "h-9 whitespace-nowrap border-b border-border bg-sunken px-3 text-xs font-semibold uppercase tracking-[.04em] text-text-muted",
                      column.className,
                    )}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors duration-150 hover:bg-row-hover motion-reduce:transition-none"
                >
                  <td className="h-11 border-b border-border px-3 py-1.5 align-middle">
                    <button
                      type="button"
                      onClick={() => onSelect(row)}
                      className="min-h-11 text-left font-semibold text-text hover:underline md:min-h-0"
                    >
                      {row.name}
                    </button>
                  </td>
                  <td className="h-11 whitespace-nowrap border-b border-border px-3 py-1.5 text-right align-middle font-semibold text-text">
                    {number(row.orders)}
                  </td>
                  <td className="h-11 whitespace-nowrap border-b border-border px-3 py-1.5 text-right align-middle text-text max-md:hidden">
                    {number(row.sold)}
                  </td>
                  <td className="h-11 whitespace-nowrap border-b border-border px-3 py-1.5 text-right align-middle text-text max-md:hidden">
                    {number(row.pending)}
                  </td>
                  <td className="h-11 whitespace-nowrap border-b border-border px-3 py-1.5 text-right align-middle text-text max-md:hidden">
                    {number(row.cancelled)}
                  </td>
                  <td className="h-11 whitespace-nowrap border-b border-border px-3 py-1.5 text-right align-middle text-text">
                    {row.orders > 0 ? percent(row.rate) : "—"}
                  </td>
                  <td className="h-11 whitespace-nowrap border-b border-border px-3 py-1.5 text-right align-middle text-text max-lg:hidden">
                    {money(row.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-sunken font-semibold text-text">
                <td className="h-11 border-t border-border px-3 py-1.5">
                  {t("v2.table.total", { count: number(rows.length) })}
                </td>
                <td className="h-11 whitespace-nowrap border-t border-border px-3 py-1.5 text-right">
                  {number(summary.total)}
                </td>
                <td className="h-11 whitespace-nowrap border-t border-border px-3 py-1.5 text-right max-md:hidden">
                  {number(summary.sold)}
                </td>
                <td className="h-11 whitespace-nowrap border-t border-border px-3 py-1.5 text-right max-md:hidden">
                  {number(summary.pending)}
                </td>
                <td className="h-11 whitespace-nowrap border-t border-border px-3 py-1.5 text-right max-md:hidden">
                  {number(summary.cancelled)}
                </td>
                <td className="h-11 whitespace-nowrap border-t border-border px-3 py-1.5 text-right">
                  {percent(summary.rate)}
                </td>
                <td className="h-11 whitespace-nowrap border-t border-border px-3 py-1.5 text-right max-lg:hidden">
                  {money(summary.revenue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <SummaryRow items={summaryItems} />
    </Card>
  );
};

export default RegionsMapCard;
