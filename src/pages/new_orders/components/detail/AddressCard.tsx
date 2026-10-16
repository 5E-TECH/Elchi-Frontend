// dizayn-v2: superadmin-orders-detail, admin-orders-detail, manager-orders-detail, registrator-orders-detail, market-orders-detail
import { useTranslation } from "react-i18next";
import { Badge, Card } from "../../../../shared/ui/primitives";
import { getDeliveryLabelKey } from "../../../orders/list/courier/list/orderActionModel";
import { EditButton } from "./EditButton";
import { getDistrictName, getRegionName, type OrderDetail } from "./orderDetailModel";

type AddressCardProps = {
  order: OrderDetail;
  /** Tahrirlash tugmasi (superadmin, admin, registrator, menejer). */
  editable?: boolean;
  /** Filialga jo'natilgan — tugma o'chiq. */
  locked?: boolean;
  lockDescribedBy?: string;
  onEdit?: () => void;
  /** `market-orders-detail`: birinchi qator «Yetkazish turi» (mahsulotlar kartasida emas). */
  showDelivery?: boolean;
  className?: string;
};

/** «Manzil» (`.el-kv`, 120px ustun): viloyat, tuman, manzil; bo'sh qiymat — «—». */
export const AddressCard = ({
  order,
  editable = false,
  locked = false,
  lockDescribedBy,
  onEdit,
  showDelivery = false,
  className,
}: AddressCardProps) => {
  const { t } = useTranslation(["orders", "newOrders"]);
  const deliveryKey = getDeliveryLabelKey(order.where_deliver);
  const rows = [
    { label: t("region", { ns: "newOrders" }), value: getRegionName(order) },
    { label: t("district", { ns: "newOrders" }), value: getDistrictName(order) },
    { label: t("address", { ns: "newOrders" }), value: order.address?.trim() || null },
  ];

  return (
    <Card
      title={t("addressTitle", { ns: "newOrders" })}
      className={className}
      actions={
        editable ? (
          <EditButton
            label={t("editAddress", { ns: "newOrders" })}
            onClick={() => onEdit?.()}
            disabled={locked}
            reason={t("destinationLockReason", { ns: "newOrders" })}
            describedBy={lockDescribedBy}
          />
        ) : undefined
      }
    >
      <dl className="m-0 grid grid-cols-[120px_1fr] gap-x-4 gap-y-2.5 text-sm">
        {showDelivery && deliveryKey ? (
          <>
            <dt className="self-center text-text-muted">{t("deliveryType", { ns: "newOrders" })}</dt>
            <dd className="m-0 self-center">
              <Badge>{t(deliveryKey)}</Badge>
            </dd>
          </>
        ) : null}
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-text-muted">{row.label}</dt>
            <dd className="m-0 min-w-0 font-semibold wrap-break-word text-text">{row.value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
};
