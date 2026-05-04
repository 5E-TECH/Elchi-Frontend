import { memo, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Package } from "lucide-react";
import { useBatchDetail, useBatchRemainingDetail, type BatchDetail, type BatchOrder } from "../../../entities/batch";
import { useOrders } from "../../../entities/orders";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import HeaderName from "../../../shared/components/headerName";
import { batchDirectionLabel, batchStatusClass, batchStatusLabel, formatBatchMoney } from "../../batches/lib/batchFormat";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import { Checkbox } from "../components/OrderCard";

const BranchBatchDetailPage = () => {
  const { branchId, batchId } = useParams<{ branchId: string; batchId: string }>();
  const navigate = useNavigate();
  const { api } = useAppNotification();
  const { createReceiveOrder } = useOrders();
  const detailQuery = useBatchDetail(batchId);
  const remainingQuery = useBatchRemainingDetail(batchId);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  const data = useMemo<BatchDetail | undefined>(() => {
    const detailOrders = detailQuery.data?.orders?.length ?? 0;
    const remainingOrders = remainingQuery.data?.orders?.length ?? 0;

    if (remainingOrders > detailOrders) return remainingQuery.data;
    return detailQuery.data ?? remainingQuery.data;
  }, [detailQuery.data, remainingQuery.data]);

  const isLoading = detailQuery.isLoading || remainingQuery.isLoading;
  const isError = detailQuery.isError && remainingQuery.isError;

  const orders = data?.orders ?? [];
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

  const handleAcceptSelectedOrders = () => {
    const ids = Array.from(selectedOrderIds);
    if (ids.length === 0 || createReceiveOrder.isPending) return;

    createReceiveOrder.mutate(
      { orderIds: ids },
      {
        onSuccess: async () => {
          api.success({
            message: "Order qabul qilindi",
            description: `${ids.length} ta order muvaffaqiyatli qabul qilindi.`,
            placement: "topRight",
          });
          setSelectedOrderIds(new Set());
          await Promise.all([detailQuery.refetch(), remainingQuery.refetch()]);
        },
        onError: (error: any) => {
          const msg = error?.response?.data?.message ?? error?.message ?? "Qabul qilishda xatolik yuz berdi";
          api.error({
            message: "Qabul qilishda xatolik",
            description: msg,
            placement: "topRight",
          });
        },
      },
    );
  };

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
      { key: "id", label: "Order ID", render: (value) => <span className="font-black">{String(value)}</span> },
      { key: "receiver", label: "Qabul qiluvchi" },
      { key: "phone", label: "Telefon" },
      { key: "address", label: "Manzil" },
      { key: "price", label: "Narx", render: (value) => formatBatchMoney(Number(value)) },
      { key: "status", label: "Holat" },
    ],
    [selectedOrderIds],
  );

  return (
    <div className="space-y-4 pb-20 sm:space-y-6 sm:pb-24 md:pb-4">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate(`/new-orders/branches/${branchId}`)}
          className="mt-1 flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-[color:var(--color-border-soft)] bg-primary text-maindark transition hover:border-main/40 hover:text-main dark:bg-primarydark dark:text-white"
          aria-label="Orqaga"
        >
          <ArrowLeft size={18} />
        </button>
        <HeaderName
          name={`Batch #${batchId}`}
          description="Ichidagi orderlar ro'yxati"
          icon={<Package />}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-3 dark:bg-primarydark">
        {data ? (
          <div className="mr-auto flex flex-wrap items-center gap-2 text-xs font-semibold text-[color:var(--color-text-muted)]">
            <span className={`inline-flex rounded-full border px-3 py-1 ${batchStatusClass[data.status]}`}>
              {batchStatusLabel[data.status]}
            </span>
            <span>Yo'nalish: {batchDirectionLabel[data.direction]}</span>
            <span>Order: {data.orders_count} ta</span>
            <span>Summa: {formatBatchMoney(data.total_price)}</span>
          </div>
        ) : null}

        <div
          onClick={toggleAll}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[color:var(--color-border-soft)] bg-primary px-3 py-2 text-xs font-semibold text-[color:var(--color-text-muted)]"
        >
          <Checkbox checked={isAllSelected} onChange={toggleAll} />
          Barchasini tanlash
        </div>

      </div>

      {isError ? (
        <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 p-6 text-center text-sm font-semibold text-rose-700 dark:text-rose-100">
          Batch detailini yuklab bo'lmadi
        </div>
      ) : null}

      <Table
        data={orders}
        columns={columns}
        loading={isLoading}
        keyExtractor={(row) => row.id}
        emptyMessage="Order topilmadi"
        onRowClick={(row) => toggleOne(row.id)}
      />

      <div className="fixed bottom-22 right-6 z-40 sm:bottom-24 sm:right-8 md:bottom-14 md:right-12">
        <button
          type="button"
          disabled={selectedOrderIds.size === 0 || createReceiveOrder.isPending}
          onClick={handleAcceptSelectedOrders}
          className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold text-white transition-all
            bg-linear-to-r from-emerald-500 to-emerald-400 shadow-xl shadow-emerald-500/30
            hover:shadow-emerald-500/50 hover:-translate-y-0.5 active:translate-y-0
            disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0
            ${selectedOrderIds.size > 0 ? "cursor-pointer opacity-100" : "opacity-40"}`}
        >
          {createReceiveOrder.isPending
            ? "Qabul qilinmoqda..."
            : `Orderlarni qabul qilish (${selectedOrderIds.size})`}
        </button>
      </div>
    </div>
  );
};

export default memo(BranchBatchDetailPage);
