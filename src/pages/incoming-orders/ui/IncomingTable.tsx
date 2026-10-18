// dizayn-v2: superadmin-neworders-incoming-scan, admin-neworders-incoming-scan, manager-new-orders-incoming-scan
import { memo, useMemo } from "react";
import { Circle, CircleCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { IncomingOrder } from "../../../entities/incoming-orders";
import { cx } from "../../../shared/lib/cx";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { DataTable, type DataTableColumn } from "../../../shared/ui/primitives";
import { districtName, orderLabel } from "../lib";

/** Summa: son bo'lmasa (hamkor bermagan) — «—», «0 so'm» emas. */
const money = (value: unknown) => (typeof value === "number" ? formatMoneyLocalized(value) : "—");

/**
 * Skan belgisi (maket: `CircleCheck` yashil / `Circle` kulrang + yashirin matn).
 * `data-*` — testlar va e2e qaysi posilka belgilanganini shu yerdan o'qiydi (jadvalda ham, telefon
 * kartasida ham bitta belgi).
 *
 * `memo`: har skanda faqat BITTA qatorning belgisi o'zgaradi — qolgan qatorlar ikonkasini qayta
 * chizmaydi (250 posilkali qopda har skan 250 ta SVG ni qayta qurish skanerni sekinlashtirardi).
 */
const ScanMark = memo(({ order, scanned, label }: { order: IncomingOrder; scanned: boolean; label: string }) => (
  <span
    data-testid="incoming-parcel"
    data-order-id={order.id}
    data-scanned={scanned ? "true" : "false"}
    className={cx("inline-flex shrink-0", scanned ? "text-success-fg" : "text-text-subtle")}
  >
    {scanned ? <CircleCheck size={20} aria-hidden="true" /> : <Circle size={20} aria-hidden="true" />}
    <span className="sr-only">{label}</span>
  </span>
));
ScanMark.displayName = "ScanMark";

type Props = {
  orders: readonly IncomingOrder[];
  scannedIds: ReadonlySet<string>;
  /** Fonda yangilanmoqda (masalan qabuldan keyin) — ro'yxat xiralashadi. */
  busy?: boolean;
};

/**
 * KELGAN POSILKALAR JADVALI (maket `superadmin-neworders-incoming-scan` → «Kelgan posilkalar»).
 *
 * Desktop/planshet — jadval (skan belgisi · Buyurtma · Mijoz · Tuman · Summa), telefonda — ro'yxat
 * (ism + summa, ostida «№… · tuman»). Skanerlangan qator yashil fonda.
 *
 * ⚠️ `memo`: ro'yxat faqat posilkalar yoki skanerlanganlar o'zgarganda qayta chiziladi — takroriy skan
 * xabari yoki skaner maydonidagi harflar uni qayta chizmaydi (250 posilkali qop).
 */
const IncomingTable = ({ orders, scannedIds, busy = false }: Props) => {
  const { t } = useTranslation("common");
  const scannedLabel = t("incoming.scanned");
  const notScannedLabel = t("incoming.notScanned");

  const columns = useMemo<DataTableColumn<IncomingOrder>[]>(
    () => [
      {
        id: "scan",
        header: <span className="sr-only">{t("incoming.scanStatus")}</span>,
        className: "w-14 pr-0",
        cell: (order) => {
          const scanned = scannedIds.has(order.id);
          return <ScanMark order={order} scanned={scanned} label={scanned ? scannedLabel : notScannedLabel} />;
        },
      },
      {
        id: "order",
        header: t("incoming.colOrder"),
        className: "w-[18%] whitespace-nowrap",
        cell: (order) => <span className="font-semibold">{orderLabel(order)}</span>,
      },
      {
        id: "customer",
        header: t("incoming.colCustomer"),
        cellClassName: "whitespace-nowrap",
        cell: (order) => order.customer?.name ?? "—",
      },
      {
        id: "district",
        header: t("incoming.colDistrict"),
        cellClassName: "whitespace-nowrap text-text-muted",
        cell: (order) => districtName(order),
      },
      {
        id: "amount",
        header: t("incoming.colAmount"),
        align: "end",
        cellClassName: "font-semibold",
        cell: (order) => money(order.total_price),
      },
    ],
    [notScannedLabel, scannedIds, scannedLabel, t],
  );

  const renderCard = (order: IncomingOrder) => {
    const scanned = scannedIds.has(order.id);
    return (
      <div className="flex min-h-14 min-w-0 items-start gap-3 px-4 py-3 text-sm text-text">
        <span className="mt-0.5 inline-flex">
          <ScanMark order={order} scanned={scanned} label={scanned ? scannedLabel : notScannedLabel} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 justify-between gap-2">
            <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{order.customer?.name ?? "—"}</span>
            <span className="whitespace-nowrap font-semibold">{money(order.total_price)}</span>
          </span>
          <span className="text-[13px] text-text-muted">
            {orderLabel(order)} · {districtName(order)}
          </span>
        </span>
      </div>
    );
  };

  return (
    <DataTable
      rows={orders}
      columns={columns}
      getRowKey={(order) => order.id}
      label={t("incoming.listTitle")}
      rowClassName={(order) => scannedIds.has(order.id) && "bg-success-soft"}
      renderCard={renderCard}
      busy={busy}
    />
  );
};

export default memo(IncomingTable);
