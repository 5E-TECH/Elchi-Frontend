// dizayn-v2: superadmin-neworders-incoming-scan, admin-neworders-incoming-scan, manager-new-orders-incoming-scan, registrator-new-orders-incoming-scan, superadmin-neworders-incoming-scan-undo, admin-neworders-incoming-scan-undo, manager-new-orders-incoming-scan-undo, registrator-new-orders-incoming-scan-undo, superadmin-neworders-incoming-scan-partial, admin-neworders-incoming-scan-partial, manager-new-orders-incoming-scan-partial, registrator-new-orders-incoming-scan-partial
import { memo, useMemo } from "react";
import { Circle, CircleCheck, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { IncomingOrder } from "../../../entities/incoming-orders";
import { cx } from "../../../shared/lib/cx";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { Badge, DataTable, IconButton, type DataTableColumn } from "../../../shared/ui/primitives";
import { bagLabel, bagProgressOf, districtName, orderLabel, type BagProgress } from "../lib";

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
  /** Qop hisobi (`bagProgressIndex`): «2/3» belgisi. Bo'sh bo'lsa — faqat qop yorlig'i. */
  bags: ReadonlyMap<string, BagProgress>;
  /** Skanerlangan qatordagi «Olib tashlash» (`Undo2`) — belgini oladi. Barqaror funksiya bo'lsin (`memo`). */
  onUnscan: (order: IncomingOrder) => void;
  /** Fonda yangilanmoqda (masalan qabuldan keyin) — ro'yxat xiralashadi. */
  busy?: boolean;
};

/** Keldi / hamkor aytgani: chala qop — sariq nuqta bilan, to'liq — neytral (maket `*-incoming-scan-partial`). */
const BagBadge = ({ bag }: { bag: BagProgress }) => {
  const { t } = useTranslation("common");
  const partial = bag.missing > 0;
  return (
    <Badge tone={partial ? "warning" : "neutral"} dot={partial}>
      <span className="sr-only">
        {partial ? t("incoming.bagPartialSr", { size: bag.size, arrived: bag.arrived }) : t("incoming.bagFullSr")}
      </span>
      {bag.arrived}/{bag.size}
    </Badge>
  );
};

/** Qop yorlig'i: «BP-24817» / «3733ff7b…» + «2/3»; qopsiz — kulrang «—». */
const BagCell = ({ order, bag }: { order: IncomingOrder; bag: BagProgress | null }) => {
  const label = bagLabel(order);
  return label ? (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span className="text-text-muted">{label}</span>
      {bag ? <BagBadge bag={bag} /> : null}
    </span>
  ) : (
    <span className="text-text-subtle">—</span>
  );
};

/**
 * KELGAN POSILKALAR JADVALI (maket `superadmin-neworders-incoming-scan` → «Kelgan posilkalar»).
 *
 * Desktop/planshet — jadval (skan belgisi · Buyurtma · Qop · Mijoz · Tuman · Summa · amal; planshetda «Tuman»
 * yashirin), telefonda — ro'yxat (ism + summa, ostida «№… · tuman», «Qop …»). Skanerlangan qator yashil fonda,
 * oxirida «Olib tashlash» (`Undo2`, maket `*-incoming-scan-undo`; telefonda 44 px). Qop yonida «2/3» — backend
 * sonlaridan (`meta.batches`); hamkor hajmni aytmagan yoki backend son bermagan qopda faqat yorliq.
 *
 * ⚠️ `memo`: ro'yxat faqat posilkalar yoki skanerlanganlar o'zgarganda qayta chiziladi — takroriy skan
 * xabari yoki skaner maydonidagi harflar uni qayta chizmaydi (250 posilkali qop).
 */
const IncomingTable = ({ orders, scannedIds, bags, onUnscan, busy = false }: Props) => {
  const { t } = useTranslation("common");
  const scannedLabel = t("incoming.scanned");
  const notScannedLabel = t("incoming.notScanned");
  const unscanLabel = (order: IncomingOrder) => t("incoming.unscanLabel", { order: orderLabel(order) });

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
        className: "w-[13%] whitespace-nowrap",
        cell: (order) => <span className="font-semibold">{orderLabel(order)}</span>,
      },
      {
        id: "bag",
        header: t("incoming.colBag"),
        className: "w-[20%]",
        cell: (order) => <BagCell order={order} bag={bagProgressOf(order, bags)} />,
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
        hideBelow: "lg",
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
      {
        id: "actions",
        header: <span className="sr-only">{t("incoming.colActions")}</span>,
        className: "w-14",
        align: "end",
        cell: (order) =>
          scannedIds.has(order.id) ? (
            <IconButton
              icon={Undo2}
              size="sm"
              label={t("incoming.unscanLabel", { order: orderLabel(order) })}
              onClick={() => onUnscan(order)}
            />
          ) : null,
      },
    ],
    [bags, notScannedLabel, onUnscan, scannedIds, scannedLabel, t],
  );

  const renderCard = (order: IncomingOrder) => {
    const scanned = scannedIds.has(order.id);
    const bag = bagLabel(order);
    const progress = bagProgressOf(order, bags);
    return (
      <div className="flex min-h-14 min-w-0 items-start gap-3 py-3 pl-4 pr-2 text-sm text-text">
        <span className="mt-0.5 inline-flex">
          <ScanMark order={order} scanned={scanned} label={scanned ? scannedLabel : notScannedLabel} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 justify-between gap-2">
            <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{order.customer?.name ?? "—"}</span>
            <span className="whitespace-nowrap font-semibold">{money(order.total_price)}</span>
          </span>
          <span className="text-[13px] text-text-muted">
            {orderLabel(order)} · {districtName(order)}
          </span>
          {bag ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-text-muted">{t("incoming.bagLabel", { bag })}</span>
              {progress ? <BagBadge bag={progress} /> : null}
            </span>
          ) : null}
        </span>
        {scanned ? (
          <IconButton icon={Undo2} label={unscanLabel(order)} className="-mt-0.5 shrink-0" onClick={() => onUnscan(order)} />
        ) : (
          <span aria-hidden="true" className="block w-11 shrink-0" />
        )}
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
