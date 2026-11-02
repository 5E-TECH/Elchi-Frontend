// dizayn-v2: (maket yo'q) superadmin-ops-system
import { memo, useEffect, useRef, type ReactNode } from "react";
import { Banknote, CircleCheck, CircleMinus, CircleX, Clock, Info, RefreshCw, Trophy, Truck, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMiscCoverage } from "../../../entities/coverage/miscCoverage";
import { cx } from "../../../shared/lib/cx";
import { formatMoneyLocalized, formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { Badge, Button, Card, QueryBoundary, Skeleton, TONE_SOFT } from "../../../shared/ui/primitives";
import { OpsAlert } from "../../ops/ui/OpsToolPage";
import { ratingName, readAnalyticsKpi, splitHours } from "../lib/analyticsKpi";
import { KpiRing, SlaGauge } from "./AnalyticsKpiCharts";

/**
 * «O'Z VAQTIDA (SLA)» VA «ANALITIKA KPI» — superadmin bosh sahifasi (`GET analytics/kpi`, F2NzXpMv). Ilgari
 * Ops → «Tizim» tabida edi; ko'rsatkichlar kundalik boshqaruvniki, texnik vosita emas. Bosh sahifa maketlarida yo'q,
 * kartalar `superadmin-ops-system` dagi ko'rinishda. Javob bo'sh bo'lsa blok chizilmaydi.
 * «Kuryer samaradorligi» — foiz halqasi emas, «O'rtacha N ta buyurtma» (API — kuryerga o'rtacha buyurtma soni, spec §8 D3).
 */

/** «O'rtacha yetkazish vaqti» o'lchagichi: shkala 30 soat, belgi — 24 soatlik chegara. */
const FULFILLMENT_SCALE_HOURS = 30;
const FULFILLMENT_LIMIT_HOURS = 24;

const StatIcon = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex size-[72px] flex-none items-center justify-center rounded-full bg-sunken text-text-muted">
    {children}
  </span>
);

const KpiItem = ({ visual, label, value, hint, extra }: { visual: ReactNode; label: string; value: string; hint: string; extra?: ReactNode }) => (
  <li className="flex min-w-0 items-center gap-3.5">
    {visual}
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-[13px] text-text-muted">{label}</span>
      <span className="text-xl leading-7 font-bold text-text wrap-break-word">{value}</span>
      {extra}
      <span className="text-xs text-text-muted">{hint}</span>
    </div>
  </li>
);

/** KPI yuklanishi (maket `superadmin-ops-system-loading`): ikki karta sarlavhasi bilan, ichida skelet. */
const KpiSkeleton = ({
  slaTitle,
  slaSubtitle,
  kpiTitle,
  kpiSubtitle,
}: {
  slaTitle: string;
  slaSubtitle: string;
  kpiTitle: string;
  kpiSubtitle: string;
}) => (
  <div className="flex flex-wrap gap-6 max-md:gap-4">
    <Card
      divided={false}
      title={slaTitle}
      description={slaSubtitle}
      aria-busy="true"
      className="min-w-0 flex-[1_1_352px]"
      bodyClassName="flex flex-col items-center gap-3 pt-2 pb-1"
    >
      <Skeleton shape="block" tone="border" width="min(312px, 100%)" height={156} style={{ borderRadius: "156px 156px 0 0" }} />
      <Skeleton tone="border" width={96} height={28} />
      <Skeleton tone="border" width={180} height={12} />
    </Card>
    <Card
      divided={false}
      title={kpiTitle}
      description={kpiSubtitle}
      aria-busy="true"
      className="min-w-0 flex-[2_1_348px]"
    >
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-x-6 gap-y-7 p-0">
        {[0, 1, 2, 3].map((item) => (
          <li key={item} className="flex min-w-0 items-center gap-3.5">
            <Skeleton shape="circle" tone="border" width={72} height={72} />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton tone="border" width="70%" height={12} />
              <Skeleton tone="border" width="55%" height={20} />
              <Skeleton tone="border" width="45%" height={12} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  </div>
);

const AnalyticsKpiSection = () => {
  const { t, i18n } = useTranslation("ops");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { useGetAnalyticsKpi } = useMiscCoverage();
  const kpiQuery = useGetAnalyticsKpi(undefined, { silentError: true });
  const kpi = readAnalyticsKpi(kpiQuery.data);

  // KPI xatosidan «Qayta urinish» bilan tiklansa — fokus «Analitika KPI» kartasiga (tugma yo'qolib, fokus `<body>` ga tushmasin).
  const kpiCardRef = useRef<HTMLElement>(null);
  const kpiFocusOnRecovery = useRef(false);
  const hasKpi = kpi !== null;
  useEffect(() => {
    if (!hasKpi || !kpiFocusOnRecovery.current) return;
    kpiFocusOnRecovery.current = false;
    const active = document.activeElement;
    if (!active || active === document.body) kpiCardRef.current?.focus();
  }, [hasKpi]);

  const percent = (value: number) => formatPercentLocalized(value, { language });

  if (kpiQuery.isSuccess && kpi === null) return null;

  return (
    <QueryBoundary
      query={kpiQuery}
      isEmpty={() => kpi === null}
      loadingLabel={t("system.kpi.loadingLabel")}
      loading={<KpiSkeleton slaTitle={t("system.sla.title")} slaSubtitle={t("system.sla.subtitle")} kpiTitle={t("system.kpi.title")} kpiSubtitle={t("system.kpi.subtitle")} />}
      error={(_error, retry) => (
        <Card title={t("system.kpi.title")}>
          <div
            role="alert"
            className={cx("flex min-w-0 flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.danger)}
          >
            <CircleX size={18} aria-hidden="true" className="shrink-0" />
            <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5 text-text">
              <div className="font-bold">{t("system.kpi.loadError")}</div>
              <div className="text-[13px] leading-[18px] text-text-muted">{t("system.kpi.loadErrorText")}</div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={RefreshCw}
              onClick={() => {
                kpiFocusOnRecovery.current = true;
                retry();
              }}
              loading={kpiQuery.isFetching}
            >
              {t("common.retry")}
            </Button>
          </div>
        </Card>
      )}
    >
      {() =>
        kpi ? (
          <div className="flex flex-col gap-4">
            {kpi.degraded ? (
              <OpsAlert tone="warning" title={t("system.kpi.degradedTitle")}>
                {t("system.kpi.degradedText")}
              </OpsAlert>
            ) : null}
            <div className="flex flex-wrap gap-6 max-md:gap-4">
              <Card
                divided={false}
                title={t("system.sla.title")}
                description={t("system.sla.subtitle")}
                className="min-w-0 flex-[1_1_352px]"
                bodyClassName="flex flex-col items-center gap-4"
              >
                <SlaGauge
                  value={kpi.deliveryCount === 0 ? 0 : kpi.onTimeRate}
                  valueText={kpi.deliveryCount === 0 ? "—" : percent(kpi.onTimeRate)}
                  label={t("system.sla.label")}
                  ariaLabel={
                    kpi.deliveryCount === 0
                      ? t("system.sla.ariaUnmeasured")
                      : t("system.sla.aria", { value: percent(kpi.onTimeRate) })
                  }
                  badge={
                    // yrLt5oMi: yetkazish yo'q — «Past» emas, neytral «O'lchanmagan».
                    kpi.deliveryCount === 0 ? (
                      <Badge tone="neutral" icon={CircleMinus}>
                        {t("system.sla.unmeasured")}
                      </Badge>
                    ) : kpi.onTimeRate >= 70 ? (
                      <Badge tone="success" icon={CircleCheck}>
                        {t("system.sla.good")}
                      </Badge>
                    ) : (
                      <Badge tone="warning" icon={TriangleAlert}>
                        {t("system.sla.low")}
                      </Badge>
                    )
                  }
                />
                <p className="flex items-start gap-1.5 self-start text-xs text-text-muted">
                  <Info size={16} aria-hidden="true" className="shrink-0" />
                  {t("system.sla.note")}
                </p>
              </Card>

              <Card
                ref={kpiCardRef}
                tabIndex={-1}
                divided={false}
                title={t("system.kpi.title")}
                description={t("system.kpi.subtitle")}
                className="min-w-0 flex-[2_1_348px]"
                bodyClassName="flex flex-1 flex-col gap-6"
              >
                <ul className="m-0 grid flex-1 list-none grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] content-evenly gap-x-6 gap-y-7 p-0">
                  <KpiItem
                    visual={
                      <StatIcon>
                        <Truck size={24} aria-hidden="true" />
                      </StatIcon>
                    }
                    label={t("system.kpi.courier")}
                    value={t("system.kpi.courierValue", {
                      count: formatNumberLocalized(kpi.courierEfficiency, { language, fractionDigits: 1 }),
                    })}
                    hint={t("system.kpi.courierHint")}
                  />
                  <KpiItem
                    visual={
                      <KpiRing
                        value={kpi.cancellationRate}
                        valueText={percent(kpi.cancellationRate)}
                        ariaLabel={t("system.kpi.cancellationAria", { value: percent(kpi.cancellationRate) })}
                      />
                    }
                    label={t("system.kpi.cancellation")}
                    value={percent(kpi.cancellationRate)}
                    hint={t("system.kpi.cancellationHint")}
                  />
                  <KpiItem
                    visual={
                      <StatIcon>
                        <Banknote size={24} aria-hidden="true" />
                      </StatIcon>
                    }
                    label={t("system.kpi.aov")}
                    value={formatMoneyLocalized(kpi.averageOrderValue, { language })}
                    hint={t("system.kpi.aovHint")}
                  />
                  {(() => {
                    const { hours, minutes } = splitHours(kpi.averageFulfillmentHours);
                    const fill = Math.min(kpi.averageFulfillmentHours / FULFILLMENT_SCALE_HOURS, 1) * 100;
                    return (
                      <KpiItem
                        visual={
                          <StatIcon>
                            <Clock size={24} aria-hidden="true" />
                          </StatIcon>
                        }
                        label={t("system.kpi.fulfillment")}
                        value={t("system.kpi.fulfillmentValue", { hours, minutes })}
                        hint={t("system.kpi.fulfillmentHint")}
                        extra={
                          <div className="my-1">
                            <div
                              role="meter"
                              aria-label={t("system.kpi.fulfillmentAria", { hours, minutes })}
                              aria-valuemin={0}
                              aria-valuemax={FULFILLMENT_SCALE_HOURS}
                              aria-valuenow={Math.round(kpi.averageFulfillmentHours * 10) / 10}
                              className="relative h-1.5 rounded-full bg-action-soft"
                            >
                              <span className="block h-full rounded-full bg-chart-1" style={{ width: `${fill}%` }} />
                              <span
                                aria-hidden="true"
                                className="absolute -inset-y-1 w-0.5 bg-text"
                                style={{ left: `${(FULFILLMENT_LIMIT_HOURS / FULFILLMENT_SCALE_HOURS) * 100}%` }}
                              />
                            </div>
                          </div>
                        }
                      />
                    );
                  })()}
                </ul>
                <div className="flex items-center gap-3.5 rounded-xl bg-sunken px-4 py-3">
                  <Trophy size={20} aria-hidden="true" className="flex-none text-text-subtle" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[13px] font-semibold text-text">{t("system.kpi.rating")}</span>
                    <span className="text-xs text-text-muted">
                      {kpi.marketRating.length === 0
                        ? t("system.kpi.ratingEmpty")
                        : kpi.marketRating
                            .slice(0, 3)
                            .map((row, index) => `${index + 1}. ${ratingName(row) || "—"}`)
                            .join(" · ")}
                    </span>
                  </div>
                  <span aria-hidden="true" className="text-text-subtle">
                    {kpi.marketRating.length === 0
                      ? "—"
                      : t("common.count", { count: kpi.marketRating.length })}
                  </span>
                </div>
              </Card>
            </div>
          </div>
        ) : null
      }
    </QueryBoundary>
  );
};

export default memo(AnalyticsKpiSection);
