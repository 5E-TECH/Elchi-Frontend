import { memo, useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, FileText, Loader2, Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useBatchDetail,
  useBatchRemainingDetail,
  useReceiveTransferBatchOrders,
  type BatchDetail,
  type BatchOrder,
} from "../../../entities/batch";
import { useBranchDetail } from "../../../entities/branch";
import HeaderName from "../../../shared/components/headerName";
import { batchStatusClass, formatBatchMoney } from "../../batches/lib/batchFormat";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import { Checkbox, OrderCard, type ApiOrder } from "../components/OrderCard";
import BackButton from "../../../shared/ui/BackButton";
import { useOrderQrScanner } from "../../../shared/lib/useOrderQrScanner";
import { playMissingOrderFeedback, playScanFeedback } from "../../scan/lib/scanShared";
import { getBackendErrorMessage } from "../../scan/lib/scanResource";

const toOrderCardData = (order: BatchOrder, createdAt?: string): ApiOrder => ({
  id: order.id,
  qr_code_token: order.qr_code_token ?? null,
  status: String(order.status ?? "").toLowerCase(),
  where_deliver: order.where_deliver ?? "center",
  total_price: Number(order.price ?? 0),
  paid_amount: 0,
  to_be_paid: Number(order.price ?? 0),
  createdAt: createdAt || new Date().toISOString(),
  comment: null,
  address: order.address && order.address !== "—" ? order.address : null,
  items: [],
  customer: {
    id: order.id,
    name: order.receiver || "—",
    phone_number: order.phone || "—",
  },
});

const BranchBatchDetailPage = () => {
  const { branchId, batchId } = useParams<{ branchId: string; batchId: string }>();
  const { t } = useTranslation("newOrders");
  const { api } = useAppNotification();
  const receiveBatchOrders = useReceiveTransferBatchOrders();
  const detailQuery = useBatchDetail(batchId);
  const remainingQuery = useBatchRemainingDetail(batchId);
  const { data: branch } = useBranchDetail(branchId);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [receivedOrderIds, setReceivedOrderIds] = useState<Set<string>>(new Set());

  const data = useMemo<BatchDetail | undefined>(
    () => detailQuery.data ?? remainingQuery.data,
    [detailQuery.data, remainingQuery.data],
  );

  const isLoading = detailQuery.isLoading || remainingQuery.isLoading;
  const isError = detailQuery.isError && remainingQuery.isError;

  const orders = useMemo(
    () => (data?.orders ?? []).filter((order) => !receivedOrderIds.has(order.id)),
    [data?.orders, receivedOrderIds],
  );
  const isAllSelected = orders.length > 0 && selectedOrderIds.size === orders.length;

  const toggleOne = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const toggleAll = () => {
    if (isAllSelected) {
      setSelectedOrderIds(new Set());
      return;
    }
    setSelectedOrderIds(new Set(orders.map((order) => order.id)));
  };

  const markOrdersReceived = useCallback((ids: string[]) => {
    setReceivedOrderIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const refetchBatchData = useCallback(async () => {
    await Promise.all([detailQuery.refetch(), remainingQuery.refetch()]);
  }, [detailQuery, remainingQuery]);

  const handleAcceptSelectedOrders = () => {
    const ids = Array.from(selectedOrderIds);
    if (ids.length === 0 || receiveBatchOrders.isPending || !batchId) return;

    receiveBatchOrders.mutate(
      { batchId, orderIds: ids },
      {
        onSuccess: async () => {
          markOrdersReceived(ids);
          api.success({
            message: t("branchOrderReceiveSuccess"),
            description: t("branchOrderReceiveManyDescription", { count: ids.length }),
            placement: "topRight",
          });
          await refetchBatchData();
        },
        onError: (error: unknown) => {
          const msg = getBackendErrorMessage(error) ?? t("receiveError");
          api.error({
            message: t("receiveError"),
            description: msg,
            placement: "topRight",
          });
        },
      },
    );
  };

  const handleMissingScannedOrder = useCallback(() => {
    playMissingOrderFeedback();
    api.warning({
      message: t("qrNotFound"),
      description: t("branchOrderScanMissing"),
      placement: "topRight",
      duration: 3,
    });
  }, [api, t]);

  const selectScannedOrder = useCallback((order: BatchOrder) => {
    setSelectedOrderIds((prev) => {
      if (prev.has(order.id)) {
        void playScanFeedback("duplicate", t("common:scannerFeedbackDuplicate"));
        api.warning({
          message: t("common:scannerFeedbackDuplicate"),
          description: `#${order.id}`,
          placement: "topRight",
          duration: 2,
        });
        return prev;
      }
      const next = new Set(prev);
      next.add(order.id);
      void playScanFeedback("success");
      return next;
    });
  }, [api, t]);

  const translatedBatchStatus = data ? t(`batchStatus.${data.status}`) : "";
  const translatedBatchDirection = data ? t(`batchDirection.${data.direction}`) : "";
  const branchName = branch?.name || data?.from_branch?.name || `Filial #${branchId}`;

  useOrderQrScanner({
    orders,
    enabled: orders.length > 0 && !receiveBatchOrders.isPending,
    onMatch: selectScannedOrder,
    onMissing: handleMissingScannedOrder,
  });

  const totalSum = orders.reduce((sum, order) => sum + Number(order.price ?? 0), 0);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl">
      <div className="py-3 pb-3 sm:py-4 sm:pb-4 md:py-6 md:pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <BackButton to={`/new-orders/branches/${branchId}`} className="mt-1 h-10 min-w-10 shrink-0 rounded-xl px-2" label="" />
            <div className="group relative min-w-0 overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-elevated)] p-3 shadow-sm dark:bg-[color:var(--color-surface-elevated-dark)] sm:p-4">
              <div className="pointer-events-none absolute -left-6 top-1/2 h-14 w-14 -translate-y-1/2 rounded-full bg-main/12 blur-xl transition-all duration-300 group-hover:bg-main/18" />
              <HeaderName
                name={`${branchName} orderlari`}
                description={`Jami orderlar • ${formatBatchMoney(totalSum)}`}
                icon={<Package />}
              />
            </div>
          </div>

          {data ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-3 text-xs font-semibold text-[color:var(--color-text-muted)] dark:bg-primarydark lg:justify-end">
              <span className={`inline-flex rounded-full border px-3 py-1 ${batchStatusClass[data.status]}`}>
                {translatedBatchStatus}
              </span>
              <span>{t("branchInfoDirection")}: {translatedBatchDirection}</span>
              <span>{t("branchInfoOrders")}: {t("branchInfoOrderCount", { count: data.orders_count })}</span>
              <span>{t("branchInfoAmount")}: {formatBatchMoney(data.total_price)}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-gray-200 bg-white px-3 py-3 dark:border-white/5 dark:bg-maindark sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div onClick={toggleAll} className="flex cursor-pointer items-center gap-3">
            <Checkbox checked={isAllSelected} onChange={toggleAll} />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {isAllSelected ? t("deselectAll") : t("selectAll")}
            </span>
          </div>
          {selectedOrderIds.size > 0 ? (
            <span className="rounded-lg bg-main px-2.5 py-1 text-xs font-bold text-white">
              {t("selectedCount", { count: selectedOrderIds.size })}
            </span>
          ) : null}
        </div>
      </div>

      {isError ? (
        <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 p-6 text-center text-sm font-semibold text-rose-700 dark:text-rose-100">
          {t("branchBatchLoadError")}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-24 sm:pb-28 md:pb-4">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-main/20 border-t-main" />
          </div>
        ) : orders.length > 0 ? (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={toOrderCardData(order, data?.created_at)}
              isSelected={selectedOrderIds.has(order.id)}
              onToggle={() => toggleOne(order.id)}
              showCheckbox
              showOrderId={false}
            />
          ))
        ) : (
          <div className="flex h-64 flex-col items-center justify-center text-gray-300 dark:text-gray-700">
            <FileText size={48} className="mb-4 opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest opacity-50">{t("branchOrdersEmpty")}</p>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-gray-100 bg-transparent py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] dark:border-white/5 sm:py-4">
        <button
          type="button"
          disabled={selectedOrderIds.size === 0 || receiveBatchOrders.isPending}
          onClick={handleAcceptSelectedOrders}
          className={`flex w-full items-center justify-center gap-3 rounded-2xl py-3.5 text-sm font-bold text-white transition-all sm:py-4 sm:text-base
            bg-linear-to-r from-emerald-500 to-emerald-400 shadow-xl shadow-emerald-500/30
            hover:shadow-emerald-500/50 hover:-translate-y-0.5 active:translate-y-0
            disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0
            ${selectedOrderIds.size > 0 ? "cursor-pointer opacity-100" : "opacity-40"}`}
        >
          {receiveBatchOrders.isPending ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
          {receiveBatchOrders.isPending
            ? t("receiving")
            : t("receiveOrdersShort", { count: selectedOrderIds.size })}
        </button>
      </div>
    </div>
  );
};

export default memo(BranchBatchDetailPage);
