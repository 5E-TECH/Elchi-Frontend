// dizayn-v2: superadmin-orders-detail, superadmin-orders-detail-cancelled, manager-orders-detail-cancelled, market-orders-detail-cancelled, admin-orders-detail, manager-orders-detail, registrator-orders-detail, market-orders-detail, courier-orders-detail, superadmin-neworders-market-order-edit, registrator-new-orders-market-order-edit, market-new-orders-edit
import type { ReactNode } from "react";
import { Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ReturnRequestedTag,
  resolveCancelReturnPlace,
  resolveCancelReturnStage,
  useCancelReturnPlaceText,
} from "../../../../entities/order";
import { formatTrackingDateTime } from "../../../../features/order-tracking";
import { copyToClipboard } from "../../../../shared/lib/clipboard";
import { notify } from "../../../../shared/lib/notify";
import { Badge, IconButton, PageHeader } from "../../../../shared/ui/primitives";
import { getDeliveryLabelKey } from "../../../orders/list/courier/list/orderActionModel";
import { DetailStatusBadge } from "./DetailStatusBadge";
import type { OrderDetailLayout } from "./orderDetailAccess";
import { readOrderCreatedAt, readOrderMarket, type OrderDetail } from "./orderDetailModel";

type DetailHeaderProps = {
  /** URL'dagi raqam — buyurtma hali yuklanmagan (yoki topilmagan) bo'lsa ham sarlavha. */
  orderId: string;
  order: OrderDetail | null;
  layout: OrderDetailLayout;
  onBack: () => void;
  /** Orqaga havolasi matni (sukut «Buyurtmalar»; `/new-orders/:marketId/edit` — market nomi yoki «Qabul va yaratish»). */
  backLabel?: string;
  actions?: ReactNode;
  /** «Marketga topshirildi» usuli (tarixdan: «QR orqali» …) — sarlavhadagi joy qatori oxirida. */
  handoverMethod?: string | null;
  /** «Marketga topshirildi» vaqti (tarixdagi topshirish hodisasi; yo'q bo'lsa sahifa `last_handover_at` beradi). */
  handoverAt?: unknown;
};

/**
 * Sarlavha (`.el-pagehead`): «← Buyurtmalar», «№10241» + nusxalash, holat va «Qaytarish so'ralgan»,
 * ostida «Yaratilgan: Bugun, 14:15 · Baraka Shop» (marketda faqat sana). Kuryerda (maket
 * `courier-orders-detail`) desktopda holat + yetkazish turi va «Market · sana», telefonda esa
 * badge'lar To'lov kartasiga tushadi, izoh — «Buyurtma tafsilotlari».
 */
export const DetailHeader = ({
  orderId,
  order,
  layout,
  onBack,
  backLabel,
  actions,
  handoverMethod,
  handoverAt,
}: DetailHeaderProps) => {
  const { t, i18n } = useTranslation(["orders", "newOrders"]);
  const placeText = useCancelReturnPlaceText();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const id = order?.id ?? orderId;

  const copy = () => {
    void copyToClipboard(id).then((copied) => {
      if (copied) notify.success(t("orderNumberCopied"));
      else notify.error(t("orderNumberCopyFailed", { id }));
    });
  };

  const createdAt = order ? readOrderCreatedAt(order) : null;
  // Toshkent vaqti (tarix va «Buyurtma ma'lumotlari» bilan bir xil) — UTC qurilmada ham kun siljimaydi (kH2zZsz3).
  const date = createdAt ? formatTrackingDateTime(createdAt, { language }) : null;
  const marketName = order ? readOrderMarket(order)?.name : null;
  const deliveryKey = order ? getDeliveryLabelKey(order.where_deliver) : null;
  const isCourier = layout === "courier";
  // Bekor bosqichi (maketlar `*-orders-detail-cancelled`): belgi yonida «Toshkent HQ · 3 kun» /
  // «Toshkent HQ · Bugun, 11:20 · QR orqali». Kuryer tafsilotida bosqich yo'q (maket o'zgarmagan).
  const stage = order && !isCourier ? resolveCancelReturnStage(order) : null;
  const place = stage ? placeText(resolveCancelReturnPlace(order, stage, { handoverAt })) : null;
  const stageLine = stage
    ? [place?.name, place?.extra, stage === "market" ? handoverMethod : null].filter(Boolean).join(" · ")
    : "";

  const meta = order ? (
    <>
      <DetailStatusBadge
        status={order.status}
        order={isCourier ? undefined : order}
        className={isCourier ? "max-md:hidden" : undefined}
      />
      {stageLine ? (
        <span className="text-[13px] text-text-muted" data-testid="detail-stage-place">
          {stageLine}
        </span>
      ) : null}
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
      backLabel={backLabel ?? t("orders", { ns: "newOrders" })}
      title={`№${id}`}
      // Nusxalash faqat mavjud buyurtmada (D-13): topilmagan / hali kelmagan raqamni nusxalash ma'nosiz.
      titleAction={order ? <IconButton size="sm" icon={Copy} label={t("copyOrderNumber")} onClick={copy} /> : undefined}
      meta={meta}
      description={description}
      actions={actions}
    />
  );
};
