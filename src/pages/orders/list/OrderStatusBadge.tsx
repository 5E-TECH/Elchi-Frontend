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
    created: { labelKey: "statusCreated", bg: "bg-blue-600 dark:bg-blue-500/28", text: "text-white dark:text-blue-100", dot: "bg-blue-100 dark:bg-blue-200" },
    new: { labelKey: "statusNew", bg: "bg-main dark:bg-main/34", text: "text-white dark:text-primary", dot: "bg-white dark:bg-primary" },
    received: { labelKey: "statusReceived", bg: "bg-violet-600 dark:bg-violet-500/28", text: "text-white dark:text-violet-100", dot: "bg-violet-100 dark:bg-violet-200" },
    "on the road": { labelKey: "statusOnTheRoad", bg: "bg-amber-500 dark:bg-amber-500/30", text: "text-white dark:text-amber-100", dot: "bg-amber-100 dark:bg-amber-200" },
    waiting: { labelKey: "statusWaiting", bg: "bg-orange-600 dark:bg-orange-500/30", text: "text-white dark:text-orange-100", dot: "bg-orange-100 dark:bg-orange-200" },
    sold: { labelKey: "statusSold", bg: "bg-emerald-600 dark:bg-emerald-500/30", text: "text-white dark:text-emerald-100", dot: "bg-emerald-100 dark:bg-emerald-200" },
    cancelled: { labelKey: "statusCancelled", bg: "bg-rose-600 dark:bg-rose-500/30", text: "text-white dark:text-rose-100", dot: "bg-rose-100 dark:bg-rose-200" },
    paid: { labelKey: "statusPaid", bg: "bg-teal-600 dark:bg-teal-500/30", text: "text-white dark:text-teal-100", dot: "bg-teal-100 dark:bg-teal-200" },
    partly_paid: { labelKey: "statusPartlyPaid", bg: "bg-cyan-600 dark:bg-cyan-500/30", text: "text-white dark:text-cyan-100", dot: "bg-cyan-100 dark:bg-cyan-200" },
    closed: { labelKey: "statusClosed", bg: "bg-slate-600 dark:bg-slate-500/30", text: "text-white dark:text-slate-100", dot: "bg-slate-100 dark:bg-slate-200" },
};

const OrderStatusBadge = ({ status }: Props) => {
    const { t } = useTranslation("orders");
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["new"];
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ${cfg.bg} ${cfg.text}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {t(cfg.labelKey)}
        </span>
    );
};

export default memo(OrderStatusBadge);
