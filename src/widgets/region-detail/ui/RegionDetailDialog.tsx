// dizayn-v2: superadmin-regions-region-modal, admin-regions-region-detail-dialog, superadmin-dashboard-region-modal
import {
  ArrowDown,
  Banknote,
  ChevronDown,
  ChevronUp,
  CircleX,
  Gauge as GaugeIcon,
  MapPin,
  PackageCheck,
  Phone,
  ShoppingBag,
  Truck,
  Users,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  pendingOf,
  shareOf,
  splitCompactMoney,
  successRateOf,
  useRegionDetailStats,
  type DistrictStatsItem,
  type RegionCourierStats,
  type RegionItem,
} from "../../../entities/region";
import { cx } from "../../../shared/lib/cx";
import {
  MINUS_SIGN,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
} from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import {
  Button,
  Dialog,
  ErrorState,
  SkeletonChart,
  SkeletonList,
  StatCard,
} from "../../../shared/ui/primitives";
import {
  ChartLegend,
  ChartNote,
  DeltaChip,
  Donut,
  Gauge,
  Meter,
  RankList,
  ViewToggle,
  successZoneTone,
  type ChartView,
  type RankItem,
} from "../../../shared/ui/charts";

/** Kompaniya bo'yicha qiymatlar — ulush va «kompaniyaga nisbatan» uchun (xarita/dashboard jami). */
export interface RegionDetailCompany {
  totalOrders: number;
  totalRevenue: number;
  /** 0..100 */
  successRate: number;
}

export interface RegionDetailDialogProps {
  open: boolean;
  onClose: () => void;
  region: { id: string; name: string } | null;
  dateParams: { startDate?: string; endDate?: string };
  /** «Bugun», «Bu hafta», «01.10 – 08.10». */
  periodLabel: string;
  /** Xaritadagi qator — yuklanish va xatoda KPI shu raqamlardan. */
  fallback?: RegionItem;
  company?: RegionDetailCompany;
  /**
   * Daromad ko'rsatilsinmi (sukut `true`). `false` — «Umumiy tushum» KPI, uning ulushi, tumanlar va
   * kuryerlar qatoridagi summa hamda jadvaldagi «Tushum» ustuni yashirinadi (registrator — eski oyna
   * unga daromadni ko'rsatmas edi).
   */
  showRevenue?: boolean;
}

/** Telefonda tumanlar reytingi yig'iq holatda — 5 ta. */
const DISTRICT_PHONE_LIMIT = 5;
/** «Eng past sotuv» — kamida shuncha buyurtmali tumanlar orasida (maket «2+ ta»). */
const LOWEST_MIN_ORDERS = 2;
/** Kuryer foizi taxminiy — buyurtmasi shundan kam (maket «30 tadan kam»). */
const COURIER_SAMPLE_MIN = 30;

const ppText = (value: number, language: string) => {
  const sign = value > 0 ? "+" : value < 0 ? MINUS_SIGN : "";
  return `${sign}${formatNumberLocalized(Math.abs(value), { language, fractionDigits: 1 })}`;
};

/** KPI ostidagi meter qatori: «Kompaniyadagi ulushi … 9,9%» (telefonda qisqa yorliq). */
const KpiMeter = ({
  label,
  shortLabel,
  value,
  children,
}: {
  label: string;
  shortLabel: string;
  value: string;
  children: ReactNode;
}) => (
  <div className="mt-auto flex min-w-0 flex-col gap-1.5 pt-2">
    <span className="flex min-w-0 items-center justify-between gap-2 text-xs text-text-muted">
      <span className="min-w-0 truncate">
        <span className="max-md:hidden">{label}</span>
        <span className="md:hidden">{shortLabel}</span>
      </span>
      <span className="shrink-0 font-semibold text-text proportional-nums">{value}</span>
    </span>
    {children}
  </div>
);

/** Bo'lim sarlavhasi (`.el-chart-head`): h3 + izoh, o'ngda boshqaruv. */
const SectionHead = ({
  title,
  count,
  description,
  actions,
}: {
  title: string;
  count?: number;
  description: ReactNode;
  actions?: ReactNode;
}) => {
  const { i18n } = useTranslation();
  return (
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="text-base font-bold text-text">
          {title}
          {count != null ? (
            <span className="ml-1.5 font-semibold text-text-muted">
              ({formatNumberLocalized(count, { language: i18n.language })})
            </span>
          ) : null}
        </h3>
        <p className="text-[13px] text-text-muted">{description}</p>
      </div>
      {actions}
    </div>
  );
};

/** Uch xulosa (`.el-summary`): yorliq · qiymat · izoh. */
const SummaryRow = ({
  items,
}: {
  items: { key: string; label: string; value: string; meta?: string }[];
}) => (
  <dl className="m-0 grid grid-cols-3 gap-4 rounded-xl bg-sunken px-4 py-3.5 max-md:grid-cols-1 max-md:gap-3">
    {items.map((item) => (
      <div key={item.key} className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-xs text-text-muted">{item.label}</dt>
        <dd className="m-0 flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-text">{item.value}</span>
          {item.meta ? <span className="text-xs text-text-muted">{item.meta}</span> : null}
        </dd>
      </div>
    ))}
  </dl>
);

/**
 * VILOYAT TAFSILOTI OYNASI (umumiy: `/regions` xaritasi va dashboard kartogrammasi; `lazy` — faqat
 * bosilganda yuklanadi). Ma'lumot `GET region/stats/:id` (kuryer/market uchun CHAQIRILMAYDI — iste'molchi
 * ochmaydi). Tuzilma — maket `superadmin-regions-region-modal` (dashboard oynasi birxillashtirildi):
 * KPI 4 → [Muvaffaqiyat · Buyurtmalar holati] → «Tumanlar» (xulosa + reyting | jadval) → «Viloyat
 * kuryerlari». «Kunlik buyurtmalar» — maketda «Taklif», API yo'q → chizilmaydi. Xato bo'lsa KPI va
 * grafiklar `fallback` (xaritadagi qator) raqamlaridan, kuryer va tumanlar ro'yxati bo'sh.
 */
const RegionDetailDialog = ({
  open,
  onClose,
  region,
  dateParams,
  periodLabel,
  fallback,
  company,
  showRevenue = true,
}: RegionDetailDialogProps) => {
  const { t, i18n } = useTranslation("region");
  const language = i18n.language;
  // en — birliksiz («312»), uz «ta», ru «шт.».
  const unitTa = t("v2.common.ta") || undefined;
  const [view, setView] = useState<ChartView>("chart");
  const [showEmpty, setShowEmpty] = useState(false);
  const [districtsExpanded, setDistrictsExpanded] = useState(false);
  // Boshqa viloyat ochilganda ko'rinish holati boshidan.
  const regionId = region?.id ?? "";
  const [stateRegionId, setStateRegionId] = useState(regionId);
  if (stateRegionId !== regionId) {
    setStateRegionId(regionId);
    setView("chart");
    setShowEmpty(false);
    setDistrictsExpanded(false);
  }

  const query = useRegionDetailStats(region?.id ?? "", dateParams, open && Boolean(region?.id));
  const detail = query.data;
  const failed = !detail && query.isError;
  const loading = !detail && !failed;

  const number = (value: number) => formatNumberLocalized(value, { language });
  const percent = (value: number) => formatPercentLocalized(value, { language });
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const countTa = (value: number) => t("v2.common.countTa", { count: number(value) });

  // Raqamlar: tafsilot kelgan bo'lsa — undan, aks holda xaritadagi qatordan (yuklanish/xato).
  const hasFigures = Boolean(detail || fallback);
  // `fallback` berilmagan va so'rov yiqilgan — KPI/grafik skeleti abadiy aylanmasin: faqat xato ko'rinadi.
  const showFigures = hasFigures || !failed;
  const total = detail?.summary.totalOrders ?? fallback?.ordersCount ?? 0;
  const sold = detail?.summary.totalDelivered ?? fallback?.deliveredOrders ?? 0;
  const cancelled = detail?.summary.totalCancelled ?? fallback?.cancelledOrders ?? 0;
  const pending = pendingOf(
    total,
    sold,
    cancelled,
    detail?.summary.pendingOrders ?? fallback?.pendingOrders,
  );
  const revenue = detail?.summary.totalRevenue ?? fallback?.totalRevenue ?? 0;
  const rate = successRateOf(sold, total);
  const activeCouriers = detail?.summary.activeCouriers ?? fallback?.activeCouriers ?? 0;
  const couriers: RegionCourierStats[] = detail?.couriers ?? [];
  const districts: DistrictStatsItem[] = useMemo(
    () =>
      [...(detail?.districts ?? [])].sort(
        (a, b) => b.totalOrders - a.totalOrders || a.name.localeCompare(b.name),
      ),
    [detail?.districts],
  );
  const districtTotal = detail ? districts.length : (fallback?.districtCount ?? 0);
  const withOrders = districts.filter((district) => district.totalOrders > 0);
  const withoutOrders = districts.filter((district) => district.totalOrders <= 0);
  const primaryCount = couriers.filter((courier) => courier.isPrimary).length;
  const companyRate = company?.successRate;
  const rateDelta = companyRate != null && total > 0 ? rate - companyRate : null;
  const compact = splitCompactMoney(revenue, language);
  const name = region?.name ?? fallback?.name ?? "";

  // ── Tumanlar: xulosa ───────────────────────────────────────────────────────
  const topDistrict = withOrders[0];
  const lowestDistrict = withOrders
    .filter((district) => district.totalOrders >= LOWEST_MIN_ORDERS)
    .map((district) => ({
      district,
      rate: successRateOf(district.deliveredOrders, district.totalOrders),
    }))
    .sort((a, b) => a.rate - b.rate || b.district.totalOrders - a.district.totalOrders)[0];
  const noCourier = districts.filter((district) => district.activeCouriers <= 0);
  const noCourierMeta =
    noCourier.length === 0
      ? undefined
      : noCourier.length <= 2
        ? noCourier.map((district) => district.name).join(", ")
        : t("v2.detail.districts.namesMore", {
            names: noCourier
              .slice(0, 2)
              .map((district) => district.name)
              .join(", "),
            count: number(noCourier.length - 2),
          });

  const maxDistrictOrders = withOrders[0]?.totalOrders ?? 0;
  const districtItem = (district: DistrictStatsItem, index: number): RankItem => {
    const districtRate = successRateOf(district.deliveredOrders, district.totalOrders);
    const pendingCount = pendingOf(
      district.totalOrders,
      district.deliveredOrders,
      district.cancelledOrders,
      district.pendingOrders,
    );
    return {
      id: district.id,
      rank: district.totalOrders > 0 ? index + 1 : undefined,
      name: district.name,
      value: countTa(district.totalOrders),
      sub:
        district.totalOrders <= 0
          ? undefined
          : district.deliveredOrders > 0 || pendingCount === 0
            ? showRevenue
              ? `${percent(districtRate)} · ${money(district.revenue)}`
              : percent(districtRate)
            : t("v2.detail.districts.pendingOnly", { count: number(pendingCount) }),
      share: maxDistrictOrders > 0 ? shareOf(district.totalOrders, maxDistrictOrders) : 0,
      meta: district.satoCode ? t("v2.common.sato", { code: district.satoCode }) : undefined,
    };
  };
  const rankDistricts = [...withOrders, ...(showEmpty ? withoutOrders : [])];
  const rankItems = rankDistricts.map(districtItem);

  const courierItems: RankItem[] = couriers.map((courier) => {
    // YD7xyjX9: kuryer tumani birinchi — telefonda joy yetmasa raqam kesiladi, tuman emas.
    const districtName = districts.find((district) => district.id === courier.districtId)?.name;
    const MetaIcon = districtName ? MapPin : Phone;
    const meta = [
      districtName,
      courier.phone ? formatPhone(courier.phone) : null,
      showRevenue && courier.revenue != null ? money(courier.revenue) : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      id: courier.id,
      name: courier.name || t("unknown"),
      value: percent(courier.successRate),
      sub: t("v2.common.partOfTotal", {
        part: number(courier.deliveredOrders),
        total: number(courier.totalOrders),
      }),
      share: courier.successRate,
      badge: courier.isPrimary
        ? { label: t("v2.detail.couriers.primary"), tone: "neutral" }
        : undefined,
      meta: meta ? (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <MetaIcon size={14} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{meta}</span>
        </span>
      ) : undefined,
    };
  });
  const smallSample = couriers.some(
    (courier) => courier.totalOrders > 0 && courier.totalOrders < COURIER_SAMPLE_MIN,
  );

  const statusSegments = [
    {
      key: "sold",
      label: t("v2.status.sold"),
      value: sold,
      tone: "success" as const,
      icon: PackageCheck,
    },
    {
      key: "pending",
      label: t("v2.status.pending"),
      value: pending,
      tone: "warning" as const,
      icon: Truck,
    },
    {
      key: "cancelled",
      label: t("v2.status.cancelled"),
      value: cancelled,
      tone: "danger" as const,
      icon: CircleX,
    },
  ];

  const emptyRow =
    withoutOrders.length > 0 ? (
      <div className="flex min-w-0 items-center justify-between gap-3 border-t border-border py-2.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold text-text-muted">
            {t("v2.detail.districts.withoutOrders", { count: number(withoutOrders.length) })}
          </span>
          <span className="text-xs text-text-muted">
            {withoutOrders.map((district) => district.name).join(", ")}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={showEmpty}
          rightIcon={showEmpty ? ChevronUp : ChevronDown}
          onClick={() => setShowEmpty((value) => !value)}
          className="shrink-0"
        >
          {showEmpty ? t("v2.common.hide") : t("v2.common.show")}
        </Button>
      </div>
    ) : null;

  const districtTable = (
    <div className="relative overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-sm [&_tr:last-child_td]:border-b-0">
        <thead>
          <tr>
            {[
              { key: "name", label: t("v2.detail.table.district"), className: "text-left" },
              {
                key: "sato",
                label: t("v2.detail.table.sato"),
                className: "text-left max-lg:hidden",
              },
              {
                key: "orders",
                label: t("v2.detail.table.orders"),
                className: "text-right",
                sorted: true,
              },
              { key: "rate", label: t("v2.detail.table.success"), className: "text-right" },
              ...(showRevenue
                ? [{ key: "revenue", label: t("v2.detail.table.revenue"), className: "text-right" }]
                : []),
              {
                key: "couriers",
                label: t("v2.detail.table.couriers"),
                className: "text-right max-lg:hidden",
              },
            ].map((column) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={column.sorted ? "descending" : undefined}
                className={cx(
                  "h-9 whitespace-nowrap border-b border-border bg-sunken px-3 text-xs font-semibold uppercase tracking-[.04em] text-text-muted",
                  column.className,
                )}
              >
                {column.sorted ? (
                  <span
                    className="inline-flex items-center gap-1"
                    title={t("v2.detail.table.sortedAria")}
                  >
                    {column.label}
                    <ArrowDown size={14} aria-hidden="true" />
                  </span>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...withOrders, ...(showEmpty ? withoutOrders : [])].map((district) => (
            <tr key={district.id}>
              <td className="h-11 border-b border-border px-3 py-1.5 align-middle text-text">
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold">{district.name}</span>
                  <span className="text-xs text-text-muted lg:hidden">
                    {t("v2.detail.table.courierCount", { count: number(district.activeCouriers) })}
                  </span>
                </span>
              </td>
              <td className="h-11 border-b border-border px-3 py-1.5 align-middle text-text-muted max-lg:hidden">
                {district.satoCode ?? "—"}
              </td>
              <td className="h-11 whitespace-nowrap border-b border-border px-3 py-1.5 text-right align-middle font-semibold text-text">
                {number(district.totalOrders)}
              </td>
              <td className="h-11 whitespace-nowrap border-b border-border px-3 py-1.5 text-right align-middle text-text">
                {district.totalOrders > 0
                  ? percent(successRateOf(district.deliveredOrders, district.totalOrders))
                  : "—"}
              </td>
              {showRevenue ? (
                <td className="h-11 whitespace-nowrap border-b border-border px-3 py-1.5 text-right align-middle text-text">
                  {money(district.revenue)}
                </td>
              ) : null}
              <td className="h-11 whitespace-nowrap border-b border-border px-3 py-1.5 text-right align-middle text-text max-lg:hidden">
                {number(district.activeCouriers)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-sunken font-semibold">
            <td className="h-11 px-3 py-1.5 text-text">
              {t("v2.detail.table.total", { count: number(districts.length) })}
            </td>
            <td className="h-11 px-3 py-1.5 max-lg:hidden" />
            <td className="h-11 whitespace-nowrap px-3 py-1.5 text-right text-text">
              {countTa(total)}
            </td>
            <td className="h-11 whitespace-nowrap px-3 py-1.5 text-right text-text">
              {percent(rate)}
            </td>
            {showRevenue ? (
              <td className="h-11 whitespace-nowrap px-3 py-1.5 text-right text-text">
                {money(revenue)}
              </td>
            ) : null}
            <td className="h-11 whitespace-nowrap px-3 py-1.5 text-right text-text max-lg:hidden">
              {t("v2.detail.table.people", { count: number(couriers.length) })}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  // Desktop/planshet — buyurtmali tumanlarning hammasi; telefonda 5 ta + «Barcha {n} tuman» (buyurtmasizlar bilan).
  const districtRank = (phoneOnly: boolean) => (
    <div className={cx("flex min-w-0 flex-col", phoneOnly && "md:hidden")}>
      <RankList
        items={rankItems}
        ariaLabel={t("v2.detail.districts.rankAria")}
        showAvatar={false}
        limit={rankItems.length}
        mobileLimit={districtsExpanded ? rankItems.length : DISTRICT_PHONE_LIMIT}
      />
      {emptyRow}
      {districts.length > DISTRICT_PHONE_LIMIT ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-center md:hidden"
          aria-expanded={districtsExpanded}
          rightIcon={districtsExpanded ? ChevronUp : ChevronDown}
          onClick={() => {
            const next = !districtsExpanded;
            setDistrictsExpanded(next);
            setShowEmpty(next);
          }}
        >
          {districtsExpanded
            ? t("v2.common.showLess")
            : t("v2.detail.districts.showAll", { count: number(districts.length) })}
        </Button>
      ) : null}
    </div>
  );

  return (
    <Dialog
      open={open && region != null}
      onClose={onClose}
      title={name}
      description={t("v2.detail.subtitle", { period: periodLabel })}
      icon={MapPin}
      size="xl"
      className="md:max-w-[1080px]"
    >
      <div className="flex min-w-0 flex-col gap-6 max-md:gap-5">
        {/* KPI 4 */}
        {showFigures ? (
          <div
            role="group"
            aria-label={t("v2.detail.kpiAria")}
            className={cx(
              "grid gap-4 max-lg:grid-cols-2 max-md:gap-3",
              // Daromadsiz 3 ta KPI: planshet/telefonda oxirgisi to'liq en (bo'sh katak qolmasin).
              showRevenue ? "grid-cols-4" : "grid-cols-3 max-lg:[&>:last-child]:col-span-2",
            )}
          >
            <StatCard
              label={t("v2.kpi.total")}
              icon={ShoppingBag}
              loading={!hasFigures}
              value={number(total)}
              unit={unitTa}
              hint={t("v2.detail.pendingMeta", { count: number(pending) })}
            >
              {company && company.totalOrders > 0 ? (
                <KpiMeter
                  label={t("v2.detail.companyShare")}
                  shortLabel={t("v2.detail.companyShareShort")}
                  value={percent(shareOf(total, company.totalOrders))}
                >
                  <Meter value={shareOf(total, company.totalOrders)} thickness="thin" />
                </KpiMeter>
              ) : null}
            </StatCard>
            <StatCard
              label={t("v2.detail.success")}
              icon={GaugeIcon}
              loading={!hasFigures}
              value={percent(rate)}
              delta={rateDelta}
              deltaText={
                rateDelta != null
                  ? t("v2.common.pp", { value: ppText(rateDelta, language) })
                  : undefined
              }
              hint={rateDelta != null ? t("v2.detail.vsCompany") : undefined}
            >
              {companyRate != null ? (
                <KpiMeter
                  label={t("v2.detail.company")}
                  shortLabel={t("v2.detail.companyShort")}
                  value={percent(companyRate)}
                >
                  <Meter
                    value={rate}
                    tone={successZoneTone(rate)}
                    thickness="thin"
                    target={companyRate}
                  />
                </KpiMeter>
              ) : null}
            </StatCard>
            {showRevenue ? (
              <StatCard
                label={t("v2.kpi.revenue")}
                icon={Banknote}
                loading={!hasFigures}
                value={compact.value}
                unit={compact.unit}
                hint={money(revenue)}
              >
                {company && company.totalRevenue > 0 ? (
                  <KpiMeter
                    label={t("v2.detail.companyShare")}
                    shortLabel={t("v2.detail.companyShareShort")}
                    value={percent(shareOf(revenue, company.totalRevenue))}
                  >
                    <Meter value={shareOf(revenue, company.totalRevenue)} thickness="thin" />
                  </KpiMeter>
                ) : null}
              </StatCard>
            ) : null}
            <StatCard
              label={t("v2.detail.activeCouriers")}
              icon={Users}
              loading={!hasFigures}
              value={number(activeCouriers)}
              unit={unitTa}
              hint={
                primaryCount > 0
                  ? t("v2.detail.primaryMeta", { count: number(primaryCount) })
                  : undefined
              }
            >
              {detail && districtTotal > 0 ? (
                <KpiMeter
                  label={t("v2.detail.districtsWithOrders")}
                  shortLabel={t("v2.detail.districtsShort")}
                  value={t("v2.common.partOfTotalPlain", {
                    part: number(withOrders.length),
                    total: number(districtTotal),
                  })}
                >
                  <Meter value={withOrders.length} max={districtTotal} thickness="thin" />
                </KpiMeter>
              ) : null}
            </StatCard>
          </div>
        ) : null}

        {failed ? (
          <ErrorState
            error={query.error}
            title={t("v2.detail.error.title")}
            description={t("v2.detail.error.text")}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        ) : null}

        {/* Muvaffaqiyat · Buyurtmalar holati */}
        {hasFigures ? (
          <div className="grid grid-cols-2 gap-6 border-t border-border pt-5 max-md:grid-cols-1 max-md:gap-5">
            <section className="flex min-w-0 flex-col gap-4">
              <SectionHead
                title={t("v2.detail.gauge.title")}
                description={t("v2.detail.gauge.subtitle")}
                actions={
                  rateDelta != null ? (
                    <DeltaChip
                      value={rateDelta}
                      text={t("v2.common.pp", { value: ppText(rateDelta, language) })}
                    />
                  ) : undefined
                }
              />
              <Gauge
                value={rate}
                size="sm"
                label={t("v2.common.soldOfAccepted")}
                marker={
                  companyRate != null
                    ? { value: companyRate, label: t("v2.detail.company") }
                    : undefined
                }
                ariaLabel={t("v2.detail.gauge.aria", {
                  name,
                  rate: percent(rate),
                  company: companyRate != null ? percent(companyRate) : "—",
                  sold: number(sold),
                  cancelled: number(cancelled),
                })}
              />
              {companyRate != null ? (
                <ChartLegend
                  className="justify-center"
                  items={[
                    {
                      key: "company",
                      tone: "neutral",
                      shape: "dot",
                      keyClassName: "bg-text-subtle",
                      label: t("v2.detail.gauge.marker", { rate: percent(companyRate) }),
                    },
                  ]}
                />
              ) : null}
            </section>
            <section className="flex min-w-0 flex-col gap-4">
              <SectionHead
                title={t("v2.detail.status.title")}
                description={t("v2.detail.status.subtitle", {
                  period: periodLabel,
                  count: number(total),
                })}
              />
              <Donut
                segments={statusSegments}
                total={total}
                layout="side"
                centerLabel={t("v2.detail.status.center")}
                ariaLabel={t("v2.common.statusAria", {
                  total: number(total),
                  sold: number(sold),
                  pending: number(pending),
                  cancelled: number(cancelled),
                })}
                legendLabel={t("v2.common.statusListAria")}
              />
              <ChartNote>{t("v2.common.pendingNote")}</ChartNote>
            </section>
          </div>
        ) : showFigures ? (
          <SkeletonChart />
        ) : null}

        {/* Tumanlar · Viloyat kuryerlari (maket: ikki ustun; jadval rejimida tumanlar to'liq en) */}
        {!failed ? (
          <div className="grid gap-6 border-t border-border pt-5 lg:grid-cols-2 lg:gap-8">
            {/* Tumanlar */}
            <section
              className={cx("flex min-w-0 flex-col gap-4", view === "table" && "lg:col-span-2")}
            >
              <SectionHead
                title={t("v2.detail.districts.title")}
                count={detail ? districts.length : undefined}
                description={t("v2.detail.districts.subtitle")}
                actions={
                  detail && withOrders.length > 0 ? (
                    <ViewToggle
                      value={view}
                      onChange={setView}
                      ariaLabel={t("v2.detail.districts.viewAria")}
                      className="max-md:hidden"
                    />
                  ) : undefined
                }
              />
              {loading ? (
                <SkeletonList />
              ) : withOrders.length === 0 && withoutOrders.length === 0 ? (
                <p className="rounded-xl bg-sunken px-4 py-6 text-center text-sm text-text-muted">
                  {t("v2.common.noDistricts")}
                </p>
              ) : (
                <>
                  {withOrders.length > 0 ? (
                    <SummaryRow
                      items={[
                        {
                          key: "top",
                          label: t("v2.summary.topOrders"),
                          value: topDistrict?.name ?? "—",
                          meta: topDistrict
                            ? t("v2.detail.districts.topMeta", {
                                count: number(topDistrict.totalOrders),
                                share: percent(shareOf(topDistrict.totalOrders, total)),
                              })
                            : undefined,
                        },
                        {
                          key: "lowest",
                          label: t("v2.detail.districts.lowest"),
                          value: lowestDistrict?.district.name ?? "—",
                          meta: lowestDistrict
                            ? t("v2.common.rateMeta", {
                                rate: percent(lowestDistrict.rate),
                                part: number(lowestDistrict.district.deliveredOrders),
                                total: number(lowestDistrict.district.totalOrders),
                              })
                            : undefined,
                        },
                        {
                          key: "noCourier",
                          label: t("v2.detail.districts.noCourier"),
                          value: countTa(noCourier.length),
                          meta: noCourierMeta,
                        },
                      ]}
                    />
                  ) : null}
                  {view === "table" ? (
                    <>
                      <div className="flex min-w-0 flex-col max-md:hidden">
                        {districtTable}
                        {withoutOrders.length > 0 ? <div className="px-1">{emptyRow}</div> : null}
                      </div>
                      {districtRank(true)}
                    </>
                  ) : (
                    districtRank(false)
                  )}
                </>
              )}
            </section>
            {/* Viloyat kuryerlari */}
            <section
              className={cx(
                "flex min-w-0 flex-col gap-4",
                view === "table"
                  ? "border-t border-border pt-5"
                  : "max-lg:border-t max-lg:border-border max-lg:pt-5",
              )}
            >
              <SectionHead
                title={t("v2.detail.couriers.title")}
                count={detail ? couriers.length : undefined}
                description={t("v2.detail.couriers.subtitle")}
              />
              {loading ? (
                <SkeletonList />
              ) : courierItems.length === 0 ? (
                <p className="rounded-xl bg-sunken px-4 py-6 text-center text-sm text-text-muted">
                  {t("v2.detail.couriers.empty")}
                </p>
              ) : (
                <>
                  <RankList
                    items={courierItems}
                    ariaLabel={t("v2.detail.couriers.aria")}
                    limit={courierItems.length}
                  />
                  {smallSample ? <ChartNote>{t("v2.detail.couriers.lowData")}</ChartNote> : null}
                </>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
};

export default RegionDetailDialog;
