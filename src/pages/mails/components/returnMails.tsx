import { memo, useMemo, useState } from "react";
import { Check, MapPin, Phone, RotateCcw, Truck, User, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMails, type MailItem } from "../../../entities/mails";
import Pagination from "../../../shared/components/pagination";
import { usePagination } from "../../../shared/lib/usePagination";

type ReturnGroup = {
  courierId: string;
  courierName: string;
  courierPhone: string;
  orders: MailItem[];
  totalAmount: number;
};

const formatPrice = (price: number, currencyLabel: string): string =>
  `${price.toLocaleString("uz-UZ")} ${currencyLabel}`;

const actionLabel = (value: string | undefined, t: (key: string) => string) => {
  const normalized = String(value ?? "").toLowerCase();

  if (normalized.includes("main") || normalized.includes("branch") || normalized.includes("center")) {
    return t("returnDestinationCenter");
  }

  if (normalized.includes("market")) {
    return t("returnDestinationMarket");
  }

  return t("returnDestinationCenter");
};

const getRequestId = (item: MailItem) =>
  item.request_id || item.order_id || item.id;

const buildReturnPayload = (items: MailItem[]) => {
  const requestIds = items.map((item) => item.request_id).filter(Boolean);
  const orderIds = items.map((item) => item.order_id).filter(Boolean);
  const postIds = Array.from(new Set(items.map((item) => item.post_id || item.id).filter(Boolean)));
  const ids = items.map(getRequestId).filter(Boolean);

  return {
    ids,
    request_ids: requestIds,
    requestIds,
    order_ids: orderIds,
    orderIds,
    post_ids: postIds,
    postIds,
  };
};

const groupByCourier = (items: MailItem[], courierFallback: string): ReturnGroup[] => {
  const groups = new Map<string, ReturnGroup>();

  items.forEach((item) => {
    const courierId = item.courier?.id || item.courier_id || "unknown";
    const courierName = item.courier?.name || courierFallback;
    const group = groups.get(courierId) ?? {
      courierId,
      courierName,
      courierPhone: item.courier?.phone_number || "",
      orders: [],
      totalAmount: 0,
    };

    group.orders.push(item);
    group.totalAmount += item.post_total_price;
    groups.set(courierId, group);
  });

  return Array.from(groups.values());
};

const ReturnMails = () => {
  const { t } = useTranslation("mails");
  const {
    useGetReturnMails,
    approveReturnRequests,
    rejectReturnRequests,
  } = useMails();
  const currencyLabel = t("currencyLabel");
  const { page, limit, setPage, setLimit } = usePagination({
    key: "mails",
    defaultLimit: 20,
  });
  const { data: response, isLoading, isError } = useGetReturnMails({ page, limit });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const requests: MailItem[] = response?.data?.data ?? [];
  const pagination = response?.data;
  const groups = useMemo(() => groupByCourier(requests, t("courierFallback")), [requests, t]);
  const selectedItems = useMemo(
    () => requests.filter((item) => selectedIds.has(getRequestId(item))),
    [requests, selectedIds],
  );
  const isMutating = approveReturnRequests.isPending || rejectReturnRequests.isPending;
  const totalOrders = requests.reduce((sum, item) => sum + Math.max(1, item.order_quantity || 1), 0);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleGroup = (group: ReturnGroup) => {
    const ids = group.orders.map(getRequestId);
    const allSelected = ids.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });
      return next;
    });
  };

  const toggleAll = () => {
    const ids = requests.map(getRequestId);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(ids));
  };

  const submit = async (type: "approve" | "reject") => {
    if (!selectedItems.length || isMutating) return;

    const payload = buildReturnPayload(selectedItems);
    if (type === "approve") {
      await approveReturnRequests.mutateAsync(payload);
    } else {
      await rejectReturnRequests.mutateAsync(payload);
    }
    setSelectedIds(new Set());
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-44 animate-pulse rounded-2xl bg-[color:var(--color-warning-soft)]" />
        ))}
      </div>
    );
  }

  if (isError || requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--color-warning-soft)]">
          <RotateCcw size={28} className="text-[color:var(--color-warning-end)]" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("returnEmptyDescription")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-glass-border bg-primary p-4 dark:bg-maindark">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-end)]">
            <RotateCcw size={23} />
          </div>
          <div>
            <p className="text-base font-black text-maindark dark:text-white">{t("returnRequestsTotal")}</p>
            <p className="text-sm text-maindark/55 dark:text-slate-400">
              {t("returnRequestsSummary", { couriers: groups.length, orders: totalOrders })}
            </p>
          </div>
        </div>
      </div>

      {groups.map((group) => {
        const groupIds = group.orders.map(getRequestId);
        const checkedCount = groupIds.filter((id) => selectedIds.has(id)).length;
        const groupChecked = checkedCount === groupIds.length && groupIds.length > 0;

        return (
          <div key={group.courierId} className="overflow-hidden rounded-2xl border border-glass-border bg-primary dark:bg-maindark">
            <div className="flex flex-col gap-3 border-b border-glass-border bg-[color:var(--color-warning-soft)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-warning-end)] text-white">
                  <Truck size={22} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-maindark dark:text-white">{group.courierName}</p>
                  <p className="text-sm text-maindark/55 dark:text-slate-400">
                    {t("returnGroupDescription", { count: group.orders.length })}
                    {group.courierPhone ? ` · ${group.courierPhone}` : ""}
                  </p>
                </div>
              </div>
              <p className="text-right text-sm font-black text-maindark dark:text-white">
                {formatPrice(group.totalAmount, currencyLabel)}
              </p>
            </div>

            <div className="divide-y divide-glass-border px-3 py-3">
              {group.orders.map((item) => {
                const id = getRequestId(item);
                const isChecked = selectedIds.has(id);
                const customerName = item.customer?.name || t("customerNumber", { id: item.customer?.id || item.order_id || item.id });
                const phone = item.customer?.phone_number || item.customer?.extra_number || t("phoneUnavailable");
                const location = [item.region?.name, item.district?.name].filter(Boolean).join(", ");

                return (
                  <label
                    key={id}
                    className="grid cursor-pointer grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-main/5 dark:hover:bg-white/5"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOne(id)}
                      className="h-4 w-4 rounded border-glass-border bg-transparent accent-main"
                    />
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-center gap-2 text-sm font-black text-maindark dark:text-white">
                        <User size={14} className="shrink-0 text-maindark/45 dark:text-slate-400" />
                        <span className="truncate">{customerName}</span>
                      </p>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-maindark/50 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Phone size={12} />
                          {phone}
                        </span>
                        {location ? (
                          <span className="flex min-w-0 items-center gap-1">
                            <MapPin size={12} className="shrink-0" />
                            <span className="truncate">{location}</span>
                          </span>
                        ) : null}
                        <span className="rounded-md bg-blue-500/15 px-2 py-0.5 font-semibold text-blue-400">
                          <Truck size={12} className="mr-1 inline" />
                          {actionLabel(item.action, t)}
                        </span>
                      </div>
                    </div>
                    <p className="shrink-0 text-right text-sm font-black text-maindark dark:text-white">
                      {formatPrice(item.post_total_price, currencyLabel)}
                    </p>
                  </label>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 border-t border-glass-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-maindark dark:text-white">
                <input
                  type="checkbox"
                  checked={groupChecked}
                  onChange={() => toggleGroup(group)}
                  className="h-4 w-4 rounded border-glass-border bg-transparent accent-main"
                />
                {t("checkboxSelectAll")}
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!checkedCount || isMutating}
                  onClick={() => submit("approve")}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Check size={16} />
                  {t("returnApprove")}
                </button>
                <button
                  type="button"
                  disabled={!checkedCount || isMutating}
                  onClick={() => submit("reject")}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <X size={16} />
                  {t("returnReject")}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex flex-col gap-3 rounded-2xl border border-glass-border bg-primary px-4 py-4 dark:bg-maindark sm:flex-row sm:items-center sm:justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-maindark dark:text-white">
          <input
            type="checkbox"
            checked={requests.length > 0 && requests.every((item) => selectedIds.has(getRequestId(item)))}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-glass-border bg-transparent accent-main"
          />
          {t("checkboxSelectAll")}
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!selectedItems.length || isMutating}
            onClick={() => submit("approve")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Check size={16} />
            {t("returnApprove")}
          </button>
          <button
            type="button"
            disabled={!selectedItems.length || isMutating}
            onClick={() => submit("reject")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <X size={16} />
            {t("returnReject")}
          </button>
        </div>
      </div>

      {pagination ? (
        <Pagination
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          currentPage={pagination.page}
          onPageChange={setPage}
          onItemsPerPageChange={setLimit}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      ) : null}
    </div>
  );
};

export default memo(ReturnMails);
