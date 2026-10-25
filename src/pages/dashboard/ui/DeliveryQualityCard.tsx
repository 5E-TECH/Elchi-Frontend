// dizayn-v2: superadmin-dashboard-main, admin-dashboard-main
import { CalendarRange, Timer } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { KpiResponse } from "../../../entities/dashboard";
import { formatDuration, formatMinutesDelta, formatPartOfTotal, formatPointDelta } from "../../../entities/dashboard/lib/format";
import { formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { DeltaChip, RingStat } from "../../../shared/ui/charts";
import { Card, EmptyState, SkeletonLines, TONE_SOFT } from "../../../shared/ui/primitives";

type Kpi = KpiResponse["data"];

export interface DeliveryQualityCardProps {
  description: string;
  kpi?: Kpi;
  previous?: Kpi;
  loading: boolean;
  /** «Barchasi»: kpi so'ralmaydi — karta o'rnida izoh (ega savoli 7 sukuti). */
  allTime: boolean;
  accepted: number;
  cancelled: number;
}

/**
 * «YETKAZISH SIFATI» (faqat SA/admin, `GET analytics/kpi`): O'z vaqtida (SLA) · Bekor qilish darajasi ·
 * Yetkazish vaqti. Delta — oldingi teng davrning kpi'siga nisbatan (bo'lsa). Davrda yetkazish yo'q (`deliveryCount`
 * 0) — SLA «—» va «O'lchanmagan» (yrLt5oMi).
 */
const DeliveryQualityCard = ({ description, kpi, previous, loading, allTime, accepted, cancelled }: DeliveryQualityCardProps) => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;

  const body = () => {
    if (allTime) {
      return (
        <EmptyState
          size="chart"
          icon={CalendarRange}
          title={t("v2Dashboard.quality.allTimeTitle")}
          description={t("v2Dashboard.quality.allTimeHint")}
        />
      );
    }
    if (loading || !kpi) return <SkeletonLines lines={6} />;
    // yrLt5oMi: davrda yetkazish yo'q — SLA o'lchanmagan («0%» emas, delta ham yo'q). Ishga tushirishning birinchi
    // kunlari aynan shunday.
    const unmeasured = kpi.deliveryCount === 0;
    const onTimeDelta = previous && !unmeasured && previous.deliveryCount !== 0 ? kpi.onTimeRate - previous.onTimeRate : null;
    const cancelDelta = previous ? kpi.cancellationRate - previous.cancellationRate : null;
    const durationDelta =
      previous && previous.averageFulfillmentHours > 0 && kpi.averageFulfillmentHours > 0
        ? kpi.averageFulfillmentHours - previous.averageFulfillmentHours
        : null;
    const duration = formatDuration(t, kpi.averageFulfillmentHours);
    return (
      <div className="flex flex-col gap-5">
        <RingStat
          value={kpi.onTimeRate}
          tone="action"
          label={t("v2Dashboard.quality.onTime")}
          valueText={unmeasured ? "—" : formatPercentLocalized(kpi.onTimeRate, { language })}
          meta={
            unmeasured ? (
              t("v2Dashboard.quality.onTimeUnmeasured")
            ) : (
              <>
                {onTimeDelta != null ? <DeltaChip value={onTimeDelta} text={formatPointDelta(t, onTimeDelta, language)} /> : null}
                {t("v2Dashboard.quality.onTimeHint")}
              </>
            )
          }
        />
        <RingStat
          value={kpi.cancellationRate}
          tone="action"
          label={t("v2Dashboard.quality.cancelRate")}
          valueText={formatPercentLocalized(kpi.cancellationRate, { language })}
          meta={
            <>
              {cancelDelta != null ? (
                <DeltaChip value={cancelDelta} goodWhen="down" text={formatPointDelta(t, cancelDelta, language)} />
              ) : null}
              {formatPartOfTotal(t, cancelled, accepted, language)}
            </>
          }
        />
        <div className="flex min-w-0 items-center gap-4">
          <span className={`inline-flex size-14 shrink-0 items-center justify-center rounded-full ${TONE_SOFT.neutral}`}>
            <Timer size={22} aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13px] text-text-muted">{t("v2Dashboard.quality.duration")}</span>
            <span className="text-xl leading-7 font-bold text-text">{duration ?? "—"}</span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
              {durationDelta != null ? (
                <DeltaChip value={durationDelta} goodWhen="down" text={formatMinutesDelta(t, durationDelta)} />
              ) : null}
              {t("v2Dashboard.quality.durationHint")}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card divided={false} title={t("v2Dashboard.quality.title")} description={description} bodyClassName="flex flex-1 flex-col justify-center">
      {body()}
    </Card>
  );
};

export default memo(DeliveryQualityCard);
