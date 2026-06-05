import { memo, useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { MapPin, PackageCheck, Printer, QrCode, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
import HeaderName from "../../../shared/components/headerName";
import Button from "../../../shared/components/button";
import { useBatchDetail, useBatchRemainingDetail, useSendTransferBatch } from "../../../entities/batch";
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
import OrdersTable from "../../mails/detail/ui/OrdersTable";
import SendButton from "../../mails/detail/ui/SendButton";
import MailStatCards from "../../mails/detail/ui/MailStatCards";
import { useMailDetailState } from "../../mails/detail/model/useMailDetailState";
import { mapBatchOrdersToPostOrders } from "../lib/batchOrderMailAdapter";
import { useOrderQrScanner } from "../../../shared/lib/useOrderQrScanner";
import { playMissingOrderFeedback, playScanFeedback } from "../../scan/lib/scanShared";
import BackButton from "../../../shared/ui/BackButton";
import PageContainer from "../../../shared/ui/PageContainer";

const BatchDetailPage = () => {
  const { t } = useTranslation("mails");
  const { id } = useParams();
  const { data: batchDetail, isLoading: isDetailLoading, isError: isDetailError } = useBatchDetail(id);
  const {
    data: remainingBatch,
    isLoading: isRemainingLoading,
    isError: isRemainingError,
    refetch: refetchRemainingBatch,
  } = useBatchRemainingDetail(id);
  const sendBatch = useSendTransferBatch();
  const { apiRequest, api: notifApi } = useAppNotification();
  const role = useSelector((state: RootState) => state.role.role);
  const [sentOrderIds, setSentOrderIds] = useState<Set<string>>(new Set());

  const isBranchManager = role === "manager";
  const isBranchRegistrator = role === "registrator";
  const batch = batchDetail ?? remainingBatch;
  const canSendToMainBranch = batch?.status === "new" && (isBranchManager || isBranchRegistrator);
  const rawOrders = useMemo(() => mapBatchOrdersToPostOrders(remainingBatch ?? batch), [batch, remainingBatch]);
  const orders = useMemo(
    () => rawOrders.filter((order) => !sentOrderIds.has(order.id)),
    [rawOrders, sentOrderIds],
  );
  const homeStats = useMemo(() => {
    const homeOrders = orders.filter((order) => order.where_deliver === "address");
    return {
      homeOrders: homeOrders.length,
      homeOrdersTotalPrice: homeOrders.reduce((sum, order) => sum + order.total_price, 0),
    };
  }, [orders]);
  const centerStats = useMemo(() => {
    const centerOrders = orders.filter((order) => order.where_deliver === "center");
    return {
      centerOrders: centerOrders.length,
      centerOrdersTotalPrice: centerOrders.reduce((sum, order) => sum + order.total_price, 0),
    };
  }, [orders]);
  const { selectedIds, allSelected, someSelected, toggleAll, toggleOne, selectOne, clearSelection } =
    useMailDetailState(orders);

  const handleMissingScannedOrder = useCallback(() => {
    notifApi.warning({
      message: t("qrNotFound"),
      description: t("batchScanMissing"),
      placement: "topRight",
      duration: 3,
    });
    playMissingOrderFeedback();
  }, [notifApi, t]);

  const selectScannedOrder = useCallback((order: (typeof orders)[number]) => {
    if (!canSendToMainBranch) return;
    if (selectedIds.has(order.id)) return;

    selectOne(order.id);
    notifApi.success({
      message: t("orderSelected"),
      description: `#${order.id}`,
      placement: "topRight",
      duration: 2,
    });
    void playScanFeedback("success");
  }, [canSendToMainBranch, notifApi, selectOne, selectedIds, t]);

  useOrderQrScanner({
    orders,
    enabled: canSendToMainBranch && orders.length > 0,
    onMatch: selectScannedOrder,
    onMissing: handleMissingScannedOrder,
  });

  const handleSend = useCallback(() => {
    if (!id || selectedIds.size === 0 || sendBatch.isPending) return;
    const sentIds = Array.from(selectedIds);

    apiRequest({
      request: () =>
        sendBatch.mutateAsync({
          batchId: id,
          orderIds: sentIds,
        }),
      successMessage: t("batchSendMainSuccess"),
      errorMessage: t("batchSendMainError"),
      onSuccess: async () => {
        setSentOrderIds((prev) => {
          const next = new Set(prev);
          sentIds.forEach((orderId) => next.add(orderId));
          return next;
        });
        clearSelection();
        await refetchRemainingBatch();
      },
    });
  }, [apiRequest, clearSelection, id, refetchRemainingBatch, selectedIds, sendBatch, t]);

  if (isDetailLoading || isRemainingLoading) {
    return (
      <PageContainer>
        <div className="rounded-2xl border border-(--color-border-soft) bg-primary p-10 text-center font-semibold text-(--color-text-muted) dark:bg-primarydark dark:text-white/70">
          Yuklanmoqda...
        </div>
      </PageContainer>
    );
  }

  if ((isDetailError && isRemainingError) || !batch) {
    return (
      <PageContainer>
        <div className="rounded-2xl border border-(--color-border-soft) bg-primary p-10 text-center font-semibold text-(--color-text-muted) dark:bg-primarydark dark:text-white/70">
          Paket topilmadi
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <BatchPrintSheet batch={batch} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <BackButton to="/batches" className="mt-1 h-10 min-w-10 rounded-xl px-2" label="" />
          <HeaderName
            name={`Paket ${batch.id}`}
            description={`${batch.from_branch.name} -> ${batch.to_branch.name}`}
            icon={<PackageCheck />}
          />
        </div>
        <Button label="Chop etish" icon={<Printer size={17} />} onClick={() => window.print()} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          <section className="rounded-[22px] border border-(--color-border-soft) bg-primary p-3.5 shadow-sm dark:bg-primarydark">
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {[
                {
                  label: "Filial",
                  value: `${batch.from_branch.code ?? batch.from_branch.id} • ${batch.from_branch.name}`,
                  icon: <MapPin size={14} />,
                },
                { label: "Qayerga", value: batch.to_branch.name, icon: <MapPin size={14} /> },
                { label: "Viloyat", value: batch.to_branch.region ?? batch.to_branch.name ?? "—", icon: <MapPin size={14} /> },
                { label: "Yo'nalish", value: batchDirectionLabel[batch.direction], icon: <Truck size={14} /> },
                { label: "Order", value: `${batch.orders_count} ta`, icon: <PackageCheck size={14} /> },
                { label: "Narx", value: formatBatchMoney(batch.total_price), icon: <PackageCheck size={14} /> },
                { label: "Yaratilgan", value: formatBatchDateTime(batch.created_at), icon: <PackageCheck size={14} /> },
                {
                  label: "Holat",
                  value: (
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${batchStatusClass[batch.status]}`}>
                      {batchStatusLabel[batch.status]}
                    </span>
                  ),
                  icon: <PackageCheck size={14} />,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="min-w-0 rounded-xl border border-(--color-border-soft) bg-white/60 px-3 py-2.5 dark:border-white/10 dark:bg-white/4"
                >
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-(--color-text-muted) dark:text-white/55">
                    {item.icon}
                    {item.label}
                  </div>
                  <div className="truncate text-sm font-black text-maindark dark:text-white">{item.value}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-xl font-black text-maindark dark:text-white md:text-2xl">Ichidagi orderlar</h3>
            </div>
            <MailStatCards
              totalOrders={orders.length}
              selectedCount={selectedIds.size}
              homeStats={homeStats}
              centerStats={centerStats}
              showSelectionCard={canSendToMainBranch}
              variant="compact"
            />
            <div className="mt-4">
              <OrdersTable
                orders={orders}
                selectedIds={selectedIds}
                allSelected={allSelected}
                someSelected={someSelected}
                onToggleAll={toggleAll}
                onToggleOne={toggleOne}
                readOnly={!canSendToMainBranch}
              />
            </div>
            {canSendToMainBranch && orders.length > 0 ? (
              <div className="mt-4">
                <SendButton
                  selectedCount={selectedIds.size}
                  isCourier={false}
                  mode="send"
                  onSend={handleSend}
                  onReceive={handleSend}
                  isBusy={sendBatch.isPending}
                  sendLabel={t("sendToMainBranch")}
                  busyLabel={t("sendingToMainBranch")}
                />
              </div>
            ) : null}
          </section>

          <section className="rounded-[28px] border border-(--color-border-soft) bg-primary p-5 shadow-sm dark:bg-primarydark">
            <h3 className="mb-5 text-lg font-black text-maindark dark:text-white">Tarix</h3>
            {batch.history.length ? (
              <div className="relative space-y-5 pl-7 before:absolute before:bottom-2 before:left-2.25 before:top-2 before:w-px before:bg-main/30">
                {batch.history.map((item) => (
                  <div key={item.id} className="relative">
                    <span className="absolute -left-6.25 top-1 flex h-5 w-5 items-center justify-center rounded-full border-4 border-primary bg-main dark:border-primarydark" />
                    <p className="m-0 text-sm font-black text-maindark dark:text-white">{item.action}</p>
                    <p className="m-0 mt-1 text-sm text-(--color-text-muted) dark:text-white/60">
                      {item.actor} • {formatBatchDateTime(item.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-(--color-border-soft) px-4 py-8 text-center text-sm font-semibold text-(--color-text-muted) dark:text-white/60">
                Tarix hozircha mavjud emas
              </div>
            )}
          </section>
        </div>

        <aside className="h-max rounded-[22px] border border-(--color-border-soft) bg-primary p-4 shadow-sm dark:bg-primarydark">
          <div className="mb-3 flex items-center gap-2 text-base font-black text-maindark dark:text-white">
            <QrCode size={17} />
            QR kod
          </div>
          <div className="rounded-[20px] border border-dashed border-(--color-border-soft) bg-white p-3.5 dark:bg-white">
            <BatchQrCode
              token={batch.token}
              fallbackLabel={batch.id}
              alt={`QR ${batch.id}`}
              className="mx-auto aspect-square w-full max-w-47.5 object-contain"
              fallbackClassName="mx-auto flex aspect-square w-full max-w-[190px] flex-col items-center justify-center rounded-xl border-2 border-maindark text-lg font-black text-maindark"
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
    </PageContainer>
  );
};

export default memo(BatchDetailPage);
