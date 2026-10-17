// dizayn-v2: superadmin-dashboard-main, admin-dashboard-main, registrator-dashboard-main, market-dashboard-home, manager-branch-dashboard-main
import { ChevronRight } from "lucide-react";
import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { ChartNote, Donut, type DonutSegment } from "../../../shared/ui/charts";
import { buttonClasses, Card } from "../../../shared/ui/primitives";

export interface OrderStatusCardProps {
  segments: DonutSegment[];
  /** Markazdagi jami (berilmasa — bo'laklar yig'indisi). */
  total: number;
  /** «Bugun qabul qilinganlar», «Bu oy · 64 ta buyurtma». */
  description: string;
  /** Markaz yorlig'i: «Jami qabul qilingan», «Jami buyurtmalar». */
  centerLabel: string;
  /** «Ro'yxat ›» havolasi (buyurtmalar ro'yxati). */
  listHref?: string;
  note?: ReactNode;
  className?: string;
}

/**
 * «BUYURTMALAR HOLATI» (halqa + legenda-jadval): Sotilgan · Jarayonda/Yo'lda · Bekor qilingan (+ Yangi).
 * Legenda — grafikning jadval egizagi (son va foiz matn bilan).
 */
const OrderStatusCard = ({
  segments,
  total,
  description,
  centerLabel,
  listHref,
  note,
  className,
}: OrderStatusCardProps) => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const list = segments
    .map((segment) => `${segment.label.toLocaleLowerCase()} ${formatNumberLocalized(segment.value, { language })}`)
    .join(", ");

  return (
    <Card
      divided={false}
      className={className}
      title={t("v2Dashboard.status.title")}
      description={description}
      actions={
        listHref ? (
          <Link to={listHref} className={buttonClasses({ variant: "link", size: "sm" })}>
            {t("v2Dashboard.status.list")}
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        ) : undefined
      }
      bodyClassName="flex flex-1 flex-col gap-4"
    >
      <Donut
        segments={segments}
        total={total}
        centerLabel={centerLabel}
        ariaLabel={t("v2Dashboard.status.aria", {
          label: centerLabel,
          total: formatNumberLocalized(total, { language }),
          list,
        })}
        legendLabel={t("v2Dashboard.status.legend")}
      />
      {note ? <ChartNote className="mt-auto">{note}</ChartNote> : null}
    </Card>
  );
};

export default memo(OrderStatusCard);
