import { memo } from "react";
import type { OrderStatus } from "../../../entities/order/types/order";

interface Props {
    status: OrderStatus;
}

const STATUS_CONFIG: Record<
    OrderStatus,
    { label: string; bg: string; text: string; dot: string }
> = {
    created: { label: "Yaratildi", bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
    new: { label: "Yangi", bg: "bg-main/10", text: "text-main", dot: "bg-main" },
    received: { label: "Qabul qilindi", bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-600 dark:text-purple-400", dot: "bg-purple-500" },
    "on the road": { label: "Yo'lda", bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
    waiting: { label: "Kutmoqda", bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500" },
    sold: { label: "Sotildi", bg: "bg-green-50 dark:bg-green-900/20", text: "text-green-600 dark:text-green-400", dot: "bg-green-500" },
    cancelled: { label: "Bekor qilindi", bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
    paid: { label: "To'landi", bg: "bg-teal-50 dark:bg-teal-900/20", text: "text-teal-600 dark:text-teal-400", dot: "bg-teal-500" },
    partly_paid: { label: "Qisman to'landi", bg: "bg-cyan-50 dark:bg-cyan-900/20", text: "text-cyan-600 dark:text-cyan-400", dot: "bg-cyan-500" },
    closed: { label: "Yopildi", bg: "bg-gray-100 dark:bg-gray-800/40", text: "text-gray-500 dark:text-gray-400", dot: "bg-gray-400" },
};

const OrderStatusBadge = ({ status }: Props) => {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["new"];
    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
        </span>
    );
};

export default memo(OrderStatusBadge);
