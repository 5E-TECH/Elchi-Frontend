import { memo, useMemo } from "react";
import {
    Package,
    MapPin,
    Store,
    Calendar,
    Banknote,
    Phone,
    Home,
    Truck,
    ChevronRight,
} from "lucide-react";
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
    rowNumberOffset?: number;
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

const createColumns = (rowNumberOffset: number) => [
    {
        key: "id" as const,
        label: "#",
        width: "50px",
        render: (_: any, _row: OrderListItem, i: number) => (
            <span className="text-xs font-semibold text-gray-400">{rowNumberOffset + i + 1}</span>
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

const OrdersTable = ({ data, isLoading, onRowClick, rowNumberOffset = 0 }: Props) => {
    const { t } = useTranslation("orders");
    const role = useSelector((state: RootState) => state.role.role);
    const tableColumns = useMemo(() => {
        const translatedColumns = createColumns(rowNumberOffset).map((column) => {
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
    }, [role, rowNumberOffset, t]);

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
            <div className="rounded-2xl border border-[color:var(--color-border-strong)] bg-primary px-6 py-20 shadow-sm dark:border-primarydark/60 dark:bg-white/[0.025]">
                <div className="flex flex-col items-center justify-center gap-4 text-gray-400">
                    <div className="w-16 h-16 rounded-2xl border border-[color:var(--color-border-soft)] bg-main/10 flex items-center justify-center dark:border-white/10">
                    <Package size={28} className="text-main/50" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-semibold text-gray-500 dark:text-gray-300">{t("ordersNotFound")}</p>
                        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-400">{t("ordersEmptyHint")}</p>
                    </div>
                </div>
            </div>
        );
    }

    const renderMobileCard = (order: OrderListItem, index: number) => (
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-transform active:scale-[0.98] dark:border-primarydark/70 dark:bg-primarydark/70">
            <div className="mb-3 flex items-center justify-between">
                <OrderStatusBadge status={order.status} />
                <span className="text-xs text-gray-400">#{rowNumberOffset + index + 1}</span>
            </div>

            <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-main to-primarydark text-white">
                    <span className="text-sm font-bold">
                        {order.customer?.name?.[0]?.toUpperCase() ?? "?"}
                    </span>
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-bold text-maindark dark:text-primary">
                        {order.customer?.name ?? "—"}
                    </h3>
                    <a
                        href={`tel:${order.customer?.phone_number ?? ""}`}
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-main dark:text-gray-300 dark:hover:text-main"
                    >
                        <Phone size={14} className="shrink-0 text-emerald-500" />
                        <span>{formatPhoneNumber(order.customer?.phone_number)}</span>
                    </a>
                </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                    <MapPin size={14} className="shrink-0 text-main/70" />
                    <span className="truncate">{order.district?.name ?? "—"}</span>
                </div>
                {role !== "market" && (
                    <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                        <Store size={14} className="shrink-0 text-main/70" />
                        <span className="truncate">{order.market?.name ?? "—"}</span>
                    </div>
                )}
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                    <Calendar size={14} className="shrink-0 text-main/70" />
                    <span className="truncate">{formatDate(order.createdAt)}</span>
                </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-primarydark/70">
                <div className="flex items-center gap-4">
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t("price")}</p>
                        <p className="font-bold text-maindark dark:text-primary">
                            {formatPrice(order.total_price)}
                        </p>
                    </div>

                    <div className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 dark:bg-primarydark">
                        {order.where_deliver === "address" ? (
                            <Home size={14} className="text-amber-500" />
                        ) : (
                            <Truck size={14} className="text-sky-500" />
                        )}
                        <span className="text-xs text-gray-600 dark:text-gray-300">
                            {order.where_deliver === "center" ? t("deliveryCenter") : t("deliveryHome")}
                        </span>
                    </div>
                </div>

                <ChevronRight size={18} className="text-gray-400" />
            </div>
        </div>
    );

    return (
        <Table
            data={data}
            columns={tableColumns as any}
            keyExtractor={(row) => row.id}
            loading={false}
            onRowClick={onRowClick}
            mobileRowRender={renderMobileCard}
            striped
            hoverable
            bordered
        />
    );
};

export default memo(OrdersTable);
