// dizayn-v2: superadmin-mails-detail, superadmin-mails-detail-duplicates, superadmin-mails-detail-search, admin-mails-detail-duplicates, admin-mails-detail-search, registrator-mails-detail-duplicates, registrator-mails-detail-search, manager-mails-detail-receive-duplicates, manager-mails-detail-receive-search, superadmin-mails-detail-refused, superadmin-mails-detail-old, admin-mails-detail, admin-mails-old-detail, manager-mails-detail-receive, manager-mails-detail-refused-receive, registrator-mails-detail, courier-mails-detail-receive, courier-mails-detail-refused, courier-mails-detail-old
import { memo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { PostOrder } from "../../../../entities/mails";
import { OrderReturnPlace, OrderStatusBadge } from "../../../../entities/order";
import PrintModeSelect from "../../../../shared/components/PrintModeSelect";
import { cx } from "../../../../shared/lib/cx";
import type { PrintMode } from "../lib/printMode";
import type { OrderRowView } from "../model/useOrderRowView";
import { useMailPrintOptions } from "./printOptions";

/**
 * Pochta buyurtmasi qatorining telefon kartasi (`.el-list-item`, dizayn v2). Matnlar —
 * `model/useOrderRowView.tsx` (jadval kataklari bilan bir xil).
 *
 *  - `OrderRow` — telefon kartasi: ism va summa; kuryerda telefon va vaqt; «№X · tuman · market»; holat va
 *    yetkazish badge'lari; o'ngda chop etish / o'chirish. Xodimda karta matni buyurtma tafsilotiga havola
 *    (maket `superadmin-mails-detail`), tarixda butun karta havola (`admin-mails-old-detail`).
 *  - `RowPrintButton` — qatordagi chop etish menyusi (`PrintModeSelect variant="icon"`).
 */

/** Qatordagi chop etish menyusi; telefonda kuryer kartasida chegarali 44 px (maket `courier-mails-detail-*`). */
export const RowPrintButton = ({
  label,
  onSelect,
  bordered = false,
}: {
  label: string;
  onSelect: (mode: PrintMode) => void;
  bordered?: boolean;
}) => {
  const { t } = useTranslation("mails");
  const options = useMailPrintOptions();
  return (
    <PrintModeSelect
      variant="icon"
      count={1}
      onSelect={(mode) => onSelect(mode as PrintMode)}
      buttonLabel={label}
      menuLabel={t("detailPage.printMenuLabel")}
      options={options}
      iconSize={bordered ? "lg" : "sm"}
      iconVariant={bordered ? "secondary" : "ghost"}
    />
  );
};

type OrderRowProps = {
  order: PostOrder;
  view: OrderRowView;
  /** Chapda tanlov belgisi bor (`DataTable` chizadi, 48 px) — matn undan keyin boshlanadi. */
  selectable: boolean;
  /** Eski pochta: holat badge'i yo'q, badge yonida sana. */
  history?: boolean;
  /** Kuryer kartasi: telefon raqami va vaqt alohida qatorda. */
  courier?: boolean;
  /** Buyurtma tafsiloti havolasi (kuryerda yo'q). */
  href: string | null;
  /**
   * Izoh qatorlari: `place` — «№X · tuman · market» (pochta maketlari); `contact` — «№X · [market ·] telefon» va
   * ostida manzil (paket maketlari `*-batches-detail*`, `manager-returns-batch-detail`).
   */
  meta?: "place" | "contact";
  /** `meta="contact"`: market nomi izohda (faqat o'qish rejimi — jadvalda «Market» ustuni bor). */
  showMarket?: boolean;
  /** O'ngdagi amallar (chop etish, o'chirish). */
  actions: ReactNode;
  /** Badge'lar qatori oxirida — «Takroriy raqam» (MD-1, maket `*-mails-detail-duplicates`). */
  flag?: ReactNode;
};

/** Telefon kartasi (< 768). */
const OrderRow = memo((props: OrderRowProps) => {
  const {
    order,
    view,
    selectable,
    history = false,
    courier = false,
    href,
    actions,
    meta = "place",
    showMarket = true,
    flag,
  } = props;
  const place = view.place(order);
  const market = view.market(order);
  const isContact = meta === "contact" && !courier;
  const metaLine = isContact
    ? [`№${order.id}`, showMarket ? market : null, view.customerPhone(order)].filter(Boolean).join(" · ")
    : [`№${order.id}`, place, market].filter(Boolean).join(" · ");
  const addressLine = isContact ? (view.address(order) ?? view.district(order)) : null;
  // Kuryer: qabul va tarix maketlarida vaqt badge'lar qatorining o'ng chetida (`courier-mails-detail-receive`,
  // `-old`), faqat o'qiladigan rad etilgan pochtada — telefon raqami yonida (`courier-mails-detail-refused`).
  const courierDateOnBadges = courier && (history || selectable);

  const body = (
    <>
      <span className="flex min-w-0 items-start justify-between gap-2">
        <span className="min-w-0 font-semibold text-text">{view.customerName(order)}</span>
        <span className="whitespace-nowrap font-semibold text-text">{view.money(order.total_price)}</span>
      </span>
      {courier ? (
        <span className="flex min-w-0 items-center justify-between gap-2 text-[13px] text-text-muted">
          <span className="whitespace-nowrap">{view.customerPhone(order)}</span>
          {courierDateOnBadges ? null : <span className="whitespace-nowrap text-xs">{view.date(order)}</span>}
        </span>
      ) : null}
      <span className="text-[13px] text-text-muted">{metaLine}</span>
      {addressLine ? <span className="text-[13px] text-text-muted">{addressLine}</span> : null}
      <span className="flex flex-wrap items-center gap-1.5">
        {history ? null : <OrderStatusBadge status={order.status} order={order} />}
        {view.deliveryBadge(order)}
        {flag}
        {history && !courier ? <span className="text-xs text-text-muted">{view.date(order)}</span> : null}
        {courierDateOnBadges ? (
          <span className="ml-auto whitespace-nowrap text-xs text-text-muted">{view.date(order)}</span>
        ) : null}
      </span>
      {history ? null : <OrderReturnPlace order={order} />}
    </>
  );

  const bodyClass = "flex min-w-0 flex-1 flex-col gap-1 text-sm";

  return (
    <div className={cx("flex min-w-0 items-start gap-2 py-3 pr-4", selectable ? "pl-12" : "pl-4")}>
      {href ? (
        <Link to={href} className={cx(bodyClass, "text-text no-underline")}>
          {body}
        </Link>
      ) : (
        <div className={bodyClass}>{body}</div>
      )}
      {/* Amallar ustma-ust — matnga ko'proq joy qoladi (telefonda har tugma 44 px). */}
      {actions ? <div className="-my-1 -mr-1 flex shrink-0 flex-col items-center gap-1">{actions}</div> : null}
    </div>
  );
});
OrderRow.displayName = "OrderRow";

export default OrderRow;
