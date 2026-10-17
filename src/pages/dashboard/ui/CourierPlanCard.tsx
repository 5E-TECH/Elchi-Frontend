// dizayn-v2: courier-dashboard-home
import { ChevronRight, CircleCheck, CircleX, Truck } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { share } from "../../../entities/dashboard/lib/period";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { Donut } from "../../../shared/ui/charts";
import { Badge, buttonClasses, Card } from "../../../shared/ui/primitives";

export interface CourierPlanCardProps {
  title: string;
  total: number;
  sold: number;
  cancelled: number;
}

/**
 * «BUGUNGI REJA» (kuryer): biriktirilgan buyurtmalardan nechtasi yakunlandi (sotilgan + bekor), qolgani
 * yo'lda. «Qolgan buyurtmalar ›» → `/orders` (kuryer ro'yxatining sukut tabi — «Kutilmoqda»).
 */
const CourierPlanCard = ({ title, total, sold, cancelled }: CourierPlanCardProps) => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const done = Math.min(total, sold + cancelled);
  const remaining = Math.max(0, total - sold - cancelled);
  const doneShare = formatPercentLocalized(share(done, total), { language });
  const count = (value: number) => formatNumberLocalized(value, { language });
  return (
    <Card
      divided={false}
      title={title}
      description={t("v2Dashboard.courier.planSub", { count: count(total) })}
      actions={
        remaining > 0 ? (
          <Badge tone="warning" dot>
            {t("v2Dashboard.courier.remaining", { count: count(remaining) })}
          </Badge>
        ) : undefined
      }
      bodyClassName="flex flex-1 flex-col gap-4"
    >
      <Donut
        total={total}
        centerValue={doneShare}
        centerLabel={t("v2Dashboard.courier.done", { done: count(done), total: count(total) })}
        ariaLabel={t("v2Dashboard.courier.planAria", {
          total: count(total),
          done: count(done),
          share: doneShare,
          sold: count(sold),
          cancelled: count(cancelled),
          remaining: count(remaining),
        })}
        legendLabel={t("v2Dashboard.courier.planLegend")}
        segments={[
          { key: "sold", label: t("v2Dashboard.status.sold"), value: sold, tone: "success", icon: CircleCheck },
          { key: "cancelled", label: t("v2Dashboard.status.cancelled"), value: cancelled, tone: "danger", icon: CircleX },
          { key: "remaining", label: t("v2Dashboard.courier.remainingOnWay"), value: remaining, tone: "warning", icon: Truck },
        ]}
      />
      <Link
        to="/orders"
        className={cx(buttonClasses({ variant: "secondary", size: "sm" }), "mt-auto self-start max-md:self-stretch")}
      >
        {t("v2Dashboard.courier.remainingOrders")}
        <ChevronRight size={16} aria-hidden="true" />
      </Link>
    </Card>
  );
};

export default memo(CourierPlanCard);
