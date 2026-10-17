// dizayn-v2: registrator-dashboard-main
import { PackageCheck } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { formatPartOfTotal } from "../../../entities/dashboard/lib/format";
import { share } from "../../../entities/dashboard/lib/period";
import { formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { RingStat } from "../../../shared/ui/charts";
import { Card, TONE_SOFT } from "../../../shared/ui/primitives";

export interface DeliveryResultsCardProps {
  description: string;
  accepted: number;
  sold: number;
  cancelled: number;
  inProgress: number;
}

/**
 * «YETKAZISH NATIJALARI» (registrator; KPI va kpi so'rovi yo'q): Yetkazib berilgan · Jarayonda · Bekor
 * qilish darajasi — hammasi `analytics/dashboard` → `orders` dan.
 */
const DeliveryResultsCard = ({ description, accepted, sold, cancelled, inProgress }: DeliveryResultsCardProps) => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const progressShare = share(inProgress, accepted);
  const cancelShare = share(cancelled, accepted);
  return (
    <Card divided={false} title={t("v2Dashboard.results.title")} description={description} bodyClassName="flex flex-1 flex-col justify-center gap-5">
      <div className="flex min-w-0 items-center gap-4">
        <span className={`inline-flex size-14 shrink-0 items-center justify-center rounded-full ${TONE_SOFT.neutral}`}>
          <PackageCheck size={22} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] text-text-muted">{t("v2Dashboard.results.delivered")}</span>
          <span className="text-xl leading-7 font-bold text-text">
            {t("v2Charts.countTa", { value: formatNumberLocalized(sold, { language }) })}
          </span>
          <span className="text-xs text-text-muted">{t("v2Dashboard.results.deliveredHint")}</span>
        </div>
      </div>
      <RingStat
        value={progressShare}
        label={t("v2Dashboard.status.inProgress")}
        valueText={t("v2Charts.countTa", { value: formatNumberLocalized(inProgress, { language }) })}
        meta={t("v2Dashboard.results.inProgressHint", { share: formatPercentLocalized(progressShare, { language }) })}
      />
      <RingStat
        value={cancelShare}
        label={t("v2Dashboard.quality.cancelRate")}
        valueText={formatPercentLocalized(cancelShare, { language })}
        meta={formatPartOfTotal(t, cancelled, accepted, language)}
      />
    </Card>
  );
};

export default memo(DeliveryResultsCard);
