// dizayn-v2: superadmin-orders-detail, admin-orders-detail, manager-orders-detail, registrator-orders-detail, market-orders-detail
import { useTranslation } from "react-i18next";
import { cx } from "../../../../shared/lib/cx";
import { formatMoneyLocalized } from "../../../../shared/lib/formatMoney";
import { Card } from "../../../../shared/ui/primitives";
import type { OrderDetail } from "./orderDetailModel";

/** «To'lov»: Jami (16 · 700), To'lanishi kerak (600), To'langan (muted 600) — qatorlar orasida chiziq. */
export const PaymentCard = ({ order, className }: { order: OrderDetail; className?: string }) => {
  const { t, i18n } = useTranslation("newOrders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const rows = [
    { key: "total", label: t("total"), value: order.total_price, valueClass: "text-base font-bold text-text" },
    { key: "toBePaid", label: t("toBePaid"), value: order.to_be_paid, valueClass: "font-semibold text-text" },
    { key: "paid", label: t("paid"), value: order.paid_amount, valueClass: "font-semibold text-text-muted" },
  ];

  return (
    <Card title={t("payment")} padding="none" className={className}>
      <dl className="m-0 px-5 py-1 text-sm">
        {rows.map((row, index) => (
          <div
            key={row.key}
            data-payment={row.key}
            className={cx("flex items-baseline justify-between gap-3 py-3", index > 0 && "border-t border-border")}
          >
            <dt className="text-text-muted">{row.label}</dt>
            <dd className={cx("m-0 whitespace-nowrap tabular-nums", row.valueClass)}>
              {formatMoneyLocalized(row.value, { language })}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
};
