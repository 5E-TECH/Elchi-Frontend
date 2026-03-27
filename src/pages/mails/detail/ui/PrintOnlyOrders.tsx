import { memo, useMemo } from "react";
import type { PostOrder, OrderStatus } from "../../../../entities/mails";
import { formatDate, formatPrice, getStatusLabel } from "../lib/helpers";

type Props = {
  orders: PostOrder[];
};

const PrintOnlyOrders = ({ orders }: Props) => {
  const rows = useMemo(() => {
    return orders.map((o, idx) => {
      const customer = o.customer?.name ?? `Mijoz #${o.customer_id}`;
      const phone = o.customer?.phone_number ?? "—";
      const district = o.district?.name ?? "—";
      const market = o.market?.name ?? "—";
      const deliver = o.where_deliver === "address" ? "Manzilga" : "Markazga";
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
  }, [orders]);

  return (
    <div className="print-root" aria-hidden>
      <h1 className="print-title">Tanlangan buyurtmalar</h1>
      <div className="print-meta">Soni: {orders.length}</div>

      <table className="print-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Mijoz</th>
            <th>Telefon</th>
            <th>Tuman</th>
            <th>Market</th>
            <th>Yetkazish</th>
            <th>Narx</th>
            <th>Sana</th>
            <th>Holati</th>
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

