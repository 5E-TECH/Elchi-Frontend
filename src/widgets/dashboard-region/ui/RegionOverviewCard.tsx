// dizayn-v2: superadmin-dashboard-main, admin-dashboard-main, registrator-dashboard-main
import { ChevronDown, ChevronUp, MapPinned } from "lucide-react";
import { lazy, memo, Suspense, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRegionStats } from "../../../entities/region";
import { cx } from "../../../shared/lib/cx";
import { getTodayRange } from "../../../shared/lib/dateRange";
import {
  formatCompactMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
} from "../../../shared/lib/formatMoney";
import { ChartNote, RankList } from "../../../shared/ui/charts";
import {
  Button,
  Card,
  EmptyState,
  Pressable,
  QueryBoundary,
  SegmentedControl,
} from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import {
  ORDER_STEPS,
  regionStep,
  STEP_CLASS,
  SUCCESS_STEPS,
  summarizeRegions,
  toRegionRows,
  type RegionMetric,
  type RegionRow,
} from "../lib/regionModel";
import RegionTiles from "./RegionTiles";

export interface RegionOverviewCardProps {
  /** Bo'sh — bugun (hozirgi xulq). */
  startDate?: string;
  endDate?: string;
  /** Sarlavha izohidagi davr: «bugun», «bu hafta», «01.10 – 08.10». */
  periodText: string;
  /** Oyna sarlavhasi ostidagi davr nomi: «Bugun», «Bu hafta», «01.10 – 08.10» (berilmasa — `periodText`). */
  periodLabel?: string;
  /** `registrator` — «Daromad» ko'rsatkichi yo'q, jadvalda «Jarayonda · Bekor», 3-xulosa — bekor ulushi. */
  variant?: "full" | "registrator";
}

const TABLE_LIMIT = 8;
const PHONE_LIMIT = 5;
const TH = "h-9 whitespace-nowrap bg-sunken px-2.5 text-xs font-semibold uppercase tracking-[.04em] text-text-muted first:pl-4 last:pr-4";
const TD = "h-11 border-t border-border px-2.5 align-middle first:pl-4 last:pr-4";

/**
 * Viloyat tafsiloti oynasi (egasi «regions», §1.7/§8.3) — FAQAT dinamik import: chunk katak/qator
 * bosilgandagina yuklanadi (birinchi ochilish byudjeti §1.9).
 */
const RegionDetailDialog = lazy(() => import("../../region-detail"));

/**
 * «HUDUDLAR BO'YICHA» (SA/admin/registrator, `widgets.region`): chapda kartogramma + shkala + 3 xulosa,
 * o'ngda jadval (8 qator + «Jami»), telefonda jadval o'rniga «Eng faol hududlar» top 5. Ma'lumot —
 * `useRegionStats` (`GET region/stats/all`), sana bo'sh bo'lsa bugun (hozirgi `RegionStatsCard` xulqi).
 * Highcharts va `pages/region` import QILINMAYDI (§1.9).
 */
const RegionOverviewCard = ({ startDate, endDate, periodText, periodLabel, variant = "full" }: RegionOverviewCardProps) => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const [metric, setMetric] = useState<RegionMetric>("orders");
  const [expanded, setExpanded] = useState(false);
  // Tanlangan viloyat oyna yopilgandan keyin ham saqlanadi (yopilish animatsiyasi uchun mount qoladi).
  const [selected, setSelected] = useState<RegionRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const openRegion = useCallback((row: RegionRow) => {
    setSelected(row);
    setDialogOpen(true);
  }, []);
  const isRegistrator = variant === "registrator";
  // Registrator ham oynani ochadi, lekin daromadsiz (`showRevenue={false}`) — eski oyna unga daromadni
  // ko'rsatmas edi (`showFinancialMetrics=false`).
  // Telefonda kataklar ~41px (7 ustun) — bosish nishoni 44px dan kichik; u yerda viloyat «Eng faol
  // hududlar» ro'yxati qatoridan (≥ 44px) ochiladi, kataklar faqat ko'rsatadi.
  const isPhone = useIsPhone();

  const params = useMemo(() => {
    const today = getTodayRange();
    return { startDate: startDate || today.from, endDate: endDate || today.to };
  }, [endDate, startDate]);
  const query = useRegionStats(params, true);
  // Oynadagi «kompaniyadagi ulushi» / «kompaniyaga nisbatan» — shu kartadagi jami raqamlar.
  const company = useMemo(() => {
    if (!query.data) return null;
    const summary = summarizeRegions(toRegionRows(query.data.regions));
    return {
      totalOrders: summary.totalOrders,
      totalRevenue: summary.totalRevenue,
      successRate: summary.totalOrders > 0 ? (summary.totalDelivered / summary.totalOrders) * 100 : 0,
    };
  }, [query.data]);

  const metricOptions = (isRegistrator ? (["orders", "success"] as const) : (["orders", "success", "revenue"] as const)).map(
    (value) => ({ value, label: t(`v2Dashboard.region.metric.${value}`) }),
  );

  const count = (value: number) => formatNumberLocalized(value, { language });
  const pct = (value: number) => formatPercentLocalized(value, { language });
  const money = (value: number) => formatCompactMoneyLocalized(value, { language });

  const scaleLabels: Record<RegionMetric, [string, string]> = {
    orders: [`1–${ORDER_STEPS[0] - 1}`, `${ORDER_STEPS[2]}+`],
    success: [`< ${pct(SUCCESS_STEPS[0])}`, `${pct(SUCCESS_STEPS[2])}+`],
    revenue: [t("v2Dashboard.region.scaleLow"), t("v2Dashboard.region.scaleHigh")],
  };

  return (
    <Card
      divided={false}
      // Telefonda sarlavhadagi boshqaruv qatori to'liq en (segment tugmalari kesilmasin).
      className="max-md:[&>div:first-child>div:last-child]:w-full"
      title={t("v2Dashboard.region.title")}
      description={t("v2Dashboard.region.subtitle", { period: periodText })}
      actions={
        <div className="max-md:w-full">
          <SegmentedControl<RegionMetric>
            ariaLabel={t("v2Dashboard.region.metricLabel")}
            value={metric}
            onValueChange={setMetric}
            options={metricOptions}
          />
        </div>
      }
    >
      <QueryBoundary
        query={query}
        skeleton="chart"
        size="chart"
        isEmpty={(data) => data.regions.length === 0}
        empty={<EmptyState size="chart" icon={MapPinned} title={t("v2Dashboard.region.empty")} />}
      >
        {(data, { isRefetching }) => {
          const rows = toRegionRows(data.regions);
          const summary = summarizeRegions(rows);
          const overallRate = summary.totalOrders > 0 ? (summary.totalDelivered / summary.totalOrders) * 100 : 0;
          const tableRows = expanded ? rows : rows.slice(0, TABLE_LIMIT);
          const canExpand = rows.length > PHONE_LIMIT;
          const maxRevenue = Math.max(0, ...rows.map((row) => row.revenue));
          const top3 = rows.filter((row) => row.orders > 0).slice(0, 3);
          const mapAria = t("v2Dashboard.region.mapAria", {
            list: top3.map((row) => `${row.name} ${count(row.orders)}`).join(", "),
          });

          const nameCell = (row: RegionRow) => <span className="whitespace-nowrap font-semibold text-text">{row.name}</span>;

          return (
            <div className={cx("flex flex-col gap-4 transition-opacity", isRefetching && "opacity-45")}>
              <div className="flex flex-wrap items-start gap-6 max-md:gap-4">
                <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-3">
                  <RegionTiles rows={rows} metric={metric} ariaLabel={mapAria} showRevenue={!isRegistrator} onSelect={isPhone ? undefined : openRegion} />
                  <div
                    aria-label={t("v2Dashboard.region.scaleAria", { metric: t(`v2Dashboard.region.metric.${metric}`) })}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-text-muted"
                  >
                    <span>{t(`v2Dashboard.region.metric.${metric}`)}</span>
                    <span>{scaleLabels[metric][0]}</span>
                    <span aria-hidden="true" className="flex gap-0.5">
                      {([1, 2, 3, 4] as const).map((step) => (
                        <span key={step} className={cx("h-2.5 w-7 rounded-[2px]", STEP_CLASS[step])} />
                      ))}
                    </span>
                    <span>{scaleLabels[metric][1]}</span>
                  </div>
                  <ChartNote>{t("v2Dashboard.region.clickNote")}</ChartNote>
                  <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))] gap-x-4 gap-y-3 rounded-xl bg-sunken px-4 py-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <dt className="text-xs text-text-muted">{t("v2Dashboard.region.topOrders")}</dt>
                      <dd className="m-0 text-sm font-semibold text-text">{summary.top?.name ?? "—"}</dd>
                      {summary.top ? (
                        <dd className="m-0 text-xs text-text-muted">
                          {t("v2Dashboard.region.topOrdersMeta", {
                            count: count(summary.top.orders),
                            share: formatPercentLocalized((summary.top.orders / Math.max(1, summary.totalOrders)) * 100, {
                              language,
                              fractionDigits: 0,
                            }),
                          })}
                        </dd>
                      ) : null}
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <dt className="text-xs text-text-muted">{t("v2Dashboard.region.lowestSuccess")}</dt>
                      <dd className="m-0 text-sm font-semibold text-text">{summary.lowest?.name ?? "—"}</dd>
                      {summary.lowest ? (
                        <dd className="m-0 text-xs text-text-muted">
                          {t("v2Dashboard.region.rateMeta", {
                            rate: pct(summary.lowest.rate),
                            part: count(summary.lowest.delivered),
                            total: count(summary.lowest.orders),
                          })}
                        </dd>
                      ) : null}
                    </div>
                    {isRegistrator ? (
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <dt className="text-xs text-text-muted">{t("v2Dashboard.region.mostCancelled")}</dt>
                        <dd className="m-0 text-sm font-semibold text-text">{summary.mostCancelled?.name ?? "—"}</dd>
                        {summary.mostCancelled ? (
                          <dd className="m-0 text-xs text-text-muted">
                            {t("v2Dashboard.region.rateMeta", {
                              rate: pct((summary.mostCancelled.cancelled / summary.mostCancelled.orders) * 100),
                              part: count(summary.mostCancelled.cancelled),
                              total: count(summary.mostCancelled.orders),
                            })}
                          </dd>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <dt className="text-xs text-text-muted">{t("v2Dashboard.region.activeCouriers")}</dt>
                        <dd className="m-0 text-sm font-semibold text-text">
                          {t("v2Charts.countTa", { value: count(summary.activeCouriers) })}
                        </dd>
                        <dd className="m-0 text-xs text-text-muted">
                          {t("v2Dashboard.region.inRegions", { count: summary.regionsWithCouriers })}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Desktop/planshet: jadval (grafikning jadval egizagi) */}
                <div className="min-w-0 flex-[1_1_380px] overflow-x-auto rounded-xl border border-border max-md:hidden">
                  <table className="w-full border-collapse text-sm text-text">
                    <caption className="sr-only">{t("v2Dashboard.region.title")}</caption>
                    <thead>
                      <tr>
                        <th scope="col" className={cx(TH, "text-left")}>{t("v2Dashboard.region.colRegion")}</th>
                        <th scope="col" className={cx(TH, "text-right")}>{t("v2Dashboard.region.colOrders")}</th>
                        {isRegistrator ? (
                          <>
                            <th scope="col" className={cx(TH, "text-right")}>{t("v2Dashboard.region.colPending")}</th>
                            <th scope="col" className={cx(TH, "text-right")}>{t("v2Dashboard.region.colCancelled")}</th>
                          </>
                        ) : null}
                        <th scope="col" className={cx(TH, "text-right")}>{t("v2Dashboard.region.colSuccess")}</th>
                        {isRegistrator ? null : (
                          <th scope="col" className={cx(TH, "text-right")}>{t("v2Dashboard.region.colRevenue")}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((row) => (
                        // Qator sichqoncha bilan bosiladi; klaviatura — ismdagi tugma (bosish qatorga ko'tariladi).
                        <tr
                          key={row.id}
                          data-region-row={row.id}
                          className="cursor-pointer transition-colors duration-150 hover:bg-row-hover motion-reduce:transition-none"
                          onClick={() => openRegion(row)}
                        >
                          <th scope="row" className={cx(TD, "text-left font-normal")}>
                            <Pressable
                              className="-mx-1 inline-flex min-h-11 items-center rounded-md px-1 text-left hover:underline"
                            >
                              {nameCell(row)}
                            </Pressable>
                          </th>
                          <td className={cx(TD, "text-right")}>
                            <span
                              className={cx(
                                "ml-auto inline-flex min-h-7 w-12 items-center justify-center rounded-[4px] text-xs font-semibold proportional-nums",
                                STEP_CLASS[regionStep(row, "orders", maxRevenue)],
                              )}
                            >
                              {count(row.orders)}
                            </span>
                          </td>
                          {isRegistrator ? (
                            <>
                              <td className={cx(TD, "text-right proportional-nums")}>{count(row.pending)}</td>
                              <td className={cx(TD, "text-right proportional-nums")}>{count(row.cancelled)}</td>
                            </>
                          ) : null}
                          <td className={cx(TD, "text-right whitespace-nowrap proportional-nums")}>{pct(row.rate)}</td>
                          {isRegistrator ? null : (
                            <td className={cx(TD, "text-right whitespace-nowrap font-semibold proportional-nums")}>{money(row.revenue)}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-sunken font-semibold">
                        <th scope="row" className={cx(TD, "text-left")}>
                          {t("v2Dashboard.region.total", { count: rows.length })}
                        </th>
                        <td className={cx(TD, "text-right proportional-nums")}>{count(summary.totalOrders)}</td>
                        {isRegistrator ? (
                          <>
                            <td className={cx(TD, "text-right proportional-nums")}>{count(summary.totalPending)}</td>
                            <td className={cx(TD, "text-right proportional-nums")}>{count(summary.totalCancelled)}</td>
                          </>
                        ) : null}
                        <td className={cx(TD, "text-right whitespace-nowrap proportional-nums")}>{pct(overallRate)}</td>
                        {isRegistrator ? null : (
                          <td className={cx(TD, "text-right whitespace-nowrap proportional-nums")}>{money(summary.totalRevenue)}</td>
                        )}
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Telefon: jadval o'rniga eng faol hududlar */}
                <div className="hidden w-full min-w-0 max-md:block">
                  <RankList
                    ariaLabel={t("v2Dashboard.region.phoneRank")}
                    limit={expanded ? rows.length : PHONE_LIMIT}
                    items={rows.map((row) => ({
                      id: row.id,
                      name: row.name,
                      avatarText: row.tile?.short,
                      value: t("v2Charts.countTa", { value: count(row.orders) }),
                      sub: t("v2Dashboard.region.soldShare", { rate: pct(row.rate) }),
                      onClick: () => openRegion(row),
                    }))}
                  />
                </div>
              </div>
              {canExpand ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cx("self-center", rows.length <= TABLE_LIMIT && !expanded && "md:hidden")}
                  aria-expanded={expanded}
                  rightIcon={expanded ? ChevronUp : ChevronDown}
                  onClick={() => setExpanded((value) => !value)}
                >
                  {expanded ? t("v2Charts.showLess") : t("v2Dashboard.region.showAll", { count: rows.length })}
                </Button>
              ) : null}
            </div>
          );
        }}
      </QueryBoundary>
      {selected ? (
        <Suspense fallback={null}>
          <RegionDetailDialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            /* Oyna sarlavhasi — to'liq API nomi («Samarqand viloyati»), katakdagi qisqa nom emas. */
            region={{ id: selected.id, name: selected.item.name || selected.name }}
            dateParams={params}
            periodLabel={periodLabel ?? periodText}
            fallback={selected.item}
            company={company ?? undefined}
            showRevenue={!isRegistrator}
          />
        </Suspense>
      ) : null}
    </Card>
  );
};

export default memo(RegionOverviewCard);
