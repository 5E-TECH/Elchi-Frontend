import { memo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckSquare, MapPin, PackageCheck, Printer, QrCode, Square, Truck } from "lucide-react";
import HeaderName from "../../../shared/components/headerName";
import Button from "../../../shared/components/button";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import { useBatchDetail, useSendTransferBatch, type BatchOrder } from "../../../entities/batch";
import {
  batchDirectionLabel,
  batchStatusClass,
  batchStatusLabel,
  formatBatchDateTime,
  formatBatchMoney,
} from "../lib/batchFormat";
import BatchPrintSheet from "./BatchPrintSheet";
import BatchQrCode from "./BatchQrCode";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";

const orderColumns: ColumnConfig<BatchOrder>[] = [
  { key: "id", label: "Order ID", render: (value) => <span className="font-black">{String(value)}</span> },
  { key: "receiver", label: "Qabul qiluvchi" },
  { key: "phone", label: "Telefon" },
  { key: "address", label: "Manzil", mobileFullWidth: true },
  { key: "price", label: "Narx", render: (value) => formatBatchMoney(Number(value)) },
  { key: "status", label: "Holat" },
];

const BatchDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: batch, isLoading, isError } = useBatchDetail(id);
  const sendBatch = useSendTransferBatch();
  const { apiRequest } = useAppNotification();
  const role = useSelector((state: RootState) => state.role.role);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  const isBranchManager = role === "manager";
  const isBranchRegistrator = role === "registrator";
  const canSendToMainBranch = batch?.status === "new" && (isBranchManager || isBranchRegistrator);
  const isAllSelected = batch?.orders.length
    ? selectedOrderIds.size === (batch?.orders.length ?? 0)
    : false;

  if (isLoading) {
    return (
      <div className="min-h-full rounded-2xl p-4 md:p-6">
        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-10 text-center font-semibold text-[color:var(--color-text-muted)] dark:bg-primarydark dark:text-white/70">
          Yuklanmoqda...
        </div>
      </div>
    );
  }

  if (isError || !batch) {
    return (
      <div className="min-h-full rounded-2xl p-4 md:p-6">
        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-10 text-center font-semibold text-[color:var(--color-text-muted)] dark:bg-primarydark dark:text-white/70">
          Paket topilmadi
        </div>
      </div>
    );
  }

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

    setSelectedOrderIds(new Set(batch.orders.map((order) => order.id)));
  };

  const handleSend = () => {
    if (!id || selectedOrderIds.size === 0 || sendBatch.isPending) return;

    apiRequest({
      request: () =>
        sendBatch.mutateAsync({
          batchId: id,
          orderIds: Array.from(selectedOrderIds),
        }),
      successMessage: "Batch asosiy filialga yuborildi",
      errorMessage: "Batch yuborishda xatolik bo'ldi",
      onSuccess: () => {
        setSelectedOrderIds(new Set());
      },
    });
  };

  const selectedCount = selectedOrderIds.size;
  const selectableOrderColumns: ColumnConfig<BatchOrder>[] = canSendToMainBranch
    ? [
        {
          key: "id",
          label: "",
          render: (_, row) => (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleOne(row.id);
              }}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-[color:var(--color-border-soft)] bg-primary text-main"
              aria-label="Order tanlash"
            >
              {selectedOrderIds.has(row.id) ? <CheckSquare size={14} /> : <Square size={14} />}
            </button>
          ),
        },
        ...orderColumns,
      ]
    : orderColumns;

  return (
    <div className="min-h-full rounded-2xl p-4 md:p-6">
      <BatchPrintSheet batch={batch} />

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate("/batches")}
            className="mt-1 flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-[color:var(--color-border-soft)] bg-primary text-maindark transition hover:border-main/40 hover:text-main dark:bg-primarydark dark:text-white"
            aria-label="Orqaga"
          >
            <ArrowLeft size={18} />
          </button>
          <HeaderName
            name={`Paket ${batch.id}`}
            description={`${batch.from_branch.name} -> ${batch.to_branch.name}`}
            icon={<PackageCheck />}
          />
        </div>
        <Button label="Chop etish" icon={<Printer size={17} />} onClick={() => window.print()} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <section className="rounded-[28px] border border-[color:var(--color-border-soft)] bg-primary p-5 shadow-sm dark:bg-primarydark">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Paket ID",
                  value: batch.request_key ?? batch.id,
                  icon: <PackageCheck size={16} />,
                },
                {
                  label: "Filial",
                  value: `${batch.from_branch.code ?? batch.from_branch.id} • ${batch.from_branch.name}`,
                  icon: <MapPin size={16} />,
                },
                { label: "Qayerga", value: batch.to_branch.name, icon: <MapPin size={16} /> },
                { label: "Viloyat", value: batch.to_branch.region ?? batch.to_branch.name ?? "—", icon: <MapPin size={16} /> },
                { label: "Haydovchi", value: batch.driver ?? "—", icon: <Truck size={16} /> },
                { label: "Telefon", value: batch.driver_phone ?? "—", icon: <Truck size={16} /> },
                { label: "Mashina", value: batch.vehicle_plate ?? "—", icon: <Truck size={16} /> },
                { label: "Yo'nalish", value: batchDirectionLabel[batch.direction], icon: <Truck size={16} /> },
                { label: "Order", value: `${batch.orders_count} ta`, icon: <PackageCheck size={16} /> },
                { label: "Narx", value: formatBatchMoney(batch.total_price), icon: <PackageCheck size={16} /> },
                { label: "Yaratilgan", value: formatBatchDateTime(batch.created_at), icon: <PackageCheck size={16} /> },
                {
                  label: "Holat",
                  value: (
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-extrabold ${batchStatusClass[batch.status]}`}>
                      {batchStatusLabel[batch.status]}
                    </span>
                  ),
                  icon: <PackageCheck size={16} />,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-[color:var(--color-border-soft)] bg-white/65 p-4 dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)] dark:text-white/55">
                    {item.icon}
                    {item.label}
                  </div>
                  <div className="text-base font-black text-maindark dark:text-white">{item.value}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-black text-maindark dark:text-white">Ichidagi orderlar</h3>
              {canSendToMainBranch ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[color:var(--color-border-soft)] bg-primary px-3 py-2 text-xs font-semibold text-[color:var(--color-text-muted)]"
                  >
                    {isAllSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                    Barchasini tanlash
                  </button>
                  {selectedCount > 0 ? (
                    <span className="text-xs font-semibold text-main">{selectedCount} ta tanlandi</span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <Table
              data={batch.orders}
              columns={selectableOrderColumns}
              keyExtractor={(row) => row.id}
              emptyMessage="Order topilmadi"
            />
            {canSendToMainBranch ? (
              <button
                type="button"
                onClick={handleSend}
                disabled={selectedCount === 0 || sendBatch.isPending}
                className={`mt-4 flex w-full items-center justify-center gap-2.5 rounded-2xl px-6 py-4 text-base font-semibold transition-all duration-200 ${
                  selectedCount > 0 && !sendBatch.isPending
                    ? "cursor-pointer bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600"
                    : "cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-white/10 dark:text-white/30"
                }`}
              >
                {sendBatch.isPending ? "Yuborilmoqda..." : "Asosiy filialga jo'natish"}
              </button>
            ) : null}
          </section>

          <section className="rounded-[28px] border border-[color:var(--color-border-soft)] bg-primary p-5 shadow-sm dark:bg-primarydark">
            <h3 className="mb-5 text-lg font-black text-maindark dark:text-white">Tarix</h3>
            {batch.history.length ? (
              <div className="relative space-y-5 pl-7 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-px before:bg-main/30">
                {batch.history.map((item) => (
                  <div key={item.id} className="relative">
                    <span className="absolute -left-[25px] top-1 flex h-5 w-5 items-center justify-center rounded-full border-4 border-primary bg-main dark:border-primarydark" />
                    <p className="m-0 text-sm font-black text-maindark dark:text-white">{item.action}</p>
                    <p className="m-0 mt-1 text-sm text-[color:var(--color-text-muted)] dark:text-white/60">
                      {item.actor} • {formatBatchDateTime(item.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[color:var(--color-border-soft)] px-4 py-8 text-center text-sm font-semibold text-[color:var(--color-text-muted)] dark:text-white/60">
                Tarix hozircha mavjud emas
              </div>
            )}
          </section>
        </div>

        <aside className="h-max rounded-[28px] border border-[color:var(--color-border-soft)] bg-primary p-5 shadow-sm dark:bg-primarydark">
          <div className="mb-4 flex items-center gap-2 text-lg font-black text-maindark dark:text-white">
            <QrCode size={20} />
            QR kod
          </div>
          <div className="rounded-[26px] border border-dashed border-[color:var(--color-border-soft)] bg-white p-5 dark:bg-white">
            <BatchQrCode
              token={batch.token}
              fallbackLabel={batch.id}
              alt={`QR ${batch.id}`}
              className="mx-auto aspect-square w-full max-w-[230px] object-contain"
              fallbackClassName="mx-auto flex aspect-square w-full max-w-[230px] flex-col items-center justify-center rounded-2xl border-2 border-maindark text-xl font-black text-maindark"
            />
          </div>
          <Button
            label="Chop etish"
            icon={<Printer size={17} />}
            onClick={() => window.print()}
            className="mt-4 w-full"
          />
        </aside>
      </div>
    </div>
  );
};

export default memo(BatchDetailPage);
