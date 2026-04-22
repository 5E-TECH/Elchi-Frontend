import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { OrderStatus } from "../../../entities/order/types/order";

interface Props {
    status: OrderStatus;
}

const STATUS_CONFIG: Record<
    OrderStatus,
    { labelKey: string; bg: string; text: string; dot: string }
> = {
    created: { labelKey: "statusCreated", bg: "bg-linear-to-r from-sky-500 to-blue-500 shadow-sky-500/25", text: "text-white", dot: "bg-white" },
    new: { labelKey: "statusNew", bg: "bg-linear-to-r from-indigo-500 to-main shadow-main/25", text: "text-white", dot: "bg-white" },
    received: { labelKey: "statusReceived", bg: "bg-linear-to-r from-violet-500 to-fuchsia-500 shadow-violet-500/25", text: "text-white", dot: "bg-white" },
    "on the road": { labelKey: "statusOnTheRoad", bg: "bg-linear-to-r from-amber-400 to-orange-500 shadow-amber-500/25", text: "text-white", dot: "bg-white" },
    waiting: { labelKey: "statusWaiting", bg: "bg-linear-to-r from-orange-500 to-red-500 shadow-orange-500/25", text: "text-white", dot: "bg-white" },
    sold: { labelKey: "statusSold", bg: "bg-linear-to-r from-emerald-500 to-teal-500 shadow-emerald-500/25", text: "text-white", dot: "bg-white" },
    cancelled: { labelKey: "statusCancelled", bg: "bg-linear-to-r from-rose-500 to-pink-600 shadow-rose-500/25", text: "text-white", dot: "bg-white" },
    paid: { labelKey: "statusPaid", bg: "bg-linear-to-r from-teal-500 to-cyan-500 shadow-teal-500/25", text: "text-white", dot: "bg-white" },
    partly_paid: { labelKey: "statusPartlyPaid", bg: "bg-linear-to-r from-cyan-500 to-blue-500 shadow-cyan-500/25", text: "text-white", dot: "bg-white" },
    closed: { labelKey: "statusClosed", bg: "bg-linear-to-r from-slate-500 to-slate-700 shadow-slate-500/25", text: "text-white", dot: "bg-white" },
};

const OrderStatusBadge = ({ status }: Props) => {
    const { t } = useTranslation("orders");
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["new"];
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-extrabold shadow-lg ring-1 ring-white/12 ${cfg.bg} ${cfg.text}`}
        >
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} shadow-[0_0_10px_currentColor]`} />
            {t(cfg.labelKey)}
        </span>
    );
};

export default memo(OrderStatusBadge);
