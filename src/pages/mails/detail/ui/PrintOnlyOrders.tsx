import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { PostOrder, OrderStatus } from "../../../../entities/mails";
import { formatDate, formatPrice, getStatusLabel } from "../lib/helpers";

type Props = {
  orders: PostOrder[];
};

const PrintOnlyOrders = ({ orders }: Props) => {
  const { t } = useTranslation(["mails", "orders", "common"]);
  const rows = useMemo(() => {
    return orders.map((o, idx) => {
      const customer = o.customer?.name ?? t("mails:customerNumber", { id: o.customer_id });
      const phone = o.customer?.phone_number ?? "—";
      const district = o.district?.name ?? "—";
      const market = o.market?.name ?? "—";
      const deliver = o.where_deliver === "address" ? t("orders:deliveryToHome") : t("orders:deliveryToCenter");
      const date = formatDate(o.updatedAt ?? o.createdAt);
      const status = getStatusLabel(o.status as OrderStatus);

      return {
        idx: idx + 1,
        id: o.id,
        customer,
        phone,
        district,
        market,
        deliver,
        price: formatPrice(o.total_price),
        date,
        status,
      };
    });
  }, [orders, t]);

  return (
    <div className="print-root" aria-hidden>
      <h1 className="print-title">{t("selectedOrdersPrintTitle")}</h1>
      <div className="print-meta">{t("countLabel", { count: orders.length })}</div>

      <table className="print-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t("orders:customer")}</th>
            <th>{t("common:phone")}</th>
            <th>{t("common:district")}</th>
            <th>{t("orders:market")}</th>
            <th>{t("orders:deliveryType")}</th>
            <th>{t("common:price")}</th>
            <th>{t("common:date")}</th>
            <th>{t("orders:orderStatus")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.idx}</td>
              <td>{r.customer}</td>
              <td>{r.phone}</td>
              <td>{r.district}</td>
              <td>{r.market}</td>
              <td>{r.deliver}</td>
              <td>{r.price}</td>
              <td>{r.date}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default memo(PrintOnlyOrders);
