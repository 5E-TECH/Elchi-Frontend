import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  RotateCcw,
  ScanLine,
  SearchX,
  XCircle,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOrders } from "../../entities/orders";
import { useOrdersCoverage } from "../../entities/orders/ordersCoverage";
import type { OrderListItem } from "../../entities/order/types/order";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import PageContainer from "../../shared/ui/PageContainer";
import ScannerCameraModal from "../../shared/components/ScannerCameraModal";
import { useOrderQrScanner } from "../../shared/lib/useOrderQrScanner";
import { normalizeScannerCandidates } from "../../shared/lib/scanToken";
import { getBackendErrorMessage } from "../scan/lib/scanResource";
import { playScanFeedback } from "../scan/lib/scanShared";
import { useAppNotification } from "../../app/providers/notification/NotificationProvider";
import {
  extractCourierBulkOrders,
  extractCourierBulkTotal,
  findCourierBulkOrderByScanCandidates,
  getCourierBulkCounts,
  getCourierBulkFinalizeLabelCounts,
  getCourierBulkOrderAction,
  mergeCourierBulkOrders,
  runLimited,
  type CourierBulkAction,
  type CourierBulkOrder,
} from "./model/courierBulk";

const formatMoney = (value: unknown, locale: string, currency: string) =>
  `${Number(value || 0).toLocaleString(locale)} ${currency}`;

const getOrderDate = (order: CourierBulkOrder) => {
  const rawDate = order.created_at ?? order.createdAt;
  if (!rawDate) return "";

  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
  });
};

const getOrderTime = (order: CourierBulkOrder) => {
  const rawDate = order.created_at ?? order.createdAt;
  if (!rawDate) return "";

  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getDistrictName = (order: CourierBulkOrder) =>
  order.district?.name ?? order.region?.name ?? "-";

const getMarketName = (order: CourierBulkOrder) => order.market?.name ?? "-";

const actionClasses: Record<CourierBulkAction, string> = {
  sold: "border-[color:var(--color-border-soft)] bg-[color:var(--color-card-surface-strong)] dark:border-white/10 dark:bg-white/5",
  cancel: "border-error/30 bg-error/8 dark:border-error/35 dark:bg-error/12",
  tomorrow: "border-main/30 bg-main/10 dark:border-main/40 dark:bg-main/18",
};

const surfaceClass =
  "border border-[color:var(--color-border-soft)] bg-[color:var(--color-page-surface)] shadow-xl shadow-[color:var(--color-card-shadow)] dark:border-white/10 dark:bg-[color:var(--color-surface-elevated-dark)] dark:shadow-black/10";
const controlIdleClass =
  "border border-[color:var(--color-border-soft)] bg-[color:var(--color-card-surface)] text-[color:var(--color-maindark)] hover:border-main/40 hover:bg-main/10 dark:border-white/10 dark:bg-white/5 dark:text-primary dark:hover:bg-white/10";
const strongTextClass = "text-maindark dark:text-white";
const mutedTextClass = "text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]";
const COURIER_BULK_PAGE_LIMIT = 100;
const COURIER_BULK_MAX_PAGES = 50;

const fetchAllCourierWaitingOrders = async () => {
  const pages: CourierBulkOrder[][] = [];
  let loadedCount = 0;
  let expectedTotal: number | null = null;

  for (let page = 1; page <= COURIER_BULK_MAX_PAGES; page += 1) {
    const response = await api.get(API_ENDPOINTS.ORDERS.COURIER_ORDERS, {
      params: {
        status: "waiting",
        page,
        limit: COURIER_BULK_PAGE_LIMIT,
      },
    });

    const pageOrders = extractCourierBulkOrders(response.data);
    pages.push(pageOrders);
    loadedCount += pageOrders.length;
    expectedTotal ??= extractCourierBulkTotal(response.data);

    if (pageOrders.length < COURIER_BULK_PAGE_LIMIT) break;
    if (expectedTotal !== null && loadedCount >= expectedTotal) break;
  }

  return mergeCourierBulkOrders(pages);
};

const CourierBulkPage = () => {
  const { t, i18n } = useTranslation("courierBulk");
  const locale = i18n.language === "ru" ? "ru-RU" : i18n.language === "en" ? "en-US" : "uz-UZ";
  const currency = t("currency");
  const { api: notificationApi } = useAppNotification();
  const { SellOrder, CancelOrder } = useOrders();
  const { couldNotDeliver } = useOrdersCoverage();
  const { data: orders = [], isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["orders", "courier", "bulk", "waiting"],
    queryFn: fetchAllCourierWaitingOrders,
    staleTime: 15_000,
  });

  const [scanMode, setScanMode] = useState<Exclude<CourierBulkAction, "sold">>("cancel");
  const [actions, setActions] = useState<Record<string, CourierBulkAction>>({});
  const [scanError, setScanError] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const scannedTokenRef = useRef<Set<string>>(new Set());

  const counts = useMemo(() => getCourierBulkCounts(orders, actions), [actions, orders]);
  const finalizeCounts = getCourierBulkFinalizeLabelCounts(counts);
  const isInitialLoading = isLoading && orders.length === 0;
  const isBusy =
    isFinalizing ||
    SellOrder.isPending ||
    CancelOrder.isPending ||
    couldNotDeliver.isPending;

  const selectedCount = counts.cancel + counts.tomorrow;

  const setOrderAction = useCallback((order: OrderListItem, action: Exclude<CourierBulkAction, "sold">) => {
    setActions((prev) => ({
      ...prev,
      [order.id]: prev[order.id] === action ? "sold" : action,
    }));
  }, []);

  const handleScanMatch = useCallback((order: OrderListItem, rawValue: string) => {
    const tokenKey = rawValue.trim().toLowerCase() || order.id.toLowerCase();

    if (scannedTokenRef.current.has(tokenKey)) {
      notificationApi.warning({
        message: t("duplicateTitle"),
        description: t("duplicateDescription"),
        placement: "topRight",
      });
      void playScanFeedback("duplicate");
      return;
    }

    scannedTokenRef.current.add(tokenKey);
    setOrderAction(order, scanMode);
    setScanError("");
    notificationApi.success({
      message: t("scanSuccessTitle"),
      description: t(scanMode === "cancel" ? "markedCancel" : "markedTomorrow", {
        name: order.customer?.name ?? `#${order.id}`,
      }),
      placement: "topRight",
      duration: 2,
    });
    void playScanFeedback("success");
  }, [notificationApi, scanMode, setOrderAction, t]);

  const handleScanMissing = useCallback(() => {
    setScanError(t("scanMissing"));
    notificationApi.error({
      message: t("scanMissingTitle"),
      description: t("scanMissing"),
      placement: "topRight",
    });
    void playScanFeedback("missing");
  }, [notificationApi, t]);

  useOrderQrScanner({
    orders,
    enabled: !isBusy && orders.length > 0,
    onMatch: handleScanMatch,
    onMissing: handleScanMissing,
  });

  const clearActions = () => {
    setActions({});
    scannedTokenRef.current.clear();
    setScanError("");
  };

  const handleFinalize = async () => {
    if (orders.length === 0 || isBusy) return;

    setIsFinalizing(true);
    const tasks = orders.map((order) => ({
      order,
      action: getCourierBulkOrderAction(order.id, actions),
    }));

    const results = await runLimited(tasks, 6, async ({ order, action }) => {
      if (action === "cancel") {
        await CancelOrder.mutateAsync({
          orderId: order.id,
          data: {
            comment: t("bulkCancelComment"),
            extraCost: 0,
            paidAmount: 0,
          },
        });
        return;
      }

      if (action === "tomorrow") {
        await couldNotDeliver.mutateAsync({
          id: order.id,
          data: {
            comment: t("bulkTomorrowComment"),
          },
        });
        return;
      }

      await SellOrder.mutateAsync({
        orderId: order.id,
        data: {
          comment: t("bulkSoldComment"),
          extraCost: 0,
        },
      });
    });

    const failedCount = results.filter((result) => result.status === "rejected").length;

    setIsFinalizing(false);

    if (failedCount > 0) {
      const firstError = results.find((result) => result.status === "rejected");
      notificationApi.error({
        message: t("finalizeErrorTitle"),
        description:
          firstError?.status === "rejected"
            ? getBackendErrorMessage(firstError.reason) ?? t("finalizeErrorDescription", { count: failedCount })
            : t("finalizeErrorDescription", { count: failedCount }),
        placement: "topRight",
        duration: 5,
      });
      return;
    }

    notificationApi.success({
      message: t("finalizeSuccessTitle"),
      description: t("finalizeSuccessDescription", { count: orders.length }),
      placement: "topRight",
      duration: 3,
    });
    clearActions();
    void refetch();
  };

  return (
    <PageContainer>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-main text-white shadow-lg shadow-main/25">
              <Zap size={22} />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${strongTextClass}`}>{t("title")}</h1>
              <p className={`text-sm font-medium ${mutedTextClass}`}>{t("subtitle")}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={clearActions}
            disabled={selectedCount === 0 || isBusy}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:text-maindark disabled:cursor-not-allowed disabled:opacity-45 dark:hover:text-white"
          >
            <RotateCcw size={15} />
            {t("clear")}
          </button>
        </div>

        <section className={`rounded-2xl p-5 ${surfaceClass}`}>
          <div className="grid gap-2 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setScanMode("cancel")}
              className={`flex items-center justify-center gap-2 rounded-xl px-5 py-5 text-base font-bold transition ${
                scanMode === "cancel"
                  ? "bg-error text-white shadow-lg shadow-error/25"
                  : controlIdleClass
              }`}
            >
              <XCircle size={18} />
              {t("cancelMode", { count: counts.cancel })}
            </button>

            <button
              type="button"
              onClick={() => setScanMode("tomorrow")}
              className={`flex items-center justify-center gap-2 rounded-xl px-5 py-5 text-base font-bold transition ${
                scanMode === "tomorrow"
                  ? "bg-main text-white shadow-lg shadow-main/25"
                  : controlIdleClass
              }`}
            >
              <Clock3 size={18} />
              {t("tomorrowMode", { count: counts.tomorrow })}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsCameraOpen(true)}
            disabled={isBusy}
            className={`mt-3 flex w-full items-center justify-center gap-3 rounded-xl border border-dashed px-5 py-5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
              scanMode === "cancel"
                ? "border-error/75 text-error hover:bg-error/10 dark:text-error"
                : "border-main/75 text-main hover:bg-main/10 dark:border-main/75 dark:text-primary"
            }`}
          >
            <ScanLine size={18} />
            {t(scanMode === "cancel" ? "scanCancelReady" : "scanTomorrowReady")}
          </button>

          {scanError ? (
            <div className="mt-3 rounded-xl border border-error/25 bg-error/10 px-4 py-3 text-sm font-semibold text-error dark:text-error">
              {scanError}
            </div>
          ) : null}
        </section>

        <section className={`overflow-hidden rounded-2xl ${surfaceClass}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-border-soft)] px-4 py-3 dark:border-white/5">
            <h2 className={`text-base font-bold ${strongTextClass}`}>
              {t("ordersTitle", { count: counts.total })}
            </h2>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="flex items-center gap-1 text-error"><span className="h-2 w-2 rounded-full bg-error" />{counts.cancel}</span>
              <span className="flex items-center gap-1 text-main dark:text-primary"><span className="h-2 w-2 rounded-full bg-main dark:bg-primary" />{counts.tomorrow}</span>
              <span className="flex items-center gap-1 text-success"><span className="h-2 w-2 rounded-full bg-success" />{counts.sold}</span>
            </div>
          </div>

          <div className="max-h-[48vh] overflow-y-auto p-1">
            {isInitialLoading ? (
              <div className={`flex min-h-56 flex-col items-center justify-center gap-3 ${mutedTextClass}`}>
                <Loader2 className="animate-spin text-main" size={30} />
                <span className="text-sm font-semibold">{t("loading")}</span>
              </div>
            ) : isError ? (
              <div className={`flex min-h-56 flex-col items-center justify-center gap-3 px-4 text-center ${mutedTextClass}`}>
                <SearchX size={34} className="text-rose-400" />
                <span className="text-sm font-semibold">
                  {getBackendErrorMessage(error) ?? t("loadError")}
                </span>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="rounded-xl bg-main px-4 py-2 text-sm font-bold text-white transition hover:bg-main/90"
                >
                  {t("retry")}
                </button>
              </div>
            ) : orders.length === 0 ? (
              <div className={`flex min-h-56 flex-col items-center justify-center gap-3 ${mutedTextClass}`}>
                <SearchX size={34} className="text-main" />
                <span className="text-sm font-semibold">{t("empty")}</span>
              </div>
            ) : (
              <div className="space-y-1">
                {orders.map((order) => {
                  const action = getCourierBulkOrderAction(order.id, actions);

                  return (
                    <article
                      key={order.id}
                      className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition ${actionClasses[action]}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className={`truncate text-base font-bold ${strongTextClass}`}>
                            {order.customer?.name ?? `#${order.id}`}
                          </h3>
                          {action === "cancel" ? <XCircle size={15} className="text-error" /> : null}
                          {action === "tomorrow" ? <CalendarClock size={15} className="text-main dark:text-primary" /> : null}
                          {action === "sold" ? <CheckCircle2 size={15} className="text-success" /> : null}
                        </div>
                        <p className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium ${mutedTextClass}`}>
                          <span className="text-maindark dark:text-primary">{order.customer?.phone_number ?? "-"}</span>
                          <span>{getDistrictName(order)}</span>
                          <span className="font-bold text-main dark:text-primary">{getMarketName(order)}</span>
                          <span>{getOrderDate(order)} {getOrderTime(order)}</span>
                        </p>
                      </div>
                      <div className={`shrink-0 text-right text-base font-extrabold ${strongTextClass}`}>
                        {formatMoney(order.total_price, locale, currency)}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
          <div className="border-t border-[color:var(--color-border-soft)] bg-[color:var(--color-card-surface)] px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <div className="mb-3 flex flex-wrap gap-3 text-xs font-bold">
              <span className="text-error">{t("summaryCancel", { count: counts.cancel })}</span>
              <span className="text-success">{t("summarySold", { count: counts.sold })}</span>
              <span className="text-main dark:text-primary">{t("summaryTomorrow", { count: counts.tomorrow })}</span>
              {isFetching && !isInitialLoading ? (
                <span className={mutedTextClass}>{t("refreshing")}</span>
              ) : null}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <button
                type="button"
                disabled={counts.cancel === 0 || isBusy}
                onClick={() => {
                  const cancelOnly = Object.fromEntries(
                    Object.entries(actions).filter(([, action]) => action === "cancel"),
                  ) as Record<string, CourierBulkAction>;
                  setActions(cancelOnly);
                }}
                className={`flex items-center justify-center gap-2 rounded-xl px-5 py-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${controlIdleClass}`}
              >
                <XCircle size={17} />
                {t("applyCancelOnly", { count: counts.cancel })}
              </button>
              <button
                type="button"
                disabled={orders.length === 0 || isBusy}
                onClick={() => void handleFinalize()}
                className="flex items-center justify-center gap-2 rounded-xl bg-main px-5 py-4 text-sm font-extrabold text-white shadow-lg shadow-main/25 transition hover:bg-main/90 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isBusy ? <Loader2 size={17} className="animate-spin" /> : <Zap size={17} />}
                {t("finalizeDay", {
                  changed: finalizeCounts.changed,
                  sold: finalizeCounts.sold,
                })}
              </button>
            </div>
          </div>
        </section>
      </div>

      <ScannerCameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onDecode={(value) => {
          const matched = findCourierBulkOrderByScanCandidates(
            orders,
            normalizeScannerCandidates(value, window.location.origin),
          );

          if (matched) {
            handleScanMatch(matched, value);
            setIsCameraOpen(false);
            return;
          }

          handleScanMissing();
        }}
        title={t("scannerTitle")}
        subtitle={t("scannerSubtitle")}
        waitingText={t("scannerWaiting")}
        closeLabel={t("scannerClose")}
        torchOnLabel={t("torchOn")}
        torchOffLabel={t("torchOff")}
        invalidQrMessage={t("invalidQr")}
        error={scanError}
      />
    </PageContainer>
  );
};

export default memo(CourierBulkPage);
