// dizayn-v2: courier-orders-detail
import { useId } from "react";
import { Calendar, Lock, MapPin, Phone, Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatMoneyLocalized, CURRENCY_LABEL, resolveMoneyLanguage } from "../../../../shared/lib/formatMoney";
import { formatPhone, toTelHref } from "../../../../shared/lib/formatPhone";
import { formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { ProductThumb } from "../../../../entities/product/ui/ProductThumb";
import { getOrderItemName } from "../../../../shared/lib/orderItemName";
import { Badge, Card, EmptyState } from "../../../../shared/ui/primitives";
import { getDeliveryLabelKey, getInitials } from "../../../orders/list/courier/list/orderActionModel";
import { DetailStatusBadge } from "./DetailStatusBadge";
import { OrderComment } from "./OrderComment";
import {
  getDistrictName,
  getProductImageUrl,
  getRegionName,
  isCatalogLessItem,
  readOrderCreatedAt,
  readOrderMarket,
  type OrderDetail,
} from "./orderDetailModel";

/**
 * KURYER TAFSILOTI kartalari (`courier-orders-detail`). Kartaning sarlavhasi telefonda ko'rinmaydi
 * (`.el-sr`): bitta `<h2>` — desktopda sarlavha qatori, telefonda faqat ekran o'quvchi uchun.
 */
const CardHead = ({ id, title }: { id: string; title: string }) => (
  <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-5 py-4 max-md:contents">
    <h2 id={id} className="text-base font-bold text-text max-md:sr-only">
      {title}
    </h2>
  </div>
);

const LockNote = ({ children }: { children: string }) => (
  <div className="flex items-start gap-2 border-t border-border px-5 py-2.5 text-text-muted">
    <Lock size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
    <p className="m-0 text-xs">{children}</p>
  </div>
);

/** «To'lov»: katta «To'lanishi kerak»; telefonda tepada holat, yetkazish turi va sana. */
export const CourierPaymentCard = ({ order, className }: { order: OrderDetail; className?: string }) => {
  const { t, i18n } = useTranslation(["orders", "newOrders"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const titleId = useId();
  const deliveryKey = getDeliveryLabelKey(order.where_deliver);
  const createdAt = readOrderCreatedAt(order);
  const money = (value: number) => formatMoneyLocalized(value, { language });

  return (
    <Card padding="none" aria-labelledby={titleId} className={className}>
      <CardHead id={titleId} title={t("payment", { ns: "newOrders" })} />
      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="hidden flex-wrap items-center gap-2 max-md:flex">
          <DetailStatusBadge status={order.status} />
          {deliveryKey ? <Badge>{t(deliveryKey)}</Badge> : null}
          {createdAt ? (
            <span className="ml-auto inline-flex items-center gap-1 text-[13px] text-text-muted">
              <Calendar size={14} aria-hidden="true" />
              <span className="sr-only">{t("orderDetail.dateLabel")} </span>
              {formatDateTimeLocalized(createdAt, { language })}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold text-text-muted">{t("toBePaid", { ns: "newOrders" })}</span>
          <span className="text-[28px] leading-9 font-bold tracking-[-.01em] text-text tabular-nums">
            {formatMoneyLocalized(order.to_be_paid, { language, withCurrency: false })}
            <span className="ml-1 text-sm font-semibold tracking-normal text-text-muted">
              {CURRENCY_LABEL[resolveMoneyLanguage(language)]}
            </span>
          </span>
          <span className="hidden flex-wrap items-center gap-1.5 text-[13px] text-text-muted max-md:flex">
            <span>
              {t("total", { ns: "newOrders" })} {money(order.total_price)}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t("paid", { ns: "newOrders" })} {money(order.paid_amount)}
            </span>
          </span>
        </div>
        <dl className="m-0 flex flex-col text-sm max-md:hidden">
          <div className="flex items-baseline justify-between gap-3 border-t border-border py-3">
            <dt className="text-text-muted">{t("total", { ns: "newOrders" })}</dt>
            <dd className="m-0 font-semibold text-text tabular-nums">{money(order.total_price)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
            <dt className="text-text-muted">{t("paid", { ns: "newOrders" })}</dt>
            <dd className="m-0 font-semibold text-text-muted tabular-nums">{money(order.paid_amount)}</dd>
          </div>
        </dl>
      </div>
    </Card>
  );
};

/** «Mijoz va manzil»: avatar + ism + telefon, qo'ng'iroq tugmasi; manzil; qulf izohi. */
export const CourierContactCard = ({
  order,
  locked = false,
  className,
}: {
  order: OrderDetail;
  locked?: boolean;
  className?: string;
}) => {
  const { t } = useTranslation(["orders", "newOrders"]);
  const titleId = useId();
  const name = order.customer.name.trim() || "—";
  const phone = formatPhone(order.customer.phone_number);
  const telHref = toTelHref(order.customer.phone_number);
  const place = [getDistrictName(order), getRegionName(order)].filter(Boolean).join(", ");

  return (
    <Card padding="none" aria-labelledby={titleId} className={className}>
      <CardHead id={titleId} title={t("orderDetail.customerAndAddress")} />
      <div className="flex min-h-14 items-center gap-3 border-b border-border px-5 py-3 text-sm">
        <span
          aria-hidden="true"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-avatar text-[13px] font-bold text-on-avatar"
        >
          {getInitials(order.customer.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-text">{name}</div>
          <div className="text-[13px] text-text-muted">{phone}</div>
        </div>
        {telHref ? (
          <a
            href={telHref}
            aria-label={t("courierList.call", { name, phone })}
            title={t("courierList.call", { name, phone })}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-action-soft text-action-fg transition-[background-color,color] duration-150 hover:bg-action hover:text-on-solid motion-reduce:transition-none"
          >
            <Phone size={20} aria-hidden="true" />
          </a>
        ) : null}
      </div>
      <div className="flex min-h-14 items-start gap-3 px-5 py-3 text-sm">
        <span
          role="img"
          aria-label={t("orderDetail.addressLabel")}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
        >
          <MapPin size={20} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-semibold wrap-break-word text-text">{place || "—"}</span>
          {order.address?.trim() ? (
            <span className="text-[13px] wrap-break-word text-text-muted">{order.address.trim()}</span>
          ) : null}
        </div>
      </div>
      {locked ? <LockNote>{t("destinationLockReason", { ns: "newOrders" })}</LockNote> : null}
    </Card>
  );
};

/** «Mahsulotlar»: ro'yxat (jadval emas), o'ngda market nomi; izoh; qulf izohi. */
export const CourierProductsCard = ({
  order,
  locked = false,
  className,
}: {
  order: OrderDetail;
  locked?: boolean;
  className?: string;
}) => {
  const { t } = useTranslation(["orders", "newOrders"]);
  const titleId = useId();
  const marketName = readOrderMarket(order)?.name ?? null;
  const comment = order.comment?.trim() ?? "";

  return (
    <Card padding="none" aria-labelledby={titleId} className={className}>
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 flex-col">
          <h2 id={titleId} className="text-base font-bold text-text">
            {t("orderDetail.products")}
          </h2>
          <span className="text-xs text-text-muted">{t("orderDetail.productsCount", { count: order.items.length })}</span>
        </div>
        {marketName ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-text-muted">
            <Store size={16} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{marketName}</span>
          </span>
        ) : null}
      </div>
      {order.items.length > 0 ? (
        <ul className="m-0 flex list-none flex-col p-0">
          {order.items.map((item) => (
            <li key={item.id} className="flex min-h-14 items-center gap-3 border-b border-border px-5 py-2 text-sm last:border-b-0">
              <ProductThumb imageUrl={getProductImageUrl(item)} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold wrap-break-word text-text">
                  {getOrderItemName(item, t("productFallback", { ns: "newOrders" }))}
                </span>
                {isCatalogLessItem(item) ? (
                  <span className="block text-xs text-text-muted">{t("orderDetail.catalogLess")}</span>
                ) : null}
              </span>
              <span className="whitespace-nowrap font-semibold text-text">
                {t("orderDetail.itemsCount", { count: item.quantity })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t("orderDetail.noProducts")} />
      )}
      {comment ? (
        <div className="border-t border-border px-5 py-4">
          <OrderComment comment={comment} />
        </div>
      ) : null}
      {locked ? <LockNote>{t("productsLockReason", { ns: "newOrders" })}</LockNote> : null}
    </Card>
  );
};
