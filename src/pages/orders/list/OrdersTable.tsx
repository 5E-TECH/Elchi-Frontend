import { memo, useMemo } from "react";
import { Package, MapPin, Store, Calendar, Banknote } from "lucide-react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Table } from "../../../shared/components/Table/Table";
import OrderStatusBadge from "./OrderStatusBadge";
import type { OrderListItem } from "../../../entities/order/types/order";
import type { RootState } from "../../../app/config/store";

interface Props {
    data: OrderListItem[];
    isLoading: boolean;
    onRowClick?: (order: OrderListItem) => void;
}

const formatPhoneNumber = (phone: string | null | undefined) => {
    if (!phone) return "";

    const normalized = phone.replace(/\D/g, "");

    if (normalized.startsWith("998") && normalized.length >= 12) {
        return `+998 ${normalized.slice(3, 5)} ${normalized.slice(5, 8)} ${normalized.slice(8, 10)} ${normalized.slice(10, 12)}`;
    }

    if (normalized.length === 9) {
        return `${normalized.slice(0, 2)} ${normalized.slice(2, 5)} ${normalized.slice(5, 7)} ${normalized.slice(7, 9)}`;
    }

    return phone;
};

const formatPrice = (num: number) =>
    (num ?? 0).toLocaleString("uz-UZ") + " so'm";

const getDeliveryBadgeClassName = (value: OrderListItem["where_deliver"]) =>
    value === "center"
        ? "bg-linear-to-r from-blue-500 to-sky-500 text-white shadow-blue-500/25"
        : "bg-linear-to-r from-emerald-500 to-green-500 text-white shadow-emerald-500/25";

const DeliveryBadge = ({ value, label }: { value: OrderListItem["where_deliver"]; label: string }) => (
    <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-extrabold shadow-lg ring-1 ring-white/12 ${getDeliveryBadgeClassName(value)}`}>
        {label}
    </span>
);

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
        sortable: true as const,
        sortValue: (row: OrderListItem) => row.customer?.name?.trim().toLocaleLowerCase() ?? "",
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
                        {formatPhoneNumber(customer?.phone_number)}
                    </p>
                </div>
            </div>
        ),
    },
    {
        key: "district" as const,
        label: "Tuman / Viloyat",
        render: (district: OrderListItem["district"]) => (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <MapPin size={14} className="shrink-0 text-main/70" />
                <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-maindark dark:text-primary truncate">
                        {district?.name ?? "—"}
                    </p>
                    {district?.region?.name && (
                        <p className="text-[13px] font-medium text-gray-600 dark:text-gray-300/90 truncate">
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
            <DeliveryBadge value={val} label={val === "center" ? "Markaz" : "Uy"} />
        ),
    },
    {
        key: "total_price" as const,
        label: "Summa",
        sortable: true as const,
        sortValue: (row: OrderListItem) => row.total_price ?? 0,
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
        sortValue: (row: OrderListItem) => new Date(row.createdAt).getTime(),
        render: (val: string) => (
            <div className="flex items-center gap-2">
                <Calendar size={14} className="shrink-0 text-gray-600 dark:text-gray-300/80" />
                <span className="whitespace-nowrap text-[13px] font-medium text-gray-700 dark:text-gray-200">
                    {formatDate(val)}
                </span>
            </div>
        ),
    },
];

const OrdersTable = ({ data, isLoading, onRowClick }: Props) => {
    const { t } = useTranslation("orders");
    const role = useSelector((state: RootState) => state.role.role);
    const tableColumns = useMemo(() => {
        const translatedColumns = columns.map((column) => {
            if (column.key === "customer") return { ...column, label: t("customer") };
            if (column.key === "district") return { ...column, label: t("filterRegion") + " / " + t("district") };
            if (column.key === "market") return { ...column, label: t("market") };
            if (column.key === "status") return { ...column, label: t("orderStatus") };
            if (column.key === "where_deliver") {
                return {
                    ...column,
                    label: t("deliveryType"),
                    render: (val: OrderListItem["where_deliver"]) => (
                        <DeliveryBadge
                            value={val}
                            label={val === "center" ? t("deliveryCenter") : t("deliveryHome")}
                        />
                    ),
                };
            }
            if (column.key === "total_price") return { ...column, label: t("sumLabel") };
            if (column.key === "createdAt") return { ...column, label: t("date") };
            return column;
        });
        if (role === "market") {
            return translatedColumns.filter((column) => column.key !== "market");
        }

        return translatedColumns;
    }, [role, t]);

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
                    <p className="text-sm font-semibold text-gray-500">{t("ordersNotFound")}</p>
                    <p className="text-xs mt-0.5">{t("ordersEmptyHint")}</p>
                </div>
            </div>
        );
    }

    return (
        <Table
            data={data}
            columns={tableColumns as any}
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
