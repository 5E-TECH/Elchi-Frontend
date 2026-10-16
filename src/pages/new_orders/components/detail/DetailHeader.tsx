// dizayn-v2: superadmin-orders-detail, admin-orders-detail, manager-orders-detail, registrator-orders-detail, market-orders-detail, courier-orders-detail
import type { ReactNode } from "react";
import { Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ReturnRequestedTag } from "../../../../entities/order";
import { copyToClipboard } from "../../../../shared/lib/clipboard";
import { formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { notify } from "../../../../shared/lib/notify";
import { Badge, IconButton, PageHeader } from "../../../../shared/ui/primitives";
import { getDeliveryLabelKey } from "../../../orders/list/courier/list/orderActionModel";
import { DetailStatusBadge } from "./DetailStatusBadge";
import type { OrderDetailLayout } from "./orderDetailAccess";
import { readOrderCreatedAt, readOrderMarket, type OrderDetail } from "./orderDetailModel";

type DetailHeaderProps = {
  /** URL'dagi raqam — buyurtma hali yuklanmagan (yoki topilmagan) bo'lsa ham sarlavha va nusxalash. */
  orderId: string;
  order: OrderDetail | null;
  layout: OrderDetailLayout;
  onBack: () => void;
  actions?: ReactNode;
};

/**
 * Sarlavha (`.el-pagehead`): «← Buyurtmalar», «№10241» + nusxalash, holat va «Qaytarish so'ralgan»,
 * ostida «Yaratilgan: Bugun, 14:15 · Baraka Shop» (marketda faqat sana). Kuryerda (maket
 * `courier-orders-detail`) desktopda holat + yetkazish turi va «Market · sana», telefonda esa
 * badge'lar To'lov kartasiga tushadi, izoh — «Buyurtma tafsilotlari».
 */
export const DetailHeader = ({ orderId, order, layout, onBack, actions }: DetailHeaderProps) => {
  const { t, i18n } = useTranslation(["orders", "newOrders"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const id = order?.id ?? orderId;

  const copy = () => {
    void copyToClipboard(id).then((copied) => {
      if (copied) notify.success(t("orderNumberCopied"));
      else notify.error(t("orderNumberCopyFailed", { id }));
    });
  };

  const createdAt = order ? readOrderCreatedAt(order) : null;
  const date = createdAt ? formatDateTimeLocalized(createdAt, { language }) : null;
  const marketName = order ? readOrderMarket(order)?.name : null;
  const deliveryKey = order ? getDeliveryLabelKey(order.where_deliver) : null;
  const isCourier = layout === "courier";

  const meta = order ? (
    <>
      <DetailStatusBadge status={order.status} className={isCourier ? "max-md:hidden" : undefined} />
      {isCourier && deliveryKey ? <Badge className="max-md:hidden">{t(deliveryKey)}</Badge> : null}
      <ReturnRequestedTag order={order} />
    </>
  ) : null;

  const createdPart = date ? (
    <>
      {t("orderDetail.created", { date: "" })}
      <span className="whitespace-nowrap">{date}</span>
    </>
  ) : null;

  const description = (() => {
    if (!order) return null;
    if (isCourier) {
      const line = [marketName, date].filter(Boolean).join(" · ");
      return (
        <>
          {line ? <span className="max-md:hidden">{line}</span> : null}
          <span className="hidden max-md:inline">{t("viewOrderDetails", { ns: "newOrders" })}</span>
        </>
      );
    }
    if (layout === "market") return createdPart;
    if (!createdPart && !marketName) return null;
    return (
      <>
        {createdPart}
        {createdPart && marketName ? " · " : null}
        {marketName}
      </>
    );
  })();

  return (
    <PageHeader
      back={onBack}
      backLabel={t("orders", { ns: "newOrders" })}
      title={`№${id}`}
      titleAction={<IconButton size="sm" icon={Copy} label={t("copyOrderNumber")} onClick={copy} />}
      meta={meta}
      description={description}
      actions={actions}
    />
  );
};
