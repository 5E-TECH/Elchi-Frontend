import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useBatchDetail,
  useBatchRemainingDetail,
  useReceiveTransferBatchOrders,
  type BatchDetail,
  type BatchOrder,
} from "../../../entities/batch";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import HeaderName from "../../../shared/components/headerName";
import { batchStatusClass, formatBatchMoney } from "../../batches/lib/batchFormat";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import { Checkbox } from "../components/OrderCard";
import BackButton from "../../../shared/ui/BackButton";
import { useOrderQrScanner } from "../../../shared/lib/useOrderQrScanner";
import { playMissingOrderFeedback, playScanFeedback } from "../../scan/lib/scanShared";
import { getBackendErrorMessage } from "../../scan/lib/scanResource";

const BranchBatchDetailPage = () => {
  const { branchId, batchId } = useParams<{ branchId: string; batchId: string }>();
  const { t } = useTranslation("newOrders");
  const { api } = useAppNotification();
  const receiveBatchOrders = useReceiveTransferBatchOrders();
  const detailQuery = useBatchDetail(batchId);
  const remainingQuery = useBatchRemainingDetail(batchId);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [receivedOrderIds, setReceivedOrderIds] = useState<Set<string>>(new Set());
  const pendingScanOrderIdsRef = useRef<Set<string>>(new Set());

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

  const receiveScannedOrder = useCallback((order: BatchOrder) => {
    if (!batchId || receiveBatchOrders.isPending || pendingScanOrderIdsRef.current.has(order.id)) return;

    pendingScanOrderIdsRef.current.add(order.id);
    receiveBatchOrders.mutate(
      { batchId, orderIds: [order.id] },
      {
        onSuccess: async () => {
          void playScanFeedback("success");
          markOrdersReceived([order.id]);
          api.success({
            message: t("branchOrderReceiveSuccess"),
            description: t("branchOrderReceiveOneDescription", { id: order.id }),
            placement: "topRight",
            duration: 2,
          });
          await refetchBatchData();
        },
        onError: (error: unknown) => {
          void playScanFeedback("error");
          const msg = getBackendErrorMessage(error) ?? t("receiveError");
          api.error({
            message: t("receiveError"),
            description: msg,
            placement: "topRight",
            duration: 5,
          });
        },
        onSettled: () => {
          pendingScanOrderIdsRef.current.delete(order.id);
        },
      },
    );
  }, [api, batchId, receiveBatchOrders, markOrdersReceived, refetchBatchData, t]);

  const translatedBatchStatus = data ? t(`batchStatus.${data.status}`) : "";
  const translatedBatchDirection = data ? t(`batchDirection.${data.direction}`) : "";

  useOrderQrScanner({
    orders,
    enabled: orders.length > 0 && !receiveBatchOrders.isPending,
    onMatch: receiveScannedOrder,
    onMissing: handleMissingScannedOrder,
  });

  const columns: ColumnConfig<BatchOrder>[] = useMemo(
    () => [
      {
        key: "id",
        label: "",
        render: (_, row) => (
          <Checkbox
            checked={selectedOrderIds.has(row.id)}
            onChange={() => toggleOne(row.id)}
          />
        ),
      },
      { key: "id", label: "#", render: (_, __, index) => <span className="font-black">{index + 1}</span> },
      { key: "receiver", label: t("receiver") },
      { key: "phone", label: t("phone") },
      { key: "address", label: t("address") },
      { key: "price", label: t("price"), render: (value) => formatBatchMoney(Number(value)) },
      { key: "status", label: t("status") },
    ],
    [selectedOrderIds, t],
  );

  return (
    <div className="space-y-4 pb-20 sm:space-y-6 sm:pb-24 md:pb-4">
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-3">
          <BackButton to={`/new-orders/branches/${branchId}`} className="w-fit" />
          <HeaderName
            name={t("branchBatchOrdersTitle", { id: batchId })}
            description={t("branchBatchOrdersDescription", { id: branchId })}
            icon={<Package />}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-3 dark:bg-primarydark">
        {data ? (
          <div className="mr-auto flex flex-wrap items-center gap-2 text-xs font-semibold text-[color:var(--color-text-muted)]">
            <span className={`inline-flex rounded-full border px-3 py-1 ${batchStatusClass[data.status]}`}>
              {translatedBatchStatus}
            </span>
            <span>{t("branchInfoDirection")}: {translatedBatchDirection}</span>
            <span>{t("branchInfoOrders")}: {t("branchInfoOrderCount", { count: data.orders_count })}</span>
            <span>{t("branchInfoAmount")}: {formatBatchMoney(data.total_price)}</span>
          </div>
        ) : null}

        <div
          onClick={toggleAll}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[color:var(--color-border-soft)] bg-primary px-3 py-2 text-xs font-semibold text-[color:var(--color-text-muted)]"
        >
          <Checkbox checked={isAllSelected} onChange={toggleAll} />
          {t("selectAll")}
        </div>

      </div>

      {isError ? (
        <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 p-6 text-center text-sm font-semibold text-rose-700 dark:text-rose-100">
          {t("branchBatchLoadError")}
        </div>
      ) : null}

      <Table
        data={orders}
        columns={columns}
        loading={isLoading}
        keyExtractor={(row) => row.id}
        emptyMessage={t("branchOrdersEmpty")}
        onRowClick={(row) => toggleOne(row.id)}
        preserveTableOnDesktop
      />

      <div className="fixed bottom-22 right-6 z-40 sm:bottom-24 sm:right-8 md:bottom-14 md:right-12">
        <button
          type="button"
          disabled={selectedOrderIds.size === 0 || receiveBatchOrders.isPending}
          onClick={handleAcceptSelectedOrders}
          className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold text-white transition-all
            bg-linear-to-r from-emerald-500 to-emerald-400 shadow-xl shadow-emerald-500/30
            hover:shadow-emerald-500/50 hover:-translate-y-0.5 active:translate-y-0
            disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0
            ${selectedOrderIds.size > 0 ? "cursor-pointer opacity-100" : "opacity-40"}`}
        >
          {receiveBatchOrders.isPending
            ? t("receiving")
            : t("receiveOrdersShort", { count: selectedOrderIds.size })}
        </button>
      </div>
    </div>
  );
};

export default memo(BranchBatchDetailPage);
