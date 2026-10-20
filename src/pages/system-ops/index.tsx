// dizayn-v2: superadmin-ops-system, superadmin-ops-system-loading, superadmin-ops-system-error, superadmin-ops-system-partial, superadmin-ops-system-down, superadmin-ops-system-critical
import { memo, useState, type FormEvent, type ReactNode } from "react";
import { Banknote, CircleCheck, CircleX, Clock, Info, RefreshCw, Search, Trophy, Truck, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BATCH_STATUS_TONE } from "../../entities/batch";
import { useMiscCoverage } from "../../entities/coverage/miscCoverage";
import { OrderStatusBadge } from "../../entities/order";
import { getBackendErrorMessage } from "../../shared/lib/backendError";
import { getErrorStatus } from "../../shared/lib/errorKind";
import { formatDateTimeLocalized } from "../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized, formatPercentLocalized } from "../../shared/lib/formatMoney";
import { formatPhone } from "../../shared/lib/formatPhone";
import { cx } from "../../shared/lib/cx";
import {
  Badge,
  Button,
  Card,
  Field,
  QueryBoundary,
  Skeleton,
  StatusBadge,
  TextInput,
  TONE_SOFT,
} from "../../shared/ui/primitives";
import { OpsAlert, OpsIntro, OpsToolPage } from "../ops/ui/OpsToolPage";
import {
  ratingName,
  readAnalyticsKpi,
  readScanResult,
  splitHours,
  toBatchStatusKey,
  type ScanResult,
} from "./lib/systemOps";
import { KpiRing, SlaGauge } from "./ui/charts";
import { HealthCard } from "./ui/HealthCard";

/**
 * OPS → «Tizim» (maket `superadmin-ops-system` va holatlari): kirish kartasi → «Tizim holati» (`GET /health/readiness`,
 * `ui/HealthCard.tsx`) → [«AI holati» — OS-2] → «O'z vaqtida (SLA)» (`onTimeRate`) + «Analitika KPI»
 * (`GET analytics/kpi`) → «Token orqali tekshirish» (`GET scan/:token`).
 * Hozirgi `JSON.stringify` o'rniga natija maydonlar ro'yxati (`dl`). «Kuryer samaradorligi» — foiz halqasi emas,
 * «O'rtacha N ta buyurtma» (API — kuryerga o'rtacha buyurtma soni, spec §8 D3).
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

const SystemOpsPage = ({ embedded = false }: { embedded?: boolean }) => {
  const { t, i18n } = useTranslation(["ops", "newOrders"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { useGetAnalyticsKpi, useGetScanByToken } = useMiscCoverage();

  const [scanInput, setScanInput] = useState("");
  const [activeToken, setActiveToken] = useState("");

  // Ikkala so'rov ham shartsiz (React hook qoidasi), skan — faqat token bo'lsa. Tizim holati — `HealthCard` ichida.
  const kpiQuery = useGetAnalyticsKpi(undefined, { silentError: true });
  const scanQuery = useGetScanByToken(activeToken, !!activeToken, { silentError: true });

  const kpi = readAnalyticsKpi(kpiQuery.data);
  const scan = readScanResult(scanQuery.data);

  const percent = (value: number) => formatPercentLocalized(value, { language });

  const submitScan = (event: FormEvent) => {
    event.preventDefault();
    const token = scanInput.trim();
    if (!token) return;
    if (token === activeToken) void scanQuery.refetch();
    else setActiveToken(token);
  };

  const scanStatus = (result: ScanResult, value: string) => {
    if (result.type === "order") return <OrderStatusBadge status={value} />;
    if (result.type === "batch") {
      const key = toBatchStatusKey(value);
      if (key) return <StatusBadge tone={BATCH_STATUS_TONE[key]} label={t(`newOrders:batchStatus.${key}`)} />;
    }
    return <Badge>{value}</Badge>;
  };

  const scanValue = (result: ScanResult, field: ScanResult["fields"][number]): ReactNode => {
    const value = field.value;
    switch (field.kind) {
      case "money":
        return formatMoneyLocalized(value, { language });
      case "date":
        return formatDateTimeLocalized(String(value), { language });
      case "phone":
        return formatPhone(value);
      case "count":
        return t("common.count", { count: Number(value) || 0 });
      case "status":
        return scanStatus(result, String(value));
      default:
        return String(value);
    }
  };

  const scanNotFound = scanQuery.isError && getErrorStatus(scanQuery.error) === 404;

  return (
    <OpsToolPage tabKey="system" embedded={embedded}>
      <OpsIntro title={t("system.intro.title")} description={t("system.intro.description")} />

      <HealthCard />

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
              <Button variant="secondary" size="sm" leftIcon={RefreshCw} onClick={retry} loading={kpiQuery.isFetching}>
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
                    value={kpi.onTimeRate}
                    valueText={percent(kpi.onTimeRate)}
                    label={t("system.sla.label")}
                    ariaLabel={t("system.sla.aria", { value: percent(kpi.onTimeRate) })}
                    badge={
                      kpi.onTimeRate >= 70 ? (
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

      <Card title={t("system.scan.title")} description={t("system.scan.description")} bodyClassName="flex flex-col gap-4">
        <form onSubmit={submitScan} className="flex flex-wrap items-end gap-3">
          <Field label={t("system.scan.label")} className="min-w-0 flex-[999_1_240px]">
            <TextInput
              mode="search"
              autoComplete="off"
              value={scanInput}
              onValueChange={setScanInput}
              placeholder={t("system.scan.placeholder")}
            />
          </Field>
          <Button
            type="submit"
            leftIcon={Search}
            loading={Boolean(activeToken) && scanQuery.isFetching}
            disabled={!scanInput.trim()}
            className="flex-[1_0_auto]"
          >
            {t("system.scan.submit")}
          </Button>
        </form>

        {scanNotFound ? (
          <OpsAlert tone="warning" title={t("system.scan.notFound")}>
            {t("system.scan.notFoundHint")}
          </OpsAlert>
        ) : scanQuery.isError ? (
          <OpsAlert tone="danger" title={t("system.scan.error")}>
            {getBackendErrorMessage(scanQuery.error)}
          </OpsAlert>
        ) : scan && activeToken ? (
          <div role="status" aria-label={t("system.scan.result")} className="flex min-w-0 flex-col gap-3 rounded-xl bg-sunken p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{t("system.scan.result")}</span>
              <Badge variant="outline">{t(`system.scan.types.${scan.type}`, { defaultValue: scan.type })}</Badge>
            </div>
            {scan.fields.length === 0 ? (
              <p className="text-[13px] text-text-muted">{t("system.scan.empty")}</p>
            ) : (
              <dl className="m-0 grid grid-cols-[minmax(120px,40%)_1fr] items-center gap-x-4 gap-y-2.5 text-sm">
                {scan.fields.map((field) => (
                  <div key={field.key} className="contents">
                    <dt className="text-text-muted">{t(`system.scan.fields.${field.key}`, { defaultValue: field.key })}</dt>
                    <dd className="m-0 min-w-0 font-semibold text-text wrap-anywhere">{scanValue(scan, field)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ) : null}
      </Card>
    </OpsToolPage>
  );
};

export default memo(SystemOpsPage);
