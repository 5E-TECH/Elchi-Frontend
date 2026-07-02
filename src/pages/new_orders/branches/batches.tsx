import { memo, useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Building2, CalendarClock, CheckSquare, MapPin, PackageCheck, Search, Square, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useBatches, useReceiveTransferBatch, type Batch } from "../../../entities/batch";
import { useBranchDetail } from "../../../entities/branch";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import { batchStatusClass, batchStatusLabel, formatBatchDateTime, formatBatchMoney } from "../../batches/lib/batchFormat";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import { Checkbox } from "../components/OrderCard";
import BackButton from "../../../shared/ui/BackButton";
import { useOrderQrScanner } from "../../../shared/lib/useOrderQrScanner";
import { playMissingOrderFeedback, playScanFeedback } from "../../scan/lib/scanShared";

type ScannableBatch = Batch & { qr_code_token?: string | null };

const BranchSentBatchesPage = () => {
  const { branchId } = useParams<{ branchId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("newOrders");
  const { api } = useAppNotification();
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());
  const [receivedBatchIds, setReceivedBatchIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const receiveTransferBatch = useReceiveTransferBatch();
  const { data: branch } = useBranchDetail(branchId);

  const { data, isLoading, isError } = useBatches({
    sourceBranchId: branchId,
    statusRaw: "SENT",
    directionRaw: "FORWARD",
    page: 1,
    limit: 100,
  });

  const rows = useMemo(
    () => (data?.data ?? []).filter((row) => !receivedBatchIds.has(row.id)),
    [data?.data, receivedBatchIds],
  );
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) => {
      const region = row.to_branch.region ?? "";
      const branchName = row.to_branch.name ?? "";
      return (
        row.id.toLowerCase().includes(query) ||
        row.token.toLowerCase().includes(query) ||
        region.toLowerCase().includes(query) ||
        branchName.toLowerCase().includes(query)
      );
    });
  }, [rows, search]);
  const scannableRows = useMemo<ScannableBatch[]>(
    () => rows.map((row) => ({ ...row, qr_code_token: row.token })),
    [rows],
  );
  const isAllSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedBatchIds.has(row.id));
  const branchName = branch?.name || rows[0]?.from_branch?.name || `Filial #${branchId}`;

  const toggleBatch = useCallback((id: string) => {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = () => {
    if (isAllSelected) {
      setSelectedBatchIds((prev) => {
        const next = new Set(prev);
        visibleRows.forEach((row) => next.delete(row.id));
        return next;
      });
      return;
    }
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      visibleRows.forEach((row) => next.add(row.id));
      return next;
    });
  };

  const markBatchesReceived = useCallback((ids: string[]) => {
    setReceivedBatchIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const handleAcceptSelectedBatches = async () => {
    const ids = Array.from(selectedBatchIds);
    if (ids.length === 0 || receiveTransferBatch.isPending) return;

    const results = await Promise.allSettled(ids.map((id) => receiveTransferBatch.mutateAsync(id)));
    const successIds = ids.filter((_, index) => results[index].status === "fulfilled");
    const successCount = successIds.length;
    const failedCount = results.length - successCount;

    if (successCount > 0) {
      markBatchesReceived(successIds);
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

  const handleMissingScannedBatch = useCallback(() => {
    playMissingOrderFeedback();
    api.warning({
      message: "QR topilmadi",
      description: "Bu QR kod ushbu filial batchlariga mos kelmadi.",
      placement: "topRight",
      duration: 3,
    });
  }, [api]);

  const selectScannedBatch = useCallback((batch: ScannableBatch) => {
    setSelectedBatchIds((prev) => {
      if (prev.has(batch.id)) {
        void playScanFeedback("duplicate", t("common:scannerFeedbackDuplicate"));
        api.warning({
          message: t("common:scannerFeedbackDuplicate"),
          description: `#${batch.id}`,
          placement: "topRight",
          duration: 2,
        });
        return prev;
      }
      const next = new Set(prev);
      next.add(batch.id);
      void playScanFeedback("success");
      return next;
    });
  }, [api, t]);

  useOrderQrScanner({
    orders: scannableRows,
    enabled: scannableRows.length > 0 && !receiveTransferBatch.isPending,
    onMatch: selectScannedBatch,
    onMissing: handleMissingScannedBatch,
  });

  const totalPrice = visibleRows.reduce((sum, row) => sum + row.total_price, 0);

  const columns: ColumnConfig<Batch>[] = useMemo(
    () => [
      {
        key: "token",
        label: "#",
        width: "7%",
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
        width: "31%",
        render: (_, row) => (
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-main/10 text-main dark:bg-main/20">
              <MapPin size={14} />
            </span>
            <span className="font-semibold text-maindark dark:text-white">
              {row.to_branch.region ?? row.to_branch.name}
            </span>
          </div>
        ),
      },
      {
        key: "orders_count",
        label: "Order",
        width: "18%",
        sortable: true,
        render: (value) => (
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-main/10 dark:bg-main/20">
              <PackageCheck size={12} className="text-main" />
            </span>
            <span className="font-bold text-maindark dark:text-white">{Number(value)} ta</span>
          </div>
        ),
      },
      {
        key: "total_price",
        label: "Umumiy narx",
        width: "20%",
        sortable: true,
        render: (value) => (
          <span className="tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
            {formatBatchMoney(Number(value))}
          </span>
        ),
      },
      {
        key: "status",
        label: "Holat",
        width: "12%",
        render: (_, row) => (
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-extrabold ${batchStatusClass[row.status]}`}>
            {batchStatusLabel[row.status]}
          </span>
        ),
      },
      {
        key: "created_at",
        label: "Yaratilgan vaqt",
        width: "12%",
        render: (value) => (
          <span className="font-medium text-maindark dark:text-slate-300">
            {formatBatchDateTime(String(value))}
          </span>
        ),
      },
    ],
    [selectedBatchIds, toggleBatch],
  );

  const renderMobileCard = useCallback((row: Batch) => (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-primarydark">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Checkbox
            checked={selectedBatchIds.has(row.id)}
            onChange={() => toggleBatch(row.id)}
          />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-maindark/50 dark:text-white/45">
              Viloyat
            </p>
            <div className="mt-1 flex min-w-0 items-start gap-2">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-main/10 text-main dark:bg-main/20">
                <MapPin size={14} />
              </span>
              <p className="min-w-0 break-words text-sm font-extrabold leading-5 text-maindark dark:text-white">
                {row.to_branch.region ?? row.to_branch.name}
              </p>
            </div>
          </div>
        </div>

        <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-extrabold ${batchStatusClass[row.status]}`}>
          {batchStatusLabel[row.status]}
        </span>
      </div>

      <div className="grid gap-2.5 border-t border-gray-100 pt-3 dark:border-white/10">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-maindark/50 dark:text-white/45">
            Order
          </span>
          <span className="inline-flex items-center gap-2 font-bold text-maindark dark:text-white">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-main/10 dark:bg-main/20">
              <PackageCheck size={12} className="text-main" />
            </span>
            {row.orders_count} ta
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-maindark/50 dark:text-white/45">
            Umumiy narx
          </span>
          <span className="text-right font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatBatchMoney(row.total_price)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-maindark/50 dark:text-white/45">
            Yaratilgan vaqt
          </span>
          <span className="inline-flex items-center gap-1.5 text-right text-sm font-semibold text-maindark dark:text-slate-300">
            <CalendarClock size={13} className="text-main/70" />
            {formatBatchDateTime(row.created_at)}
          </span>
        </div>
      </div>
    </div>
  ), [selectedBatchIds, toggleBatch]);

  return (
    <div className="space-y-4 pb-20 sm:space-y-6 sm:pb-24 md:pb-4">
      <div className="flex min-w-0 items-center gap-3">
        <BackButton to="/new-orders/branches" className="h-10 min-w-10 shrink-0 rounded-xl px-2" label="" />
        <div className="relative min-w-0 flex-1">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-maindark/45 dark:text-white/45" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Viloyat yoki batch ID qidirish..."
            className="h-12 w-full rounded-2xl border border-[color:var(--color-border-soft)] bg-primary pl-12 pr-4 text-sm font-semibold text-maindark outline-none transition focus:border-main/60 focus:ring-2 focus:ring-main/15 dark:bg-primarydark dark:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-white/10 dark:bg-primarydark sm:p-4">
          <div className="rounded-xl bg-main/10 p-2.5 text-main dark:bg-main/20">
            <Building2 size={20} />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="text-xs font-medium text-maindark dark:text-white/75">Filial</span>
            <strong className="truncate text-base leading-tight text-maindark dark:text-white sm:text-lg">{branchName}</strong>
          </div>
        </div>

        <div className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-white/10 dark:bg-primarydark sm:p-4">
          <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-500 dark:bg-emerald-500/20">
            <PackageCheck size={20} />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="text-xs font-medium text-maindark dark:text-white/75">Jami batchlar</span>
            <strong className="truncate text-base leading-tight text-maindark dark:text-white sm:text-lg">{visibleRows.length} ta</strong>
          </div>
        </div>

        <div className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-white/10 dark:bg-primarydark sm:p-4">
          <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-500 dark:bg-amber-500/20">
            <TrendingUp size={20} />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="text-xs font-medium text-maindark dark:text-white/75">Umumiy summa</span>
            <strong className="truncate text-base leading-tight text-emerald-600 dark:text-emerald-400 sm:text-lg">{formatBatchMoney(totalPrice)}</strong>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-primarydark">
        <button
          type="button"
          onClick={toggleAll}
          disabled={visibleRows.length === 0}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
            isAllSelected
              ? "border-main bg-main text-white shadow-lg shadow-main/20"
              : "border-gray-200 bg-gray-50 text-maindark hover:border-main/35 hover:bg-main/10 hover:text-main dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:border-main/45 dark:hover:bg-main/15 dark:hover:text-white"
          }`}
        >
          {isAllSelected ? <CheckSquare size={16} /> : <Square size={16} />}
          {isAllSelected ? "Tanlovni bekor qilish" : "Barchasini tanlash"}
        </button>

        <div className="inline-flex h-9 items-center gap-2 rounded-xl border border-main/15 bg-main/10 px-3 text-xs font-bold text-main dark:border-main/25 dark:bg-main/20 dark:text-main">
          <CheckSquare size={14} />
          {selectedBatchIds.size} ta tanlandi
        </div>
      </div>

      {isError ? (
        <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 p-6 text-center text-sm font-semibold text-rose-700 dark:text-rose-100">
          Batchlar ro'yxatini yuklab bo'lmadi
        </div>
      ) : null}

      <Table
        data={visibleRows}
        columns={columns}
        loading={isLoading}
        keyExtractor={(row) => row.id}
        emptyMessage="Batch topilmadi"
        onRowClick={(row) => navigate(`/new-orders/branches/${branchId}/batches/${row.id}`)}
        mobileRowRender={renderMobileCard}
        preserveTableOnDesktop
        hoverable
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
