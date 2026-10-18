// dizayn-v2: superadmin-batches-detail, admin-batches-detail, manager-batches-detail-send, manager-batches-detail-readonly, manager-returns-batch-detail
import type { ReactNode } from "react";
import { Building2, MapPin, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { cx } from "../../../shared/lib/cx";
import { Card } from "../../../shared/ui/primitives";
import type { DeliveryBreakdown } from "../model/batchView";

type InfoItem = { label: string; value: ReactNode; sub?: ReactNode };

type Props = {
  items: readonly InfoItem[];
  delivery: DeliveryBreakdown;
  className?: string;
};

/** «Uygacha / Markazgacha» bo'lagi: `.el-stat-icon` (surface fonda) + nom, soni va summasi. */
const DeliveryTile = ({
  icon: Icon,
  label,
  count,
  sum,
}: {
  icon: LucideIcon;
  label: string;
  count: string;
  sum: string;
}) => (
  <div className="flex min-w-0 items-center gap-3 rounded-xl bg-sunken px-4 py-3">
    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-muted">
      <Icon aria-hidden="true" size={18} strokeWidth={2} />
    </span>
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[13px] font-semibold text-text-muted">{label}</span>
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-base font-bold text-text">{count}</span>
        <span className="text-[13px] text-text-muted">{sum}</span>
      </span>
    </div>
  </div>
);

/**
 * «PAKET MA'LUMOTLARI» kartasi (maket `*-batches-detail*`): `dl` — Filial (ostida kodi) · Qayerga · Viloyat ·
 * Yo'nalish · Buyurtmalar · Summa; chiziqdan keyin «Yetkazish turi bo'yicha» — Uygacha / Markazgacha (soni va summasi).
 */
const BatchInfoCard = ({ items, delivery, className }: Props) => {
  const { t, i18n } = useTranslation("batches");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const qty = (value: number) => t("qty", { value: formatNumberLocalized(value, { language }) });
  const money = (value: number) => formatMoneyLocalized(value, { language });

  return (
    <Card title={t("detail.infoTitle")} className={cx("min-w-0", className)} bodyClassName="flex flex-col gap-5">
      <dl className="flex flex-wrap gap-x-6 gap-y-5">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-[130px] flex-[1_1_30%] flex-col gap-1">
            <dt className="text-[13px] text-text-muted">{item.label}</dt>
            <dd className="min-w-0 break-words text-sm font-semibold text-text">
              {item.value}
              {item.sub ? <div className="text-[13px] font-medium text-text-muted">{item.sub}</div> : null}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <span className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">
          {t("detail.deliveryBreakdown")}
        </span>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-3">
          <DeliveryTile
            icon={MapPin}
            label={t("detail.deliveryHome")}
            count={qty(delivery.home.count)}
            sum={money(delivery.home.sum)}
          />
          <DeliveryTile
            icon={Building2}
            label={t("detail.deliveryCenter")}
            count={qty(delivery.center.count)}
            sum={money(delivery.center.sum)}
          />
        </div>
      </div>
    </Card>
  );
};

export default BatchInfoCard;
