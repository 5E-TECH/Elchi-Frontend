import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { OrderStatus } from "../../../entities/order/types/order";
import { getStatusColor } from "../../../shared/config/statusColorMap";

interface Props {
    status: OrderStatus;
}

const STATUS_CONFIG: Record<
    OrderStatus,
    { labelKey: string; colorKey: string }
> = {
    created: { labelKey: "statusCreated", colorKey: "created" },
    new: { labelKey: "statusNew", colorKey: "new" },
    received: { labelKey: "statusReceived", colorKey: "received" },
    "on the road": { labelKey: "statusOnTheRoad", colorKey: "on_the_road" },
    waiting: { labelKey: "statusWaiting", colorKey: "waiting" },
    sold: { labelKey: "statusSold", colorKey: "sold" },
    cancelled: { labelKey: "statusCancelled", colorKey: "cancelled" },
    "cancelled (sent)": { labelKey: "statusCancelled", colorKey: "cancelled" },
    paid: { labelKey: "statusPaid", colorKey: "paid" },
    partly_paid: { labelKey: "statusPartlyPaid", colorKey: "partly_paid" },
    closed: { labelKey: "statusClosed", colorKey: "closed" },
};

const OrderStatusBadge = ({ status }: Props) => {
    const { t } = useTranslation("orders");
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["new"];
    const colors = getStatusColor(cfg.colorKey);

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold ${colors.bg} ${colors.text} ${colors.border}`}
        >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {t(cfg.labelKey)}
        </span>
    );
};

export default memo(OrderStatusBadge);
