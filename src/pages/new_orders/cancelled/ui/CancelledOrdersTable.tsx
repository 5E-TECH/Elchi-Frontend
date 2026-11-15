// dizayn-v2: superadmin-neworders-cancelled-handover, superadmin-neworders-cancelled-scanner-dialog, superadmin-neworders-cancelled-manual-dialog, admin-neworders-cancelled-detail, admin-neworders-cancelled-scanner-dialog, admin-neworders-cancelled-manual-dialog, registrator-new-orders-cancelled-detail, registrator-new-orders-cancelled-scanner-dialog, registrator-new-orders-cancelled-manual-dialog, market-new-orders-cancelled
import { Fragment, useCallback, useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { LoaderCircle, TriangleAlert } from "lucide-react";
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
 *    Buyurtma (№ → tafsilot, sana) · Mijoz · Manzil · Mahsulotlar · Yetkazish · Summa · «Amal» («QR buzilgan» →
 *    «QR buzilganini tasdiqlash» oynasi; so'rov ketayotganida «Topshirilmoqda…»).
 *    ⚠️ SKAN = TOPSHIRISH (ega qarori 2026-11-15, BeePost naqshi): tanlov belgisi va qatorni bosib tanlash YO'Q —
 *    jadvalda faqat hali topshirilmaganlar; skanerlangani darhol marketga topshiriladi va ro'yxatdan chiqadi.
 *    Planshetda (< 1024) Manzil, Mahsulotlar va Yetkazish yashirin.
 *  - `market` — market roli (maket `market-new-orders-cancelled`): tanlovsiz, «Buyurtma» sana bo'yicha
 *    saralanadi; planshetda «Tuman / viloyat» va «Yetkazish» yashirin.
 */

type HandoverProps = {
  variant: "handover";
  rows: readonly MarketOrder[];
  label: string;
  /** Topshirish so'rovi ketmoqda — qatorda «Topshirilmoqda…». */
  isHanding: (order: MarketOrder) => boolean;
  canManualSelect: boolean;
  /** «QR buzilgan» o'chiq (market QR ruxsati hali yo'q) va uning izohi. */
  manualDisabled?: boolean;
  manualDisabledHint?: string;
  /** «QR buzilgan» tugmasi → «QR buzilganini tasdiqlash» oynasi. */
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
  /** № buyurtma sahifasiga havola (xodim «Topshirilgan» partiyasini ko'rganda; market rolida — yo'q). */
  linkOrders?: boolean;
  busy?: boolean;
  className?: string;
};

export type CancelledOrdersTableProps = HandoverProps | MarketProps;

export const CancelledOrdersTable = (props: CancelledOrdersTableProps) => {
  const { t, i18n } = useTranslation(["newOrders", "orders"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isHandover = props.variant === "handover";
  const handover = isHandover ? props : null;
  const linkOrders = isHandover || (props.variant === "market" && props.linkOrders === true);

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

  /** «Amal» katagi: so'rov ketayotganida — «Topshirilmoqda…», aks holda «QR buzilgan» (ruxsat bo'lsa). */
  const actionCell = useCallback(
    (order: MarketOrder, size: "sm" | "md") => {
      if (!handover) return null;
      if (handover.isHanding(order)) {
        return (
          <Badge tone="info" icon={LoaderCircle} role="status" className="motion-safe:[&_svg]:animate-spin">
            {t("cancelled.table.handing")}
          </Badge>
        );
      }
      return handover.canManualSelect ? (
        <Button
          variant="secondary"
          size={size}
          leftIcon={<TriangleAlert className="text-warning-fg" />}
          aria-haspopup="dialog"
          disabled={handover.manualDisabled}
          title={handover.manualDisabled ? handover.manualDisabledHint : undefined}
          onClick={() => handover.onManualSelect(order)}
        >
          {t("cancelled.table.damaged")}
        </Button>
      ) : null;
    },
    [handover, t],
  );

  const columns = useMemo<DataTableColumn<MarketOrder>[]>(() => {
    const orderCell = (order: MarketOrder) => (
      <>
        {linkOrders ? (
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
        id: "action",
        header: t("cancelled.table.columns.action"),
        className: "whitespace-nowrap",
        cell: (order) => actionCell(order, "sm"),
      });
    }
    return list;
  }, [actionCell, dateTime, deliveryBadge, isHandover, linkOrders, money, productLines, t]);

  const renderCard = useCallback(
    (order: MarketOrder) => {
      const district = readOrderDistrict(order) ?? order.address;
      const products = productLines(order)
        .map((line) => `${line.name} ${line.qty}`)
        .join(", ");
      const delivery = deliveryBadge(order);
      const badges: ReactNode[] = [delivery ? <Fragment key="delivery">{delivery}</Fragment> : null].filter(Boolean);
      const content = (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex min-w-0 justify-between gap-2">
            <span className="min-w-0 font-semibold text-text">{order.customer?.name ?? "—"}</span>
            <span className="whitespace-nowrap font-semibold text-text">{money(order.total_price)}</span>
          </span>
          {/* Telefon ism ostida (jadvaldagi «Mijoz» katagidagidek). */}
          {order.customer?.phone_number?.trim() ? (
            <span className="whitespace-nowrap text-[13px] text-text-muted">{formatPhone(order.customer.phone_number)}</span>
          ) : null}
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

      if (!isHandover) {
        return linkOrders ? (
          <Link to={`/orders/edit/${order.id}`} className="block px-4 py-3 hover:bg-sunken">
            {content}
          </Link>
        ) : (
          <div className="px-4 py-3">{content}</div>
        );
      }

      const action = actionCell(order, "md");
      return (
        <div className="flex min-w-0 flex-col gap-2 px-4 py-3">
          {content}
          {action ? <span className="flex">{action}</span> : null}
        </div>
      );
    },
    [actionCell, dateTime, deliveryBadge, isHandover, linkOrders, money, productLines],
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
      rowClassName={handover ? (order) => cx(handover.isHanding(order) && "bg-action-soft") : undefined}
      renderCard={renderCard}
      busy={props.busy}
      // Chiziqni o'ram (`QueryBoundary`) beradi — ikkala variantda.
      className={props.className}
    />
  );
};
