import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Table } from "../../../../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../../../../shared/components/Table/Table.types";
import { Calendar, MapPin, Phone, Store, User } from "lucide-react";
import type { Order } from "./pendingOrderTable";
import OrderStatusBadge from "../../../OrderStatusBadge";

type Props = {
  orders: Order[];
  loading?: boolean;
  onRowClick?: (order: Order) => void;
  selectedIds: Set<string>;
  onSelectChange: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
};

const CancelledOrdersTable = ({
  orders,
  loading,
  onRowClick,
  selectedIds,
  onSelectChange,
  onSelectAll,
}: Props) => {
  const { t, i18n } = useTranslation("orders");
  const locale = i18n.language === "ru" ? "ru-RU" : i18n.language === "en" ? "en-US" : "uz-UZ";
  const formatMoney = (value: number) => `${value.toLocaleString(locale)} ${t("currency")}`;
  const allChecked = orders.length > 0 && orders.every((o) => selectedIds.has(o.id));
  const someChecked = orders.some((o) => selectedIds.has(o.id));
  const formatDate = (value: string) =>
    new Date(value).toLocaleString("uz-UZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const renderSelectAllCheckbox = () => (
    <input
      type="checkbox"
      checked={allChecked}
      ref={(el) => {
        if (el) el.indeterminate = someChecked && !allChecked;
      }}
      onChange={(e) => onSelectAll(e.target.checked)}
      className="h-4 w-4 cursor-pointer accent-red-500"
    />
  );

  const columns: ColumnConfig<Order>[] = useMemo(
    () => [
      {
        key: "id",
        label: t("selectLabel"),
        renderHeader: () => renderSelectAllCheckbox(),
        width: "40px",
        render: (_, row) => (
          <input
            type="checkbox"
            checked={selectedIds.has(row.id)}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              onSelectChange(row.id, e.target.checked);
            }}
            className="w-4 h-4 accent-red-500 cursor-pointer"
          />
        ),
      },
      {
        key: "id",
        label: "#",
        width: "50px",
        render: (_, __, rowIndex) => (
          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            {(rowIndex ?? 0) + 1}
          </span>
        ),
      },
      {
        key: "customer",
        label: t("customer"),
        render: (_, row) => (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shrink-0">
              <User size={14} className="text-white" />
            </div>
            <span className="font-semibold text-sm">{row.customer?.name ?? "—"}</span>
          </div>
        ),
      },
      {
        key: "customer",
        label: t("phone"),
        render: (_, row) => (
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {row.customer?.phone_number ?? "—"}
          </span>
        ),
      },
      {
        key: "district",
        label: t("location"),
        render: (_, row) => <span className="text-sm">{row.district?.name ?? "—"}</span>,
      },
      {
        key: "market",
        label: t("market"),
        render: (_, row) => (
          <span className="text-sm font-medium">{row.market?.name ?? "—"}</span>
        ),
      },
      {
        key: "status",
        label: t("orderStatus"),
        render: () => <OrderStatusBadge status="cancelled" />,
      },
      {
        key: "total_price",
        label: t("price"),
        sortable: true,
        render: (val) => (
          <span className="font-bold text-sm">
            {formatMoney(Number(val))}
          </span>
        ),
      },
      {
        key: "where_deliver",
        label: t("deliveryWhere"),
        render: (val) => (
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              val === "center"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
            }`}
          >
            {val === "center" ? t("deliveryToCenter") : t("deliveryToHome")}
          </span>
        ),
      },
      {
        key: "created_at",
        label: t("date"),
        sortable: true,
        render: (val) => (
          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
            {new Date(val as string).toLocaleString("uz-UZ", {
              day: "2-digit", month: "2-digit", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </span>
        ),
      },
    ],
    [selectedIds, allChecked, someChecked, onSelectChange, onSelectAll, t, locale]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-2xl border border-border-soft bg-primary px-4 py-3 dark:border-primarydark/60 dark:bg-maindark xl:hidden">
        <span className="text-sm font-semibold text-maindark dark:text-primary">
          {t("selectAll")}
        </span>
        {renderSelectAllCheckbox()}
      </div>

      <Table
        data={orders}
        columns={columns}
        keyExtractor={(row) => row.id}
        loading={loading}
        emptyMessage={t("cancelledOrdersEmpty")}
        onRowClick={onRowClick}
        mobileRowRender={(row) => (
          <div
            className={`rounded-xl border p-3 ${
              selectedIds.has(row.id)
                ? "border-emerald-400/60 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]"
                : "border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/4"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.has(row.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    onSelectChange(row.id, e.target.checked);
                  }}
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-red-500"
                />
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm font-bold text-slate-900 dark:text-white">{row.customer?.name ?? "—"}</p>
                  <p className="m-0 mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-white/70">
                    <Phone size={12} className="shrink-0" />
                    <span className="truncate">{row.customer?.phone_number ?? "—"}</span>
                  </p>
                </div>
              </div>
              <OrderStatusBadge status="cancelled" />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:bg-white/10 dark:text-white/85">
                <Store size={11} className="shrink-0" />
                <span className="truncate">{row.market?.name ?? "—"}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:bg-white/10 dark:text-white/85">
                <MapPin size={11} className="shrink-0" />
                <span className="truncate">{row.district?.name ?? "—"}</span>
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ${
                  row.where_deliver === "center"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200"
                }`}
              >
                {row.where_deliver === "center" ? t("deliveryToCenter") : t("deliveryToHome")}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-base font-bold text-slate-900 dark:text-white">
                {formatMoney(Number(row.total_price))}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-white/65">
                <Calendar size={11} className="shrink-0" />
                {formatDate(row.created_at)}
              </span>
            </div>
          </div>
        )}
      />
    </div>
  );
};

export default memo(CancelledOrdersTable);
