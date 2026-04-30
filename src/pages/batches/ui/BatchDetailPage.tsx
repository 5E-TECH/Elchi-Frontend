import { memo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, PackageCheck, Printer, QrCode, Truck } from "lucide-react";
import HeaderName from "../../../shared/components/headerName";
import Button from "../../../shared/components/button";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import { useBatchDetail, type BatchOrder } from "../../../entities/batch";
import {
  batchDirectionLabel,
  batchStatusClass,
  batchStatusLabel,
  formatBatchDateTime,
  formatBatchMoney,
  getBatchQrUrl,
} from "../lib/batchFormat";
import BatchPrintSheet from "./BatchPrintSheet";

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
  const [qrFailed, setQrFailed] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-full rounded-2xl bg-sidebar p-4 md:p-6 dark:bg-maindark">
        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-10 text-center font-semibold text-[color:var(--color-text-muted)] dark:bg-primarydark dark:text-white/70">
          Yuklanmoqda...
        </div>
      </div>
    );
  }

  if (isError || !batch) {
    return (
      <div className="min-h-full rounded-2xl bg-sidebar p-4 md:p-6 dark:bg-maindark">
        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-10 text-center font-semibold text-[color:var(--color-text-muted)] dark:bg-primarydark dark:text-white/70">
          Paket topilmadi
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full rounded-2xl bg-sidebar p-4 md:p-6 dark:bg-maindark">
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
                  label: "Filial",
                  value: `${batch.from_branch.code ?? batch.from_branch.id} • ${batch.from_branch.name}`,
                  icon: <MapPin size={16} />,
                },
                { label: "Qayerga", value: batch.to_branch.name, icon: <MapPin size={16} /> },
                { label: "Viloyat", value: batch.to_branch.region ?? batch.to_branch.name ?? "—", icon: <MapPin size={16} /> },
                { label: "Haydovchi", value: batch.driver ?? "—", icon: <Truck size={16} /> },
                { label: "Yo'nalish", value: batchDirectionLabel[batch.direction], icon: <Truck size={16} /> },
                { label: "Order", value: `${batch.orders_count} ta`, icon: <PackageCheck size={16} /> },
                { label: "Narx", value: formatBatchMoney(batch.total_price), icon: <PackageCheck size={16} /> },
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
            <h3 className="mb-3 text-lg font-black text-maindark dark:text-white">Ichidagi orderlar</h3>
            <Table
              data={batch.orders}
              columns={orderColumns}
              keyExtractor={(row) => row.id}
              emptyMessage="Order topilmadi"
            />
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
            {!qrFailed && batch.token ? (
              <img
                src={getBatchQrUrl(batch.token)}
                alt={`QR ${batch.id}`}
                onError={() => setQrFailed(true)}
                className="mx-auto aspect-square w-full max-w-[230px] object-contain"
              />
            ) : (
              <div className="mx-auto flex aspect-square w-full max-w-[230px] items-center justify-center rounded-2xl border-2 border-maindark text-xl font-black text-maindark">
                QR KOD
              </div>
            )}
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
