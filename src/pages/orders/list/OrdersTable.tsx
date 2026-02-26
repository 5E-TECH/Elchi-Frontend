import { memo } from "react";
import { Package, MapPin, Store, Calendar, Banknote } from "lucide-react";
import { Table } from "../../../shared/components/Table/Table";
import OrderStatusBadge from "./OrderStatusBadge";
import type { OrderListItem } from "../../../entities/order/types/order";

interface Props {
    data: OrderListItem[];
    isLoading: boolean;
    onRowClick?: (order: OrderListItem) => void;
}

const formatPrice = (num: number) =>
    (num ?? 0).toLocaleString("uz-UZ") + " so'm";

const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("uz-UZ", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const columns = [
    {
        key: "id" as const,
        label: "#",
        width: "50px",
        render: (_: any, _row: OrderListItem, i: number) => (
            <span className="text-xs font-semibold text-gray-400">{i + 1}</span>
        ),
    },
    {
        key: "customer" as const,
        label: "Mijoz",
        render: (customer: OrderListItem["customer"]) => (
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-main/10 flex items-center justify-center shrink-0">
                    <span className="text-main text-xs font-bold">
                        {customer?.name?.[0]?.toUpperCase() ?? "?"}
                    </span>
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-maindark dark:text-primary truncate">
                        {customer?.name ?? "—"}
                    </p>
                    <p className="text-xs text-gray-400 font-mono">
                        {customer?.phone_number ?? ""}
                    </p>
                </div>
            </div>
        ),
    },
    {
        key: "district" as const,
        label: "Tuman / Viloyat",
        render: (district: OrderListItem["district"]) => (
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                <MapPin size={12} className="shrink-0 text-main/60" />
                <div className="min-w-0">
                    <p className="text-xs font-medium text-maindark dark:text-primary truncate">
                        {district?.name ?? "—"}
                    </p>
                    {district?.region?.name && (
                        <p className="text-[11px] text-gray-400 truncate">
                            {district.region.name}
                        </p>
                    )}
                </div>
            </div>
        ),
    },
    {
        key: "market" as const,
        label: "Market",
        render: (market: OrderListItem["market"]) => (
            <div className="flex items-center gap-1.5">
                <Store size={13} className="text-main/60 shrink-0" />
                <span className="text-sm font-medium text-maindark dark:text-primary">
                    {market?.name ?? "—"}
                </span>
            </div>
        ),
    },
    {
        key: "status" as const,
        label: "Holat",
        render: (status: OrderListItem["status"]) => (
            <OrderStatusBadge status={status} />
        ),
    },
    {
        key: "where_deliver" as const,
        label: "Yetkazish",
        render: (val: OrderListItem["where_deliver"]) => (
            <span className={`text-xs font-medium px-2 py-1 rounded-lg ${val === "center"
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    : "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                }`}>
                {val === "center" ? "Markaz" : "Uy"}
            </span>
        ),
    },
    {
        key: "total_price" as const,
        label: "Summa",
        sortable: true as const,
        render: (val: number) => (
            <div className="flex items-center gap-1.5">
                <Banknote size={13} className="text-main/60 shrink-0" />
                <span className="text-sm font-semibold text-maindark dark:text-primary font-mono whitespace-nowrap">
                    {formatPrice(val)}
                </span>
            </div>
        ),
    },
    {
        key: "createdAt" as const,
        label: "Sana",
        sortable: true as const,
        render: (val: string) => (
            <div className="flex items-center gap-1.5 text-gray-400">
                <Calendar size={12} className="shrink-0" />
                <span className="text-xs whitespace-nowrap">{formatDate(val)}</span>
            </div>
        ),
    },
];

const OrdersTable = ({ data, isLoading, onRowClick }: Props) => {
    if (isLoading) {
        return (
            <div className="flex flex-col gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div
                        key={i}
                        className="h-16 rounded-xl bg-gray-100 dark:bg-primarydark animate-pulse"
                        style={{ opacity: 1 - i * 0.1 }}
                    />
                ))}
            </div>
        );
    }

    if (!data.length) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-400">
                <div className="w-16 h-16 rounded-2xl bg-main/10 flex items-center justify-center">
                    <Package size={28} className="text-main/50" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-semibold text-gray-500">Buyurtmalar topilmadi</p>
                    <p className="text-xs mt-0.5">Filtrlarni o'zgartiring yoki yangi buyurtma qo'shing</p>
                </div>
            </div>
        );
    }

    return (
        <Table
            data={data}
            columns={columns as any}
            keyExtractor={(row) => row.id}
            loading={false}
            onRowClick={onRowClick}
            striped
            hoverable
            bordered
        />
    );
};

export default memo(OrdersTable);
