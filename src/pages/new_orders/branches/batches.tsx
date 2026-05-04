import { memo, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PackageCheck } from "lucide-react";
import { useBatches, useReceiveTransferBatch, type Batch } from "../../../entities/batch";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import HeaderName from "../../../shared/components/headerName";
import { batchStatusClass, batchStatusLabel, formatBatchDateTime, formatBatchMoney } from "../../batches/lib/batchFormat";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import { Checkbox } from "../components/OrderCard";

const BranchSentBatchesPage = () => {
  const { branchId } = useParams<{ branchId: string }>();
  const navigate = useNavigate();
  const { api } = useAppNotification();
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());
  const receiveTransferBatch = useReceiveTransferBatch();

  const { data, isLoading, isError } = useBatches({
    sourceBranchId: branchId,
    statusRaw: "SENT",
    directionRaw: "FORWARD",
    page: 1,
    limit: 100,
  });

  const rows = data?.data ?? [];
  const isAllSelected = rows.length > 0 && selectedBatchIds.size === rows.length;

  const toggleBatch = (id: string) => {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (isAllSelected) {
      setSelectedBatchIds(new Set());
      return;
    }
    setSelectedBatchIds(new Set(rows.map((row) => row.id)));
  };

  const handleAcceptSelectedBatches = async () => {
    const ids = Array.from(selectedBatchIds);
    if (ids.length === 0 || receiveTransferBatch.isPending) return;

    const results = await Promise.allSettled(ids.map((id) => receiveTransferBatch.mutateAsync(id)));
    const successCount = results.filter((result) => result.status === "fulfilled").length;
    const failedCount = results.length - successCount;

    if (successCount > 0) {
      setSelectedBatchIds(new Set());
      api.success({
        message: "Batchlar qabul qilindi",
        description: `${successCount} ta batch muvaffaqiyatli qabul qilindi.`,
        placement: "topRight",
      });
    }

    if (failedCount > 0) {
      api.error({
        message: "Batchlarni qabul qilishda xatolik",
        description: `${failedCount} ta batch qabul qilinmadi. Iltimos qayta urinib ko'ring.`,
        placement: "topRight",
      });
    }
  };

  const columns: ColumnConfig<Batch>[] = useMemo(
    () => [
      {
        key: "id",
        label: "",
        render: (_, row) => (
          <Checkbox
            checked={selectedBatchIds.has(row.id)}
            onChange={() => toggleBatch(row.id)}
          />
        ),
      },
      {
        key: "id",
        label: "Viloyat",
        render: (_, row) => (
          <span className="font-black text-maindark dark:text-white">{row.to_branch.region ?? row.to_branch.name}</span>
        ),
      },
      {
        key: "to_branch",
        label: "Qayerga",
        render: (_, row) => row.to_branch.name,
      },
      {
        key: "orders_count",
        label: "Order",
        render: (value) => `${Number(value)} ta`,
      },
      {
        key: "total_price",
        label: "Umumiy narx",
        render: (value) => formatBatchMoney(Number(value)),
      },
      {
        key: "status",
        label: "Holat",
        render: (_, row) => (
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-extrabold ${batchStatusClass[row.status]}`}>
            {batchStatusLabel[row.status]}
          </span>
        ),
      },
      {
        key: "created_at",
        label: "Yaratilgan vaqt",
        render: (value) => formatBatchDateTime(String(value)),
      },
    ],
    [selectedBatchIds],
  );

  return (
    <div className="space-y-4 pb-20 sm:space-y-6 sm:pb-24 md:pb-4">
      <HeaderName
        name="Jo'natilgan batchlar"
        description="Filialdan asosiy filialga jo'natilgan batchlar"
        icon={<PackageCheck />}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-3 dark:bg-primarydark">
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
          Batchlar ro'yxatini yuklab bo'lmadi
        </div>
      ) : null}

      <Table
        data={rows}
        columns={columns}
        loading={isLoading}
        keyExtractor={(row) => row.id}
        emptyMessage="Batch topilmadi"
        onRowClick={(row) => navigate(`/new-orders/branches/${branchId}/${row.id}`)}
      />

      <div className="fixed bottom-22 right-6 z-40 sm:bottom-24 sm:right-8 md:bottom-14 md:right-12">
        <button
          type="button"
          disabled={selectedBatchIds.size === 0 || receiveTransferBatch.isPending}
          onClick={handleAcceptSelectedBatches}
          className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold text-white transition-all
            bg-linear-to-r from-emerald-500 to-emerald-400 shadow-xl shadow-emerald-500/30
            hover:shadow-emerald-500/50 hover:-translate-y-0.5 active:translate-y-0
            disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0
            ${selectedBatchIds.size > 0 ? "cursor-pointer opacity-100" : "opacity-40"}`}
        >
          {receiveTransferBatch.isPending
            ? "Qabul qilinmoqda..."
            : `Batchlarni qabul qilish (${selectedBatchIds.size})`}
        </button>
      </div>
    </div>
  );
};

export default memo(BranchSentBatchesPage);
