// dizayn-v2: logist-regions-detail
import { CircleX, Map as MapIcon, MapPin, PackageCheck, RefreshCw, TriangleAlert, Truck } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import {
  shareOf,
  successRateOf,
  useRegionDetailStats,
  useRegionStats,
} from "../../../entities/region";
import { cx } from "../../../shared/lib/cx";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { useQueryParams } from "../../../shared/lib/useQueryParams";
import { Gauge, SegBar, ViewToggle, type ChartView } from "../../../shared/ui/charts";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  SegmentedControl,
  Select,
  SkeletonChart,
  SkeletonList,
  TONE_SOFT,
} from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import {
  LOGIST_REGION_SEG_MAX,
  courierCounts,
  logistRegionOptions,
  resolveLogistRegion,
  toLogistCourierRows,
  type LogistRegionOption,
} from "../model/logistRegionModel";
import { SCOPED_LOWEST_MIN, toDistrictRows } from "../model/scopedModel";
import { LogistRegionCouriers } from "./LogistRegionCouriers";
import { SummaryRow } from "./regionBlocks";
import {
  DistrictRankPhone,
  DistrictTable,
  DistrictTiles,
  SelectedDistrictPanel,
} from "./ScopedDistricts";

export interface LogistRegionViewProps {
  dateParams: { startDate?: string; endDate?: string };
  periodLabel: string;
  /** Davr boshqaruvi (sarlavha o'ng tomonida). */
  controls: ReactNode;
}

/** Maket «Yuklashda xato»: kartada `.el-alert.el-tone-danger` + ostida chapda «Qayta urinish» (secondary). */
const LoadError = ({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) => {
  const { t } = useTranslation("region");
  return (
    <Card bodyClassName="flex min-h-[196px] flex-col justify-center gap-3">
      <div
        role="alert"
        className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.danger)}
      >
        <TriangleAlert size={20} aria-hidden="true" className="shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1 text-text">
          <div className="font-bold">{t("v2.logistView.states.error.title")}</div>
          <span className="text-[13px] leading-[18px] text-text-muted">
            {t("v2.logistView.states.error.text")}
          </span>
        </div>
      </div>
      <Button
        variant="secondary"
        leftIcon={RefreshCw}
        loading={retrying}
        onClick={onRetry}
        className="self-start"
      >
        {t("states.retry", { ns: "ui" })}
      </Button>
    </Card>
  );
};

const LoadingBody = () => {
  const { t } = useTranslation("region");
  return (
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
};

/** Viloyat tanlovi: desktopda seg (5 tagacha), telefonda (yoki ko'p viloyatda) `Select` «Samarqand · 86 ta». */
const RegionPicker = ({
  options,
  value,
  onChange,
}: {
  options: readonly LogistRegionOption[];
  value: string | null;
  onChange: (id: string) => void;
}) => {
  const { t, i18n } = useTranslation("region");
  const isPhone = useIsPhone();
  const count = (value: number) => formatNumberLocalized(value, { language: i18n.language });
  if (!isPhone && options.length <= LOGIST_REGION_SEG_MAX) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-text-muted">{t("v2.logistView.picker.label")}</span>
        <SegmentedControl
          ariaLabel={t("v2.logistView.picker.aria")}
          options={options.map((option) => ({ value: option.id, label: option.shortName }))}
          value={value ?? ""}
          onValueChange={onChange}
        />
      </div>
    );
  }
  return (
    <Field
      label={t("v2.logistView.picker.field")}
      labelAs="span"
      className={isPhone ? "w-full" : "w-[min(320px,100%)]"}
    >
      <Select
        options={options.map((option) => ({
          value: option.id,
          label: t("v2.logistView.picker.option", {
            name: option.shortName,
            count: count(option.orders),
          }),
        }))}
        value={value}
        onChange={(next) => {
          if (next) onChange(next);
        }}
        placeholder={t("v2.logistView.picker.placeholder")}
        listLabel={t("v2.logistView.picker.list")}
      />
    </Field>
  );
};

/**
 * LOGIST `/regions` (LG-3, maket `logist-regions-detail`; ega LG-S1, LG-S3): o'z viloyatlaridan biri — tumanlar va
 * kuryerlar kesimida, PULSIZ (tushum, daromad chizilmaydi).
 *
 * Ma'lumot: viloyatlar ro'yxati `GET region/stats/all` + klientda `logist_id === me` (backend iOnGbEqi gacha, LG-1
 * kabi); tanlangan viloyat — `GET region/stats/:id` (tumanlar — 0 buyurtmalilari ham — va kuryerlar shu javobda).
 * `GET /district` chaqirilmaydi (logistga 403). Viloyat va davr URL'da (`?region=`, `period`).
 *
 * Poyga (LG-2 saboqi): URL'dagi viloyat ro'yxatda bo'lmasa, ro'yxat shu ko'rinish ochilgandan keyin yangidan
 * olinmaguncha («Bu viloyat endi sizga biriktirilmagan» deyilmaydi, URL va tanlov ustidan yozilmaydi; eskirgan
 * keshda bir marta qayta so'raladi). Tanlov faqat foydalanuvchi bosganda URL'ga yoziladi.
 *
 * Chizilmaganlar: «Tuman buyurtmalari» (logist buyurtmalari — LG-4), «Barcha kuryerlar» (`/couriers` — LG-5).
 * «Faol kuryerlar» — `status = 'active'` (LG-1 qarori; maketdagi «bugun buyurtmasi bor» soni API'da yo'q).
 */
const LogistRegionView = ({ dateParams, periodLabel, controls }: LogistRegionViewProps) => {
  const { t, i18n } = useTranslation("region");
  const language = i18n.language;
  const unitTa = t("v2.common.ta") || undefined;
  const { getParam, setParam } = useQueryParams();
  const requestedId = getParam("region");

  const userId = useSelector((state: RootState) => state.user.user?.id);
  const roleId = useSelector((state: RootState) => state.role.id);
  const me = userId ?? roleId;
  const meKnown = me != null && String(me) !== "";

  const listQuery = useRegionStats(dateParams, meKnown);
  const [mountedAt] = useState(() => Date.now());
  const regions = listQuery.data?.regions;
  const options = useMemo(
    () => (regions ? logistRegionOptions(regions, me) : null),
    [regions, me],
  );
  // Davr almashganda ro'yxat qayta yuklanadi — tanlov qatori yo'qolib-chiqmasin (faqat ko'rinish uchun).
  // (React: oldingi qiymatni render paytida moslash — effektsiz.)
  const [shownOptions, setShownOptions] = useState<LogistRegionOption[] | null>(options);
  if (options && options !== shownOptions) setShownOptions(options);

  const fresh =
    Boolean(listQuery.data) && !listQuery.isFetching && listQuery.dataUpdatedAt >= mountedAt;
  const resolution = resolveLogistRegion({
    options: meKnown ? options : null,
    requestedId,
    fresh,
  });

  // Keshdagi ro'yxat ochilishdan oldin olingan va URL'dagi viloyat unda yo'q (yoki ro'yxat bo'sh) — rad etishdan
  // oldin bir marta yangidan so'raladi (yangi biriktirilgan viloyat eskirgan keshda bo'lmasligi mumkin).
  const refetchedRef = useRef(false);
  const { data: listData, isFetching: listFetching, dataUpdatedAt, refetch: refetchList } = listQuery;
  useEffect(() => {
    if (resolution.kind !== "pending" || !listData || listFetching) return;
    if (dataUpdatedAt >= mountedAt || refetchedRef.current) return;
    refetchedRef.current = true;
    void refetchList();
  }, [resolution.kind, listData, listFetching, dataUpdatedAt, mountedAt, refetchList]);

  const selected = resolution.kind === "region" ? resolution.option : null;
  const detailQuery = useRegionDetailStats(selected?.id ?? "", dateParams, Boolean(selected));
  const detailForbidden = detailQuery.isError && getErrorStatus(detailQuery.error) === 403;

  const [view, setView] = useState<ChartView>("chart");
  const [district, setDistrict] = useState<{ regionId: string; id: string } | null>(null);

  const detail = detailQuery.data ?? null;
  const rows = useMemo(() => toDistrictRows(detail?.districts ?? []), [detail?.districts]);
  const couriers = useMemo(
    () => toLogistCourierRows(detail?.couriers, detail?.districts ?? []),
    [detail?.couriers, detail?.districts],
  );
  const counts = useMemo(() => courierCounts(detail?.couriers), [detail?.couriers]);

  const number = (value: number) => formatNumberLocalized(value, { language });
  const percent = (value: number, fractionDigits?: number) =>
    formatPercentLocalized(value, { language, fractionDigits });
  const countTa = (value: number) => t("v2.common.countTa", { count: number(value) });

  const regionName = selected?.name ?? "";
  const header = (
    <PageHeader
      title={regionName || t("v2.logistView.titleGeneric")}
      description={t("v2.logistView.subtitle")}
      actions={controls}
    />
  );

  const pickerOptions = options ?? shownOptions;
  const picker =
    pickerOptions && pickerOptions.length > 0 && resolution.kind !== "none" ? (
      <RegionPicker
        options={pickerOptions}
        value={selected?.id ?? null}
        onChange={(id) => {
          if (id !== selected?.id) setParam("region", id);
        }}
      />
    ) : null;

  const page = (body: ReactNode) => (
    <div className="flex flex-col gap-6 max-md:gap-4">
      {header}
      {picker}
      {body}
    </div>
  );

  // — Holatlar —
  if (resolution.kind === "pending") {
    if (listQuery.isPaused && !listQuery.data) {
      return page(
        <Card>
          <ErrorState
            kind="offline"
            onRetry={() => void listQuery.refetch()}
            retrying={listQuery.isFetching}
          />
        </Card>,
      );
    }
    if (listQuery.isError && !listQuery.isFetching) {
      return page(<LoadError onRetry={() => void listQuery.refetch()} retrying={false} />);
    }
    return page(<LoadingBody />);
  }

  if (resolution.kind === "none") {
    return page(
      <Card>
        <EmptyState
          icon={MapIcon}
          title={t("v2.logistView.states.none.title")}
          description={t("v2.logistView.states.none.text")}
        />
      </Card>,
    );
  }

  if (resolution.kind === "notAssigned" || detailForbidden) {
    return page(
      <Card>
        <EmptyState
          icon={MapIcon}
          title={t("v2.logistView.states.notAssigned.title")}
          description={t("v2.logistView.states.notAssigned.text")}
        />
      </Card>,
    );
  }

  if (!detail && detailQuery.isError) {
    return page(
      <LoadError onRetry={() => void detailQuery.refetch()} retrying={detailQuery.isFetching} />,
    );
  }
  if (!detail) return page(<LoadingBody />);

  const total = detail.summary.totalOrders;
  const sold = detail.summary.totalDelivered;
  const cancelled = detail.summary.totalCancelled;
  const pending = Math.max(0, detail.summary.pendingOrders ?? total - sold - cancelled);
  const rate = successRateOf(sold, total);
  const withOrders = rows.filter((row) => row.orders > 0);
  const mostActive = withOrders[0];
  const lowest = withOrders
    .filter((row) => row.orders >= SCOPED_LOWEST_MIN)
    .sort((a, b) => a.rate - b.rate || b.orders - a.orders)[0];
  const selectedDistrictId = district?.regionId === selected?.id ? district?.id : null;
  const current =
    rows.find((row) => row.id === selectedDistrictId) ?? withOrders[0] ?? rows[0] ?? null;
  const selectDistrict = (id: string) => setDistrict({ regionId: selected?.id ?? "", id });
  const cardSub = t("v2.logistView.cardSubtitle", { period: periodLabel, region: regionName });

  const kpi = (label: string, value: ReactNode, unit: ReactNode, meta: ReactNode, className?: string) => (
    <div className={cx("flex min-w-0 flex-col gap-0.5", className)}>
      <dt className="text-[13px] font-semibold text-text-muted">{label}</dt>
      <dd className="m-0 flex flex-col">
        <span className="text-[28px] leading-9 font-bold whitespace-nowrap text-text max-md:text-[22px] max-md:leading-[30px]">
          {value}
          {unit ? <span className="ml-1 text-sm font-semibold text-text-muted">{unit}</span> : null}
        </span>
        <span className="text-xs whitespace-nowrap text-text-muted">{meta}</span>
      </dd>
    </div>
  );

  return page(
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
              {
                key: "sold",
                value: countTa(sold),
                label: t("v2.status.sold"),
                tone: "success",
                icon: PackageCheck,
              },
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
            {kpi(
              t("v2.kpi.total"),
              number(total),
              unitTa,
              t("v2.scoped.overview.totalMeta", {
                total: number(rows.length),
                active: number(withOrders.length),
              }),
            )}
            {kpi(
              t("v2.status.pending"),
              number(pending),
              unitTa,
              t("v2.scoped.overview.pendingMeta", { share: percent(shareOf(pending, total)) }),
            )}
            {kpi(
              t("v2.logistView.overview.couriers"),
              counts ? number(counts.active) : "—",
              counts ? t("v2.logistView.overview.couriersUnit", { total: number(counts.total) }) : null,
              t("v2.logistView.overview.couriersMeta"),
              "max-md:hidden",
            )}
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
              {
                key: "cancelled",
                label: t("v2.status.cancelled"),
                value: cancelled,
                tone: "danger",
                icon: CircleX,
              },
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
          <DistrictTable rows={rows} showRevenue={false} />
        ) : (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-6 max-lg:grid-cols-1 max-md:hidden">
              <DistrictTiles rows={rows} selectedId={current?.id ?? null} onSelect={selectDistrict} />
              {current ? (
                <SelectedDistrictPanel row={current} regionRate={rate} metric="couriers" />
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col gap-4 md:hidden">
              {current ? (
                <SelectedDistrictPanel row={current} regionRate={rate} metric="couriers" />
              ) : null}
              <DistrictRankPhone
                rows={rows}
                selectedId={current?.id ?? null}
                onSelect={selectDistrict}
              />
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
          <DistrictTable rows={rows} onSelect={selectDistrict} showRevenue={false} />
        </Card>
      ) : null}

      <LogistRegionCouriers key={selected?.id} rows={couriers} counts={counts} />
    </>,
  );
};

export default LogistRegionView;
