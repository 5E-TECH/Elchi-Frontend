// dizayn-v2: superadmin-dashboard-main, admin-dashboard-main, registrator-dashboard-main, courier-dashboard-home, market-dashboard-home, manager-branch-dashboard-main
import { CircleCheck, CircleX } from "lucide-react";
import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { ChartLegend, ChartNote, DeltaChip, Gauge, type ChartLegendItem } from "../../../shared/ui/charts";
import { Card } from "../../../shared/ui/primitives";
import { formatPointDelta } from "../../../entities/dashboard/lib/format";

export interface SuccessRateCardProps {
  /** 0..100 */
  rate: number;
  sold: number;
  cancelled: number;
  /** Karta izohi: «Bugun · sotilgan / qabul qilingan». */
  description: string;
  /** Spidometr yorlig'i: «Sotilgan / qabul qilingan» yoki «Sotilgan / jami buyurtmalar». */
  gaugeLabel: string;
  /** Oldingi davr ko'rsatkichi (delta chip + «Kecha · 74,8%» nuqtasi). */
  previous?: { rate: number; label: string } | null;
  /** Legendada «Yaxshi chegarasi · 70%» (maqsad berilsa — uning o'rnida «Maqsad · 80%»). */
  showThreshold?: boolean;
  /**
   * Maqsad, % (l9NNdsCH — backend `targets.successRate`): shkalada maqsad chizig'i va legendada «Maqsad · 80%»
   * («Yaxshi chegarasi · 70%» o'rniga). Berilmasa — avvalgidek.
   */
  target?: number | null;
  /** Pastdagi izoh (`ChartNote`). */
  note?: ReactNode;
  className?: string;
}

/**
 * «MUVAFFAQIYAT DARAJASI» (spidometr): sotilgan / jami, zona badge'i, sotilgan va bekor qilinganlar,
 * oldingi davr bo'lsa — sarlavhada «+2,4 p.p.» va shkalada nuqta. Hamma rollarda bir xil karta.
 */
const SuccessRateCard = ({
  rate,
  sold,
  cancelled,
  description,
  gaugeLabel,
  previous,
  showThreshold = true,
  target,
  note,
  className,
}: SuccessRateCardProps) => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const rateText = formatPercentLocalized(rate, { language });
  const deltaPp = previous ? rate - previous.rate : null;

  const legend: ChartLegendItem[] = [];
  if (previous) {
    legend.push({
      key: "previous",
      tone: "neutral",
      shape: "dot",
      keyClassName: "bg-text-subtle",
      label: `${previous.label} · ${formatPercentLocalized(previous.rate, { language })}`,
    });
  }
  const hasTarget = target != null && Number.isFinite(target);
  if (hasTarget) {
    legend.unshift({
      key: "target",
      tone: "neutral",
      shape: "target",
      label: t("v2Dashboard.success.target", { value: formatPercentLocalized(target, { language }) }),
    });
  } else if (showThreshold) {
    legend.push({ key: "threshold", tone: "success", label: t("v2Dashboard.success.threshold") });
  }

  return (
    <Card
      divided={false}
      className={className}
      title={t("v2Dashboard.success.title")}
      description={description}
      actions={
        deltaPp != null ? (
          <DeltaChip value={deltaPp} text={formatPointDelta(t, deltaPp, language)} />
        ) : undefined
      }
      bodyClassName="flex flex-1 flex-col gap-4"
    >
      <Gauge
        value={rate}
        label={gaugeLabel}
        ariaLabel={t(hasTarget ? "v2Dashboard.success.ariaTarget" : "v2Dashboard.success.aria", {
          rate: rateText,
          target: hasTarget ? formatPercentLocalized(target, { language }) : undefined,
          sold: formatNumberLocalized(sold, { language }),
          cancelled: formatNumberLocalized(cancelled, { language }),
        })}
        marker={previous ? { value: previous.rate, label: previous.label } : undefined}
        target={hasTarget ? target : undefined}
        stats={[
          {
            key: "sold",
            value: t("v2Charts.countTa", { value: formatNumberLocalized(sold, { language }) }),
            label: t("v2Dashboard.status.sold"),
            tone: "success",
            icon: CircleCheck,
          },
          {
            key: "cancelled",
            value: t("v2Charts.countTa", { value: formatNumberLocalized(cancelled, { language }) }),
            label: t("v2Dashboard.status.cancelled"),
            tone: "danger",
            icon: CircleX,
          },
        ]}
      />
      {legend.length > 0 || note ? (
        <div className="mt-auto flex flex-col gap-3">
          {legend.length > 0 ? <ChartLegend items={legend} /> : null}
          {note ? <ChartNote>{note}</ChartNote> : null}
        </div>
      ) : null}
    </Card>
  );
};

export default memo(SuccessRateCard);
