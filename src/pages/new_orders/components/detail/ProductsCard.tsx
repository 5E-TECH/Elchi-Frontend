// dizayn-v2: superadmin-orders-detail, admin-orders-detail, manager-orders-detail, registrator-orders-detail, market-orders-detail
import { Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ProductThumb } from "../../../../entities/product/ui/ProductThumb";
import { getOrderItemName } from "../../../../shared/lib/orderItemName";
import { Badge, Card, DataTable, EmptyState, type DataTableColumn } from "../../../../shared/ui/primitives";
import { getDeliveryLabelKey } from "../../../orders/list/courier/list/orderActionModel";
import { EditButton } from "./EditButton";
import { OrderComment } from "./OrderComment";
import { getProductImageUrl, isCatalogLessItem, type OrderDetail, type OrderDetailItem } from "./orderDetailModel";

type ProductsCardProps = {
  order: OrderDetail;
  /** «Tahrirlash» (superadmin, admin, registrator, menejer). */
  editable?: boolean;
  /** HQ qabul qilgan — mahsulot va summa qulflangan. */
  locked?: boolean;
  lockDescribedBy?: string;
  onEdit?: () => void;
  /** Pastki qismdagi «Yetkazish turi» (marketda u «Manzil» kartasida). */
  showDelivery?: boolean;
  className?: string;
};

/**
 * «Mahsulotlar» — sarlavha yonida son, jadval «Mahsulot | Soni» (`DataTable`, telefonda ham jadval —
 * maketdagidek), pastda yetkazish turi va izoh. Katalogsiz qator ostida «Katalogdan tashqari».
 */
export const ProductsCard = ({
  order,
  editable = false,
  locked = false,
  lockDescribedBy,
  onEdit,
  showDelivery = true,
  className,
}: ProductsCardProps) => {
  const { t } = useTranslation(["orders", "newOrders"]);
  const deliveryKey = getDeliveryLabelKey(order.where_deliver);
  const comment = order.comment?.trim() ?? "";
  const productLabel = t("product", { ns: "newOrders" });

  const columns: DataTableColumn<OrderDetailItem>[] = [
    {
      id: "product",
      header: productLabel,
      cell: (item) => (
        <div className="flex min-w-0 items-center gap-3">
          <ProductThumb imageUrl={getProductImageUrl(item)} />
          <div className="min-w-0">
            <div className="font-semibold wrap-break-word text-text">
              {getOrderItemName(item, t("productFallback", { ns: "newOrders" }))}
            </div>
            {isCatalogLessItem(item) ? (
              <div className="text-xs text-text-muted">{t("orderDetail.catalogLess")}</div>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: "quantity",
      header: t("quantity", { ns: "newOrders" }),
      align: "end",
      cell: (item) => (
        <span className="whitespace-nowrap font-semibold">{t("orderDetail.itemsCount", { count: item.quantity })}</span>
      ),
    },
  ];

  const hasFooter = (showDelivery && deliveryKey) || comment;

  return (
    <Card
      title={t("orderDetail.products")}
      titleAddon={<Badge>{t("orderDetail.itemsCount", { count: order.items.length })}</Badge>}
      padding="none"
      className={className}
      actions={
        editable ? (
          <EditButton
            label={t("editOrder", { ns: "newOrders" })}
            onClick={() => onEdit?.()}
            disabled={locked}
            reason={t("productsLockReason", { ns: "newOrders" })}
            describedBy={lockDescribedBy}
          />
        ) : undefined
      }
    >
      {order.items.length > 0 ? (
        <DataTable
          rows={order.items}
          columns={columns}
          getRowKey={(item) => item.id}
          label={t("orderDetail.products")}
        />
      ) : (
        <EmptyState icon={Package} title={t("orderDetail.noProducts")} />
      )}
      {hasFooter ? (
        <div className="flex flex-col gap-4 border-t border-border px-5 py-4">
          {showDelivery && deliveryKey ? (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
              <span className="text-text-muted">{t("deliveryType", { ns: "newOrders" })}</span>
              <Badge>{t(deliveryKey)}</Badge>
            </div>
          ) : null}
          {/* Faqat bo'shliq yoki "\n" dan iborat izoh chiqmaydi. */}
          {comment ? <OrderComment comment={comment} /> : null}
        </div>
      ) : null}
    </Card>
  );
};
