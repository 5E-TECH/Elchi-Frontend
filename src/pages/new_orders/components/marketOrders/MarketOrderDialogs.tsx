// dizayn-v2: superadmin-neworders-receive-confirm-dialog, admin-neworders-market-confirm-dialog, manager-new-orders-receive-confirm-dialog, manager-new-orders-delete-confirm-dialog, registrator-new-orders-market-detail-receive-dialog, registrator-new-orders-market-detail-delete-dialog, market-new-orders-delete-dialog
import { Check, Inbox, ShoppingBag, Trash2, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { ConfirmDialog } from "../../../../shared/ui/primitives";
import { getDeliveryLabelKey } from "../../../orders/list/courier/list/orderActionModel";
import { readOrderDistrict, readProductLines, type MarketOrder } from "./marketOrdersModel";

/**
 * Marketning yangi buyurtmalari sahifasidagi tasdiq oynalari (`ConfirmDialog`, `sm`; telefonda pastki varaqa).
 *
 *  - «Qo'lda qabul qilish» — `Inbox` (neytral), «Market» + «Buyurtmalar / Jami summa» (sunken quti),
 *    tanlanmaganlar eslatmasi (`Info`), «Tasdiqlash». Filial nomi ma'lum bo'lsa (registrator maketi) —
 *    «Ular {filial} pochtasiga o'tkaziladi».
 *  - «Buyurtmani o'chirish» — xodimda `Trash2` + «№ · mijoz», «market · tuman», «Jami summa»;
 *    marketda `TriangleAlert` + `ShoppingBag` qatori «mahsulotlar · yetkazish».
 */

type ReceiveConfirmDialogProps = {
  open: boolean;
  marketName: string;
  count: number;
  total: number;
  unselected: { count: number; ids: string[]; more: boolean };
  /** Filial nomi (faqat to'g'ridan-to'g'ri qabulda) — tavsif matni shunga qarab. */
  branchName: string | null;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export const ReceiveConfirmDialog = ({
  open,
  marketName,
  count,
  total,
  unselected,
  branchName,
  loading,
  onCancel,
  onConfirm,
}: ReceiveConfirmDialogProps) => {
  const { t, i18n } = useTranslation("newOrders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const ids = unselected.ids.map((id) => `№${id}`).join(", ") + (unselected.more ? "…" : "");

  return (
    <ConfirmDialog
      open={open}
      size="sm"
      icon={Inbox}
      iconTone="neutral"
      title={t("receiveOrderTitle")}
      description={
        branchName
          ? t("marketOrders.receiveDescriptionBranch", { branch: branchName })
          : t("marketOrders.receiveDescription")
      }
      details={
        <div className="flex flex-col gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-text-muted">{t("marketOrders.detailMarket")}</span>
            <span className="font-semibold">{marketName}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs text-text-muted">{t("marketOrders.detailOrders")}</span>
              <span className="text-base font-bold">
                {t("marketOrders.ordersQty", { value: formatNumberLocalized(count, { language }) })}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs text-text-muted">{t("marketOrders.detailTotal")}</span>
              <span className="whitespace-nowrap text-base font-bold">{formatMoneyLocalized(total, { language })}</span>
            </div>
          </div>
        </div>
      }
      note={
        unselected.count > 0
          ? t("marketOrders.unselectedNote", { value: formatNumberLocalized(unselected.count, { language }), ids })
          : undefined
      }
      confirmLabel={t("receiveConfirm")}
      confirmIcon={Check}
      loadingLabel={t("receiving")}
      loading={loading}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
};

type DeleteOrderDialogProps = {
  order: MarketOrder | null;
  variant: "staff" | "market";
  marketName: string | null;
  onCancel: () => void;
  /** Va'da: rad etilsa xato oynada ko'rsatiladi va oyna ochiq qoladi. */
  onConfirm: () => Promise<unknown>;
};

export const DeleteOrderDialog = ({ order, variant, marketName, onCancel, onConfirm }: DeleteOrderDialogProps) => {
  const { t, i18n } = useTranslation(["newOrders", "orders"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const money = (value: unknown) => formatMoneyLocalized(value, { language });

  const details = (() => {
    if (!order) return null;
    const customer = order.customer?.name ?? "—";
    if (variant === "market") {
      const products = readProductLines(order)
        .map((line) => `${line.name} · ${t("marketOrders.itemsQty", { value: formatNumberLocalized(line.quantity, { language }) })}`)
        .join(", ");
      const deliveryKey = getDeliveryLabelKey(order.where_deliver);
      const sub = [products, deliveryKey ? t(deliveryKey, { ns: "orders" }) : null].filter(Boolean).join(" · ");
      return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            aria-hidden="true"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-muted"
          >
            <ShoppingBag size={18} />
          </span>
          <span className="flex min-w-0 flex-[1_1_160px] flex-col gap-0.5">
            <span className="font-semibold">
              №{order.id} · <span className="whitespace-nowrap">{customer}</span>
            </span>
            {sub ? <span className="text-[13px] text-text-muted">{sub}</span> : null}
          </span>
          <span className="ml-auto whitespace-nowrap font-semibold">{money(order.total_price)}</span>
        </div>
      );
    }
    const place = [marketName, readOrderDistrict(order)].filter(Boolean);
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-0.5">
          <span className="font-semibold">
            №{order.id} · {customer}
          </span>
          {place.length > 0 ? (
            <span className="inline-flex flex-wrap gap-x-1 text-text-muted">
              {place.map((part, index) => (
                <span key={index} className="whitespace-nowrap">
                  {index > 0 ? <span aria-hidden="true">· </span> : null}
                  {part}
                </span>
              ))}
            </span>
          ) : null}
        </div>
        <div className="ml-auto flex flex-col gap-0.5 text-right">
          <span className="text-xs text-text-muted">{t("marketOrders.detailTotal")}</span>
          <span className="whitespace-nowrap font-semibold">{money(order.total_price)}</span>
        </div>
      </div>
    );
  })();

  return (
    <ConfirmDialog
      open={Boolean(order)}
      size="sm"
      tone="danger"
      icon={variant === "market" ? TriangleAlert : Trash2}
      title={t("deleteOrderTitle")}
      description={t("deleteOrderMessage")}
      details={details}
      confirmLabel={t("marketOrders.deleteConfirm")}
      confirmIcon={Trash2}
      loadingLabel={t("marketOrders.deleting")}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
};
