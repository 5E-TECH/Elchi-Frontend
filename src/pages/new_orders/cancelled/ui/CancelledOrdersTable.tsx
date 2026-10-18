// dizayn-v2: superadmin-neworders-cancelled-handover, superadmin-neworders-cancelled-scanner-dialog, superadmin-neworders-cancelled-manual-dialog, admin-neworders-cancelled-detail, admin-neworders-cancelled-scanner-dialog, admin-neworders-cancelled-manual-dialog, registrator-new-orders-cancelled-detail, registrator-new-orders-cancelled-scanner-dialog, registrator-new-orders-cancelled-manual-dialog, market-new-orders-cancelled
import { Fragment, useCallback, useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { formatPhone } from "../../../../shared/lib/formatPhone";
import {
  Badge,
  Button,
  DataTable,
  type DataTableColumn,
  type DataTableSort,
} from "../../../../shared/ui/primitives";
import { getDeliveryLabelKey } from "../../../orders/list/courier/list/orderActionModel";
import {
  readOrderDistrict,
  readOrderRegion,
  readProductLines,
  type MarketOrder,
} from "../../components/marketOrders/marketOrdersModel";

/**
 * Bekor qilingan buyurtmalar jadvali (`.el-table`, telefonda `.el-list` kartalari).
 *
 *  - `handover` — xodim (superadmin/admin/HQ registratori), maket `*-cancelled-handover|detail`:
 *    «Tanlash» belgisi · Buyurtma (№ → tafsilot, sana) · Mijoz · Manzil · Mahsulotlar · Yetkazish · Summa ·
 *    «Tanlov» (tanlanmaganida «QR buzilgan», qo'lda tasdiqlanganida «Qo'lda tasdiqlangan» badge'i).
 *    ⚠️ Tanlov FAQAT skaner orqali (market QR yoki buyurtma QR): sarlavhada «hammasini tanlash» YO'Q
 *    (shuning uchun `DataTable` ning `selection` i emas — o'z belgisi). Tanlanmagan qatorni belgilash yoki
 *    qatorni bosish — «QR buzilganini tasdiqlash» oynasi (v1 kartasidagi kabi); tanlanganini — tanlovdan chiqarish.
 *    Planshetda (< 1024) Manzil, Mahsulotlar va Yetkazish yashirin.
 *  - `market` — market roli (maket `market-new-orders-cancelled`): tanlovsiz, «Buyurtma» sana bo'yicha
 *    saralanadi; planshetda «Tuman / viloyat» va «Yetkazish» yashirin.
 */

type HandoverProps = {
  variant: "handover";
  rows: readonly MarketOrder[];
  label: string;
  isSelected: (order: MarketOrder) => boolean;
  /** Qo'lda tasdiqlangan (skanersiz) — sabab yorlig'i, aks holda `null`. */
  manualReasonOf: (order: MarketOrder) => string | null;
  canManualSelect: boolean;
  /** Belgi / qator bosildi: tanlanmagan bo'lsa — qo'lda tasdiqlash oynasi, tanlangan bo'lsa — chiqarish. */
  onToggle: (order: MarketOrder) => void;
  /** «QR buzilgan» tugmasi. */
  onManualSelect: (order: MarketOrder) => void;
  busy?: boolean;
  className?: string;
};

type MarketProps = {
  variant: "market";
  rows: readonly MarketOrder[];
  label: string;
  sort: DataTableSort | null;
  onSortChange: (sort: DataTableSort | null) => void;
  busy?: boolean;
  className?: string;
};

export type CancelledOrdersTableProps = HandoverProps | MarketProps;

const CHECKBOX = "size-[18px] cursor-pointer accent-action disabled:cursor-not-allowed disabled:opacity-45 max-md:size-5";

export const CancelledOrdersTable = (props: CancelledOrdersTableProps) => {
  const { t, i18n } = useTranslation(["newOrders", "orders"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isHandover = props.variant === "handover";
  const handover = isHandover ? props : null;

  const money = useCallback((value: unknown) => formatMoneyLocalized(value, { language }), [language]);
  const dateTime = useCallback((value: string) => formatDateTimeLocalized(value, { language }), [language]);
  const number = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);

  /** Mahsulot qatori: xodimda «Bolalar kurtkasi × 1», marketda «Bolalar kurtkasi · 1 ta» (maketlardagidek). */
  const productLines = useCallback(
    (order: MarketOrder) =>
      readProductLines(order).map((line) => ({
        key: line.key,
        name: line.name,
        qty: isHandover
          ? `× ${number(line.quantity)}`
          : `· ${t("marketOrders.itemsQty", { value: number(line.quantity) })}`,
      })),
    [isHandover, number, t],
  );

  const deliveryBadge = useCallback(
    (order: MarketOrder) => {
      const key = getDeliveryLabelKey(order.where_deliver);
      return key ? <Badge>{t(key, { ns: "orders" })}</Badge> : null;
    },
    [t],
  );

  const manualBadge = useCallback(
    (order: MarketOrder) => {
      const reason = handover?.manualReasonOf(order);
      return reason ? (
        <Badge tone="warning" dot title={reason}>
          {t("cancelled.table.manualBadge")}
        </Badge>
      ) : null;
    },
    [handover, t],
  );

  const checkbox = useCallback(
    (order: MarketOrder) => {
      if (!handover) return null;
      const selected = handover.isSelected(order);
      return (
        <input
          type="checkbox"
          className={CHECKBOX}
          checked={selected}
          disabled={!handover.canManualSelect}
          aria-label={t(selected ? "cancelled.table.rowDeselect" : "cancelled.table.rowSelect", { id: order.id })}
          onChange={() => handover.onToggle(order)}
        />
      );
    },
    [handover, t],
  );

  const damagedButton = useCallback(
    (order: MarketOrder, size: "sm" | "md") =>
      handover && handover.canManualSelect && !handover.isSelected(order) ? (
        <Button
          variant="secondary"
          size={size}
          leftIcon={<TriangleAlert className="text-warning-fg" />}
          aria-haspopup="dialog"
          onClick={() => handover.onManualSelect(order)}
        >
          {t("cancelled.table.damaged")}
        </Button>
      ) : null,
    [handover, t],
  );

  const columns = useMemo<DataTableColumn<MarketOrder>[]>(() => {
    const orderCell = (order: MarketOrder) => (
      <>
        {isHandover ? (
          <Link
            to={`/orders/edit/${order.id}`}
            className="whitespace-nowrap font-semibold text-text hover:text-action-fg hover:underline"
          >
            №{order.id}
          </Link>
        ) : (
          <div className="whitespace-nowrap font-semibold text-text">№{order.id}</div>
        )}
        <div className="whitespace-nowrap text-[13px] text-text-muted">{dateTime(order.createdAt)}</div>
      </>
    );

    const list: DataTableColumn<MarketOrder>[] = [];
    if (isHandover) {
      list.push({
        id: "select",
        header: <span className="sr-only">{t("cancelled.table.columns.select")}</span>,
        className: "w-11 pr-0",
        cell: (order) => checkbox(order),
      });
    }
    list.push(
      isHandover
        ? { id: "order", header: t("cancelled.table.columns.order"), cell: orderCell }
        : {
            id: "createdAt",
            header: t("cancelled.table.columns.order"),
            sortable: true,
            firstDirection: "desc",
            sortTitle: t("cancelled.table.sortByDate"),
            cell: orderCell,
          },
      {
        id: "customer",
        header: t("cancelled.table.columns.customer"),
        cell: (order) => (
          <>
            <div className="whitespace-nowrap font-semibold text-text">{order.customer?.name ?? "—"}</div>
            <div className="whitespace-nowrap text-[13px] text-text-muted">
              {formatPhone(order.customer?.phone_number) || "—"}
            </div>
          </>
        ),
      },
      {
        id: "location",
        header: t(isHandover ? "cancelled.table.columns.address" : "cancelled.table.columns.location"),
        hideBelow: "lg",
        cell: (order) => (
          <>
            <div className="whitespace-nowrap">{readOrderDistrict(order) ?? order.address ?? "—"}</div>
            {readOrderRegion(order) ? (
              <div className="whitespace-nowrap text-[13px] text-text-muted">{readOrderRegion(order)}</div>
            ) : null}
          </>
        ),
      },
      {
        id: "products",
        header: t("cancelled.table.columns.products"),
        hideBelow: isHandover ? "lg" : undefined,
        cell: (order) => {
          const lines = productLines(order);
          if (lines.length === 0) return <span className="text-text-subtle">—</span>;
          return (
            <div className="flex flex-col gap-0.5 text-[13px]">
              {lines.map((line) => (
                <span key={line.key} className="whitespace-nowrap">
                  {line.name} <span className="text-text-muted">{line.qty}</span>
                </span>
              ))}
            </div>
          );
        },
      },
      {
        id: "delivery",
        header: t("cancelled.table.columns.delivery"),
        hideBelow: "lg",
        cell: (order) => deliveryBadge(order),
      },
      {
        id: "amount",
        header: t("cancelled.table.columns.amount"),
        align: "end",
        cell: (order) => <span className="font-semibold text-text">{money(order.total_price)}</span>,
      },
    );
    if (isHandover) {
      list.push({
        id: "choice",
        header: t("cancelled.table.columns.choice"),
        className: "whitespace-nowrap",
        cell: (order) => manualBadge(order) ?? damagedButton(order, "sm"),
      });
    }
    return list;
  }, [checkbox, damagedButton, dateTime, deliveryBadge, isHandover, manualBadge, money, productLines, t]);

  const renderCard = useCallback(
    (order: MarketOrder) => {
      const district = readOrderDistrict(order) ?? order.address;
      const products = productLines(order)
        .map((line) => `${line.name} ${line.qty}`)
        .join(", ");
      const delivery = deliveryBadge(order);
      const manual = manualBadge(order);
      const badges: ReactNode[] = [
        delivery ? <Fragment key="delivery">{delivery}</Fragment> : null,
        manual ? <Fragment key="manual">{manual}</Fragment> : null,
      ].filter(Boolean);
      const content = (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex min-w-0 justify-between gap-2">
            <span className="min-w-0 font-semibold text-text">{order.customer?.name ?? "—"}</span>
            <span className="whitespace-nowrap font-semibold text-text">{money(order.total_price)}</span>
          </span>
          <span className="text-[13px] text-text-muted">
            №{order.id}
            {district ? ` · ${district}` : null}
            {" · "}
            <span className="whitespace-nowrap">{dateTime(order.createdAt)}</span>
          </span>
          {products ? <span className="text-[13px] text-text">{products}</span> : null}
          {badges.length > 0 ? <span className="flex flex-wrap items-center gap-1.5">{badges}</span> : null}
        </div>
      );

      if (!isHandover) return <div className="px-4 py-3">{content}</div>;

      const damaged = damagedButton(order, "md");
      return (
        <div className="flex min-w-0 items-start gap-1 py-3 pr-4 pl-1">
          {/* Belgi — 44 × 44 bosish maydoni (maketdagidek kartaning chap ustuni). */}
          <label className="-mt-2.5 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center">
            {checkbox(order)}
          </label>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {content}
            {damaged ? <span className="flex">{damaged}</span> : null}
          </div>
        </div>
      );
    },
    [checkbox, damagedButton, dateTime, deliveryBadge, isHandover, manualBadge, money, productLines],
  );

  return (
    <DataTable
      rows={props.rows}
      columns={columns}
      getRowKey={(order) => String(order.id)}
      label={props.label}
      density="tablet-tight"
      sort={props.variant === "market" ? props.sort : undefined}
      onSortChange={props.variant === "market" ? props.onSortChange : undefined}
      rowClassName={handover ? (order) => cx(handover.isSelected(order) && "bg-action-soft") : undefined}
      // Xodimda qator (karta) bosilsa — belgi bilan bir xil (v1 kartasidagi kabi): tanlanmagan → qo'lda tasdiqlash oynasi.
      onRowClick={handover && handover.canManualSelect ? (order) => handover.onToggle(order) : undefined}
      renderCard={renderCard}
      busy={props.busy}
      // Xodimda kartalar tanlov qatoridan keyin — chiziq shu yerda; marketda chiziqni o'ram (`QueryBoundary`) beradi.
      className={cx(isHandover && "max-md:border-t max-md:border-border", props.className)}
    />
  );
};
