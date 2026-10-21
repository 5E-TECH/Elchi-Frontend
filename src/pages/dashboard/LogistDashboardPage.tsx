// dizayn-v2: logist-dashboard-main
import { CircleX, Map as MapIcon, PackageCheck, ShoppingBag, Truck } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../app/config/store";
import { periodLabel, resolveDashboardPeriod, share } from "../../entities/dashboard/lib/period";
import { useRegionStats } from "../../entities/region";
import { formatNumberLocalized, formatPercentLocalized } from "../../shared/lib/formatMoney";
import { removeFilterValue, setMultipleFilters } from "../../shared/model/filterSlice";
import { LegendKey, Meter, SegBar } from "../../shared/ui/charts";
import { Card, EmptyState, ErrorState, StatCard } from "../../shared/ui/primitives";
import DashboardHeader from "../../widgets/dashboard-statistics/ui/DashboardHeader";
import { KpiRow, LoadingChartCard } from "../../widgets/dashboard-statistics/ui/DashboardGrid";
import SuccessRateCard from "../../widgets/dashboard-statistics/ui/SuccessRateCard";
import { buildLogistDashboard, regionStatsParams } from "./model/logistDashboard";
import { LogistRegionSuccessCard } from "./ui/LogistRegionSuccessCard";
import { LogistRegionsTable } from "./ui/LogistRegionsTable";

/** KPI pastidagi «Jamidan ulushi · 69,6%» + ingichka o'lchagich (maket `.el-kpi` pastki qismi). */
const ShareMeter = ({
  label,
  percent,
  tone,
  ariaLabel,
  value,
  max,
}: {
  label: string;
  percent: string;
  tone?: "success" | "danger";
  ariaLabel: string;
  value: number;
  max?: number;
}) => (
  <span className="flex min-w-0 flex-col gap-2">
    <span className="flex justify-between gap-2 text-xs">
      <span className="min-w-0 truncate text-text-muted">{label}</span>
      <span className="whitespace-nowrap font-semibold text-text">{percent}</span>
    </span>
    <Meter value={value} max={max} tone={tone} thickness="thin" ariaLabel={ariaLabel} />
  </span>
);

/**
 * BOSH SAHIFA — logist (LG-1, maketlar `logist-dashboard-main`, `logist-dashboard-mobile-menu`; ega LG-S1..S3).
 *
 * Faqat logistga biriktirilgan viloyatlar (`GET region/stats/all` + klientda `logist_id === me`), pulsiz — tushum,
 * daromad, kassa yo'q (ega LG-S1). Davr: Bugun · Bu hafta · Bu oy · Barchasi + sana oralig'i (yilsiz — maket).
 * KPI (Jami, Sotilgan, Bekor, Faol kuryerlar a/b), «Muvaffaqiyat darajasi» (umumiy `SuccessRateCard`),
 * «Viloyatlar muvaffaqiyati», «Viloyatlarim» jadvali (telefonda kartalar); holatlar — yuklanish, xato
 * («Qayta urinish»), viloyat biriktirilmagan.
 *
 * Chizilmaganlar: «So'nggi buyurtmalar» (logist buyurtmalari — backend 4BftLLnc, LG-4), viloyat «Tafsilot»
 * havolasi (`/regions` logist ko'rinishi — LG-3). «Faol kuryerlar» — backend `status = 'active'` (maketdagi «bugun
 * buyurtmasi bor» emas — bunday son API'da yo'q; ega savoli).
 */
const LogistDashboardPage = () => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const dispatch = useDispatch();

  const storedFromDate = useSelector((state: RootState) => state.filter.dashboardFromDate);
  const storedToDate = useSelector((state: RootState) => state.filter.dashboardToDate);
  const userId = useSelector((state: RootState) => state.user.user?.id);
  const roleId = useSelector((state: RootState) => state.role.id);
  const me = userId ?? roleId;

  const [fromDate, setFromDate] = useState(typeof storedFromDate === "string" ? storedFromDate : "");
  const [toDate, setToDate] = useState(typeof storedToDate === "string" ? storedToDate : "");
  const period = resolveDashboardPeriod(fromDate, toDate);
  const periodText = periodLabel(t, period);
  const params = useMemo(() => regionStatsParams(resolveDashboardPeriod(fromDate, toDate)), [fromDate, toDate]);

  const { data, isLoading, isError, isFetching, refetch } = useRegionStats(params);
  const model = useMemo(() => buildLogistDashboard(data?.regions ?? [], me), [data?.regions, me]);
  const { summary } = model;
  // Foydalanuvchi id'si hali ma'lum bo'lmasa (profil yuklanmoqda) — «viloyat biriktirilmagan» emas, yuklanish.
  const meKnown = me != null && String(me) !== "";
  const loading = isLoading || !meKnown;

  const applyRange = useCallback(
    (range: { from: string; to: string }) => {
      setFromDate(range.from);
      setToDate(range.to);
      dispatch(setMultipleFilters({ dashboardFromDate: range.from, dashboardToDate: range.to }));
    },
    [dispatch],
  );
  const clearRange = useCallback(() => {
    setFromDate("");
    setToDate("");
    dispatch(removeFilterValue("dashboardFromDate"));
    dispatch(removeFilterValue("dashboardToDate"));
  }, [dispatch]);

  const count = (value: number) => formatNumberLocalized(value, { language });
  const percent = (value: number) => formatPercentLocalized(value, { language });
  const unassigned = !loading && !isError && summary.regionCount === 0;
  const description =
    !loading && !isError && summary.regionCount > 0
      ? t("v2Logist.headerSub", {
          count: summary.regionCount,
          names: model.rows.map((row) => row.name).join(", "),
        })
      : t("v2Logist.headerSubGeneric");

  const header = (
    <DashboardHeader
      description={description}
      fromDate={fromDate}
      toDate={toDate}
      onChange={applyRange}
      onClear={clearRange}
      showYear={false}
    />
  );

  if (isError) {
    return (
      <div className="flex flex-col gap-6 max-md:gap-4">
        {header}
        <Card>
          <ErrorState
            title={t("v2Logist.error.title")}
            description={t("v2Logist.error.description")}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        </Card>
      </div>
    );
  }

  if (unassigned) {
    return (
      <div className="flex flex-col gap-6 max-md:gap-4">
        {header}
        <Card>
          <EmptyState
            icon={MapIcon}
            title={t("v2Logist.empty.title")}
            description={t("v2Logist.empty.description")}
          />
        </Card>
      </div>
    );
  }

  const couriersKnown = summary.activeCouriers != null && summary.totalCouriers != null;
  const activeCouriers = summary.activeCouriers ?? 0;
  const totalCouriers = summary.totalCouriers ?? 0;

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      {header}

      <KpiRow count={4} label={t("v2Logist.kpi.label")}>
        <StatCard
          label={t("cards.total_orders")}
          icon={ShoppingBag}
          loading={loading}
          value={count(summary.total)}
          unit={t("unit.orders")}
          hint={
            loading
              ? undefined
              : t("v2Logist.kpi.totalHint", { pending: count(summary.pending), regions: count(summary.regionCount) })
          }
        >
          <span className="flex min-w-0 flex-col gap-2">
            <SegBar
              showLegend={false}
              ariaLabel={t("v2Logist.kpi.totalAria", {
                total: count(summary.total),
                sold: count(summary.delivered),
                pending: count(summary.pending),
                cancelled: count(summary.cancelled),
              })}
              segments={[
                { key: "sold", label: t("v2Logist.legend.sold"), value: summary.delivered, tone: "success" },
                { key: "pending", label: t("v2Logist.legend.pending"), value: summary.pending, tone: "warning" },
                { key: "cancelled", label: t("v2Logist.legend.cancelled"), value: summary.cancelled, tone: "danger" },
              ]}
            />
            <ul className="m-0 flex list-none flex-wrap items-center gap-x-3.5 gap-y-1.5 p-0 text-xs text-text-muted">
              {(
                [
                  ["sold", "success", t("v2Logist.legend.sold")],
                  ["pending", "warning", t("v2Logist.legend.pending")],
                  ["cancelled", "danger", t("v2Logist.legend.cancelledShort")],
                ] as const
              ).map(([key, tone, label]) => (
                <li key={key} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <LegendKey tone={tone} />
                  {label}
                </li>
              ))}
            </ul>
          </span>
        </StatCard>
        <StatCard
          label={t("cards.sold")}
          icon={PackageCheck}
          loading={loading}
          value={count(summary.delivered)}
          unit={t("unit.orders")}
          hint={t("v2Logist.kpi.soldHint")}
        >
          <ShareMeter
            label={t("v2Logist.kpi.share")}
            percent={percent(share(summary.delivered, summary.total))}
            value={share(summary.delivered, summary.total)}
            tone="success"
            ariaLabel={t("v2Logist.kpi.soldShareAria")}
          />
        </StatCard>
        <StatCard
          label={t("cards.cancelled")}
          icon={CircleX}
          loading={loading}
          value={count(summary.cancelled)}
          unit={t("unit.orders")}
          hint={t("v2Logist.kpi.cancelledHint")}
        >
          <ShareMeter
            label={t("v2Logist.kpi.share")}
            percent={percent(share(summary.cancelled, summary.total))}
            value={share(summary.cancelled, summary.total)}
            tone="danger"
            ariaLabel={t("v2Logist.kpi.cancelledShareAria")}
          />
        </StatCard>
        <StatCard
          label={t("v2Logist.kpi.couriers")}
          icon={Truck}
          loading={loading}
          value={couriersKnown ? count(activeCouriers) : "—"}
          unit={couriersKnown ? t("v2Logist.kpi.couriersUnit", { total: count(totalCouriers) }) : undefined}
          hint={t("v2Logist.kpi.couriersHint")}
        >
          {couriersKnown ? (
            <ShareMeter
              label={t("v2Logist.kpi.activity")}
              percent={percent(share(activeCouriers, totalCouriers))}
              value={activeCouriers}
              max={totalCouriers > 0 ? totalCouriers : 1}
              ariaLabel={t("v2Logist.kpi.couriersAria", {
                active: count(activeCouriers),
                total: count(totalCouriers),
              })}
            />
          ) : null}
        </StatCard>
      </KpiRow>

      <div className="flex flex-wrap gap-4 max-md:gap-3">
        {loading ? (
          <>
            <div className="flex min-w-0 flex-[1_1_340px] flex-col [&>*]:flex-1">
              <LoadingChartCard title={t("v2Dashboard.success.title")} />
            </div>
            <div className="flex min-w-0 flex-[2_1_480px] flex-col [&>*]:flex-1">
              <LoadingChartCard title={t("v2Logist.regions.title")} />
            </div>
          </>
        ) : (
          <>
            <SuccessRateCard
              className="min-w-0 flex-[1_1_340px]"
              rate={summary.rate}
              sold={summary.delivered}
              cancelled={summary.cancelled}
              description={t("v2Logist.success.sub", { period: periodText, count: summary.regionCount })}
              gaugeLabel={t("v2Dashboard.success.gaugeAccepted")}
              showThreshold={false}
            />
            <LogistRegionSuccessCard model={model} className="min-w-0 flex-[2_1_480px]" />
          </>
        )}
      </div>

      {loading ? (
        <LoadingChartCard title={t("v2Logist.table.title")} />
      ) : (
        <LogistRegionsTable model={model} periodText={periodText} />
      )}
    </div>
  );
};

export default memo(LogistDashboardPage);
