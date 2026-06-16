import { memo, useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useOrders } from "../../../entities/orders";
import BackButton from "../../../shared/ui/BackButton";
import HeaderName from "../../../shared/components/headerName";
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  PackageX,
  ScanLine,
  Send,
  WalletCards,
  XCircle,
} from "lucide-react";
import { extractCancelledOrders } from "./utils";
import QueryErrorState from "../../../shared/ui/QueryErrorState";
import ScannerActionButton from "../../../shared/components/ScannerActionButton";
import ScannerCameraModal from "../../../shared/components/ScannerCameraModal";
import { useOrderQrScanner } from "../../../shared/lib/useOrderQrScanner";
import { normalizeScannerCandidates } from "../../../shared/lib/scanToken";
import { useScannerGate } from "../../../shared/lib/useScannerGate";
import { playMissingOrderFeedback, playScanFeedback } from "../../scan/lib/scanShared";
import { getBackendErrorMessage } from "../../scan/lib/scanResource";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import type { OrderListItem } from "../../../entities/order/types/order";
import { OrderCard, type ApiOrder } from "../components/OrderCard";

const formatMoney = (value: number) => `${value.toLocaleString("uz-UZ")} so'm`;

const toOrderCardData = (order: OrderListItem): ApiOrder => ({
  id: order.id,
  qr_code_token: order.qr_code_token,
  status: order.status,
  where_deliver: order.where_deliver,
  total_price: order.total_price,
  paid_amount: order.paid_amount,
  to_be_paid: order.to_be_paid,
  createdAt: order.createdAt,
  comment: order.comment,
  address: order.address,
  items: order.items.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    product: {
      id: item.product_id,
      name: item.product?.name ?? `#${item.product_id}`,
      image_url: item.product?.image_url ?? null,
    },
  })),
  customer: {
    id: order.customer?.id ?? order.customer_id,
    name: order.customer?.name ?? "—",
    phone_number: order.customer?.phone_number ?? "—",
    district: order.district ? { name: order.district.name } : undefined,
    region: order.district?.region ? { name: order.district.region.name } : undefined,
  },
  district: order.district ? { name: order.district.name } : undefined,
  region: order.district?.region ? { name: order.district.region.name } : undefined,
});

const CancelledMarketDetail = () => {
  const { t } = useTranslation("newOrders");
  const { api: notificationApi } = useAppNotification();
  const { marketId = "" } = useParams();
  const { useCancelledOrdersByMarket, handoverCancelledOrders } = useOrders();
  const query = useCancelledOrdersByMarket(marketId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scanError, setScanError] = useState("");
  const rawOrders = useMemo(() => extractCancelledOrders(query.data), [query.data]);
  const orders = useMemo(
    () => rawOrders.filter((order) => !sentIds.has(order.id)),
    [rawOrders, sentIds],
  );
  const selectableOrders = useMemo(
    () => orders.filter((order) => order.status === "cancelled"),
    [orders],
  );
  const totalAmount = useMemo(
    () => orders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0),
    [orders],
  );
  const scanIndex = useMemo(() => {
    const index = new Map<string, OrderListItem>();

    selectableOrders.forEach((order) => {
      index.set(String(order.id).toLowerCase(), order);
      if (order.qr_code_token?.trim()) {
        index.set(order.qr_code_token.trim().toLowerCase(), order);
      }
    });

    return index;
  }, [selectableOrders]);
  const marketName = rawOrders[0]?.market?.name ?? t("marketName");
  const { canAcceptScan } = useScannerGate({
    cooldownMs: 200,
    duplicateCooldownMs: 1800,
  });

  const selectOrder = useCallback((order: OrderListItem) => {
    if (order.status !== "cancelled" || selectedIds.has(order.id)) return;

    setSelectedIds((previous) => {
      const next = new Set(previous);
      next.add(order.id);
      return next;
    });
    setScanError("");
    void playScanFeedback("success");
  }, [selectedIds]);

  const handleMissingOrder = useCallback(() => {
    const message = t("cancelledScanMissing");
    setScanError(message);
    playMissingOrderFeedback();
    notificationApi.warning({
      message: t("qrNotFound"),
      description: message,
      placement: "topRight",
      duration: 3,
    });
  }, [notificationApi, t]);

  useOrderQrScanner({
    orders: selectableOrders,
    enabled: !handoverCancelledOrders.isPending,
    onMatch: selectOrder,
    onMissing: handleMissingOrder,
  });

  const handleCameraDecode = useCallback((rawValue: string) => {
    if (!canAcceptScan(rawValue)) return;

    const matchedOrder = normalizeScannerCandidates(rawValue, window.location.origin)
      .map((candidate) => scanIndex.get(candidate))
      .find(Boolean);

    if (!matchedOrder) {
      handleMissingOrder();
      return;
    }

    selectOrder(matchedOrder);
  }, [canAcceptScan, handleMissingOrder, scanIndex, selectOrder]);

  const handleSelectChange = useCallback((id: string, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? new Set(selectableOrders.map((order) => order.id)) : new Set());
  }, [selectableOrders]);

  const handleSendToMarket = useCallback(() => {
    if (selectedIds.size === 0 || handoverCancelledOrders.isPending || !marketId) return;
    const orderIds = Array.from(selectedIds);

    handoverCancelledOrders.mutate({ marketId, orderIds }, {
      onSuccess: () => {
        setSentIds((previous) => new Set([...previous, ...orderIds]));
        setSelectedIds(new Set());
        notificationApi.success({
          message: t("cancelledSendSuccess"),
          description: t("cancelledSendSuccessDescription", { count: orderIds.length }),
          placement: "topRight",
        });
        void query.refetch();
      },
      onError: (error: unknown) => {
        notificationApi.error({
          message: t("cancelledSendError"),
          description: getBackendErrorMessage(error) ?? t("cancelledSendError"),
          placement: "topRight",
          duration: 5,
        });
      },
    });
  }, [handoverCancelledOrders, marketId, notificationApi, query, selectedIds, t]);

  return (
    <div className="space-y-5 pb-28 md:pb-6">
      <section className="relative overflow-hidden rounded-[28px] border border-red-300/20 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_94%,#ef4444_6%)_0%,var(--color-primary)_68%)] p-4 shadow-sm dark:border-red-300/10 dark:bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primarydark)_88%,#ef4444_12%)_0%,var(--color-primarydark)_72%)] sm:p-5">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-red-500/10 blur-3xl dark:bg-red-400/10" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <BackButton
              to="/new-orders/cancelled"
              className="shrink-0 border-red-300/20 bg-white/80 hover:border-red-400/40 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:hover:text-red-300"
              label=""
            />
            <HeaderName
              name={marketName}
              description={t("cancelledMarketDescription", { count: orders.length })}
              icon={<XCircle />}
            />
          </div>
          <ScannerActionButton
            onClick={() => {
              setScanError("");
              setIsCameraOpen(true);
            }}
            label={t("scanCancelledOrder")}
            showLabel
            className="w-full border-red-300/25! bg-red-500! text-white! shadow-lg! shadow-red-500/20! hover:bg-red-600! dark:text-white! lg:w-auto"
          />
        </div>
      </section>

      {query.isError ? (
        <QueryErrorState onRetry={() => void query.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              {
                key: "total",
                icon: <PackageX size={18} />,
                label: t("cancelledOrders"),
                value: String(orders.length),
                tone: "text-red-600 dark:text-red-300 bg-red-500/10 dark:bg-red-400/15",
              },
              {
                key: "ready",
                icon: <ScanLine size={18} />,
                label: t("cancelledReadyToSend"),
                value: String(selectableOrders.length),
                tone: "text-amber-600 dark:text-amber-300 bg-amber-500/10 dark:bg-amber-400/15",
              },
              {
                key: "selected",
                icon: <ClipboardCheck size={18} />,
                label: t("cancelledSelected"),
                value: String(selectedIds.size),
                tone: selectedIds.size
                  ? "text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-400/15"
                  : "text-main bg-main/10 dark:bg-main/20 dark:text-white",
              },
              {
                key: "amount",
                icon: <WalletCards size={18} />,
                label: t("totalAmount"),
                value: formatMoney(totalAmount),
                tone: "text-main bg-main/10 dark:bg-main/20 dark:text-white",
              },
            ].map((item) => (
              <div
                key={item.key}
                className="flex min-w-0 items-center gap-3 rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-3.5 shadow-sm dark:border-white/10 dark:bg-primarydark sm:p-4"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                  {item.icon}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-bold uppercase tracking-[0.13em] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                    {item.label}
                  </span>
                  <strong className="mt-0.5 block truncate text-lg font-black text-maindark dark:text-white">
                    {item.value}
                  </strong>
                </span>
              </div>
            ))}
          </div>

          <section className="overflow-hidden rounded-[28px] border border-[color:var(--color-border-soft)] bg-primary shadow-sm dark:border-white/10 dark:bg-primarydark">
            <div className="flex flex-col gap-4 border-b border-[color:var(--color-border-soft)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-main)_8%,var(--color-primary))_0%,var(--color-primary)_75%)] px-4 py-4 dark:border-white/10 dark:bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-main)_14%,var(--color-primarydark))_0%,var(--color-primarydark)_75%)] sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-main/10 text-main dark:bg-main/20 dark:text-white">
                  <ScanLine size={20} />
                </span>
                <div className="min-w-0">
                  <h3 className="m-0 text-base font-black text-maindark dark:text-white sm:text-lg">
                    {t("cancelledWorkflowTitle")}
                  </h3>
                  <p className="m-0 mt-1 text-xs font-semibold leading-5 text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)] sm:text-sm">
                    {t("cancelledScanHint")}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-4 text-sm font-bold text-emerald-700 dark:border-emerald-300/15 dark:text-emerald-200">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                  {t("scannerReady")}
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectAll(selectedIds.size !== selectableOrders.length)}
                  disabled={selectableOrders.length === 0 || handoverCancelledOrders.isPending}
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border-soft)] bg-white/80 px-4 text-sm font-bold text-maindark transition hover:border-main/35 hover:text-main disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                >
                  <CheckCircle2 size={16} />
                  {selectedIds.size === selectableOrders.length && selectableOrders.length > 0
                    ? t("deselectAll")
                    : t("selectAll")}
                </button>
              </div>
            </div>

            <div className="space-y-3 p-3 sm:p-4">
              {query.isLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-main/20 border-t-main" />
                </div>
              ) : orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={toOrderCardData(order)}
                  isSelected={selectedIds.has(order.id)}
                  onToggle={() => handleSelectChange(order.id, !selectedIds.has(order.id))}
                  showCheckbox={order.status === "cancelled"}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {selectedIds.size > 0 ? (
        <div className="sticky bottom-3 z-40 rounded-[24px] border border-red-300/25 bg-primary/95 p-3 shadow-[0_20px_55px_rgba(239,68,68,0.2)] backdrop-blur-xl dark:border-red-300/15 dark:bg-primarydark/95 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:bg-red-400/15 dark:text-red-300">
                <ClipboardCheck size={19} />
              </span>
              <div className="min-w-0">
                <p className="m-0 text-sm font-black text-maindark dark:text-white">
                  {t("cancelledSelectedCount", { count: selectedIds.size })}
                </p>
                <p className="m-0 mt-0.5 text-xs font-semibold text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                  {t("cancelledSendHint")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSendToMarket}
              disabled={handoverCancelledOrders.isPending}
              className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-red-500 to-red-600 px-5 text-sm font-black text-white shadow-lg shadow-red-500/25 transition hover:-translate-y-0.5 hover:from-red-600 hover:to-red-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:w-auto"
            >
              {handoverCancelledOrders.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {t("sendCancelledToMarket", { count: selectedIds.size })}
            </button>
          </div>
        </div>
      ) : null}

      <ScannerCameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onDecode={handleCameraDecode}
        title={t("scanCancelledOrder")}
        subtitle={t("cancelledScannerSubtitle")}
        waitingText={t("cancelledScanHint")}
        closeLabel={t("closeScanner")}
        torchOnLabel={t("torchOn")}
        torchOffLabel={t("torchOff")}
        invalidQrMessage={t("cancelledScanMissing")}
        loading={handoverCancelledOrders.isPending}
        loadingText={t("cancelledSending")}
        error={scanError}
      />
    </div>
  );
};

export default memo(CancelledMarketDetail);
