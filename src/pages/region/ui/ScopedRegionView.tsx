// dizayn-v2: manager-regions-scoped, courier-regions-scoped
import { CircleX, Map as MapIcon, MapPin, PackageCheck, Truck } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  mergeRegionDistrictStats,
  shareOf,
  splitCompactMoney,
  successRateOf,
  useMyRegionDistrictStats,
  useRegionDistrictCatalog,
} from "../../../entities/region";
import { formatMoneyLocalized, formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { Card, EmptyState, ErrorState, PageHeader, SkeletonChart, SkeletonList } from "../../../shared/ui/primitives";
import { Gauge, SegBar, ViewToggle, type ChartView } from "../../../shared/ui/charts";
import { SCOPED_LOWEST_MIN, toDistrictRows } from "../model/scopedModel";
import { SummaryRow } from "./regionBlocks";
import { DistrictRankPhone, DistrictTable, DistrictTiles, SelectedDistrictPanel } from "./ScopedDistricts";

export interface ScopedRegionViewProps {
  dateParams: { startDate?: string; endDate?: string };
  periodLabel: string;
  /** Davr boshqaruvi (sarlavha o'ng tomonida). */
  controls: ReactNode;
}

/**
 * MENEJER va KURYER `/regions` — o'z viloyati, tumanlar kesimida. Ma'lumot FAQAT
 * `GET region/my/district-stats` (kuryerga `stats/all` — 403; viloyat serverda aniqlanadi). 0 buyurtmali
 * tumanlar — `GET district?region_id` katalogi bilan to'ldiriladi. Matnlarda filial/«sizga tegishli»
 * da'vosi yo'q: endpoint viloyat raqamlarini beradi (§9 savol 12 sukuti). Maket: `manager-regions-scoped`
 * (kuryer maketi — o'sha tuzilma, F3 birxillashtirish).
 */
const ScopedRegionView = ({ dateParams, periodLabel, controls }: ScopedRegionViewProps) => {
  const { t, i18n } = useTranslation("region");
  const language = i18n.language;
  const unitTa = t("v2.common.ta") || undefined;
  const query = useMyRegionDistrictStats(dateParams, true);
  const region = query.data?.region ?? null;
  const catalogQuery = useRegionDistrictCatalog(region?.id ?? "", Boolean(region?.id));
  const [view, setView] = useState<ChartView>("chart");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const detailData = query.data?.detail ?? null;
  const catalog = catalogQuery.data;
  const regionId = region?.id;
  const regionLabel = region?.name;
  const detail = useMemo(
    () =>
      detailData ? mergeRegionDistrictStats(detailData, catalog ?? [], { id: regionId, name: regionLabel }) : null,
    [catalog, detailData, regionId, regionLabel],
  );
  const rows = useMemo(() => toDistrictRows(detail?.districts ?? []), [detail?.districts]);

  const number = (value: number) => formatNumberLocalized(value, { language });
  const percent = (value: number, fractionDigits?: number) =>
    formatPercentLocalized(value, { language, fractionDigits });
  const countTa = (value: number) => t("v2.common.countTa", { count: number(value) });

  const total = detail?.summary.totalOrders ?? 0;
  const sold = detail?.summary.totalDelivered ?? 0;
  const cancelled = detail?.summary.totalCancelled ?? 0;
  const pending = Math.max(0, detail?.summary.pendingOrders ?? total - sold - cancelled);
  const revenue = detail?.summary.totalRevenue ?? 0;
  const rate = successRateOf(sold, total);
  const withOrders = rows.filter((row) => row.orders > 0);
  const mostActive = withOrders[0];
  const lowest = withOrders
    .filter((row) => row.orders >= SCOPED_LOWEST_MIN)
    .sort((a, b) => a.rate - b.rate || b.orders - a.orders)[0];
  const selected = rows.find((row) => row.id === selectedId) ?? withOrders[0] ?? rows[0] ?? null;
  const compact = splitCompactMoney(revenue, language);

  const regionName = region?.name ?? "";
  const cardSub = regionName ? t("v2.scoped.cardSubtitle", { period: periodLabel, region: regionName }) : periodLabel;

  const header = (
    <PageHeader
      title={regionName ? t("v2.scoped.title", { region: regionName }) : t("v2.page.title")}
      description={regionName ? t("v2.scoped.subtitle", { region: regionName }) : t("v2.scoped.subtitleNoRegion")}
      actions={controls}
    />
  );

  let body: ReactNode;
  if (!query.data && query.isError) {
    body = (
      <ErrorState
        framed
        error={query.error}
        title={t("v2.states.error.title")}
        description={t("v2.states.error.text")}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  } else if (!query.data) {
    body = (
      <>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-6 max-lg:grid-cols-1 max-md:gap-4">
          <Card divided={false} title={t("v2.gauge.title")}>
            <SkeletonChart />
          </Card>
          <Card divided={false} title={t("v2.scoped.overview.title")}>
            <SkeletonList />
          </Card>
        </div>
        <Card divided={false} title={t("v2.scoped.districts.title")}>
          <SkeletonChart />
        </Card>
      </>
    );
  } else if (!region) {
    body = (
      <EmptyState
        framed
        icon={MapIcon}
        title={t("v2.states.noRegion.title")}
        description={t("v2.states.noRegion.text")}
      />
    );
  } else {
    body = (
      <>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-6 max-lg:grid-cols-1 max-md:gap-4">
          <Card divided={false} title={t("v2.gauge.title")} description={cardSub}>
            <Gauge
              value={rate}
              label={t("v2.common.soldOfAccepted")}
              ariaLabel={t("v2.scoped.gaugeAria", {
                region: regionName,
                rate: percent(rate),
                sold: number(sold),
                cancelled: number(cancelled),
              })}
              stats={[
                { key: "sold", value: countTa(sold), label: t("v2.status.sold"), tone: "success", icon: PackageCheck },
                {
                  key: "cancelled",
                  value: countTa(cancelled),
                  label: t("v2.status.cancelled"),
                  tone: "danger",
                  icon: CircleX,
                },
              ]}
            />
          </Card>
          <Card
            divided={false}
            title={t("v2.scoped.overview.title")}
            description={cardSub}
            bodyClassName="flex flex-col gap-4"
          >
            <dl className="m-0 grid grid-cols-3 gap-4 max-md:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-[13px] font-semibold text-text-muted">{t("v2.kpi.total")}</dt>
                <dd className="m-0 flex flex-col">
                  <span className="text-[28px] leading-9 font-bold text-text max-md:text-[22px] max-md:leading-[30px]">
                    {number(total)}
                    {unitTa ? <span className="ml-1 text-sm font-semibold text-text-muted">{unitTa}</span> : null}
                  </span>
                  <span className="text-xs text-text-muted">
                    {t("v2.scoped.overview.totalMeta", {
                      total: number(rows.length),
                      active: number(withOrders.length),
                    })}
                  </span>
                </dd>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-[13px] font-semibold text-text-muted">{t("v2.kpi.revenue")}</dt>
                <dd className="m-0 flex flex-col">
                  <span className="text-[28px] leading-9 font-bold whitespace-nowrap text-text max-md:text-[22px] max-md:leading-[30px]">
                    {compact.value}
                    <span className="ml-1 text-sm font-semibold text-text-muted">{compact.unit}</span>
                  </span>
                  <span className="text-xs text-text-muted">{formatMoneyLocalized(revenue, { language })}</span>
                </dd>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 max-md:hidden">
                <dt className="text-[13px] font-semibold text-text-muted">{t("v2.status.pending")}</dt>
                <dd className="m-0 flex flex-col">
                  <span className="text-[28px] leading-9 font-bold text-text">
                    {number(pending)}
                    {unitTa ? <span className="ml-1 text-sm font-semibold text-text-muted">{unitTa}</span> : null}
                  </span>
                  <span className="text-xs text-text-muted">
                    {t("v2.scoped.overview.pendingMeta", { share: percent(shareOf(pending, total)) })}
                  </span>
                </dd>
              </div>
            </dl>
            <SegBar
              ariaLabel={t("v2.common.statusAria", {
                total: number(total),
                sold: number(sold),
                pending: number(pending),
                cancelled: number(cancelled),
              })}
              segments={[
                { key: "sold", label: t("v2.status.sold"), value: sold, tone: "success", icon: PackageCheck },
                { key: "pending", label: t("v2.status.pending"), value: pending, tone: "warning", icon: Truck },
                { key: "cancelled", label: t("v2.status.cancelled"), value: cancelled, tone: "danger", icon: CircleX },
              ]}
            />
            {withOrders.length > 0 ? (
              <SummaryRow
                items={[
                  {
                    key: "active",
                    label: t("v2.scoped.overview.mostActive"),
                    value: mostActive?.name ?? "—",
                    meta: mostActive
                      ? t("v2.summary.topMeta", {
                          count: number(mostActive.orders),
                          share: percent(shareOf(mostActive.orders, total), 0),
                        })
                      : undefined,
                  },
                  {
                    key: "lowest",
                    label: t("v2.scoped.overview.lowest"),
                    value: lowest?.name ?? "—",
                    meta: lowest
                      ? t("v2.common.rateMeta", {
                          rate: percent(lowest.rate),
                          part: number(lowest.sold),
                          total: number(lowest.orders),
                        })
                      : undefined,
                  },
                ]}
              />
            ) : null}
          </Card>
        </div>

        <Card
          divided={false}
          className="max-md:[&>div:first-child>div:last-child]:w-full"
          title={t("v2.scoped.districts.title")}
          titleAddon={
            rows.length > 0 ? (
              <span className="text-base font-semibold text-text-muted">({number(rows.length)})</span>
            ) : undefined
          }
          description={t("v2.scoped.districts.subtitle")}
          actions={
            rows.length > 0 ? (
              <ViewToggle value={view} onChange={setView} ariaLabel={t("v2.scoped.districts.viewAria")} />
            ) : undefined
          }
        >
          {rows.length === 0 ? (
            <EmptyState
              size="chart"
              icon={MapPin}
              title={t("v2.states.noDistricts.title")}
              description={t("v2.states.noDistricts.text")}
            />
          ) : view === "table" ? (
            // Jadval rejimida «Tanlangan tuman» paneli yo'q — nom tugma emas (bosish hech narsa ko'rsatmasdi).
            <DistrictTable rows={rows} />
          ) : (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-6 max-lg:grid-cols-1 max-md:hidden">
                <DistrictTiles rows={rows} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
                {selected ? <SelectedDistrictPanel row={selected} regionRate={rate} /> : null}
              </div>
              <div className="flex min-w-0 flex-col gap-4 md:hidden">
                {selected ? <SelectedDistrictPanel row={selected} regionRate={rate} /> : null}
                <DistrictRankPhone rows={rows} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
              </div>
            </>
          )}
        </Card>

        {view === "chart" && withOrders.length > 0 ? (
          <Card
            divided={false}
            title={t("v2.scoped.table.title")}
            description={t("v2.scoped.table.subtitle", { count: number(withOrders.length) })}
            className="max-md:hidden"
          >
            <DistrictTable rows={rows} onSelect={setSelectedId} />
          </Card>
        ) : null}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      {header}
      {body}
    </div>
  );
};

export default ScopedRegionView;
