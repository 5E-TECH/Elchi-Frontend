import { memo, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import PrintModeSelect, { type PrintSelectOption } from "../../../shared/components/PrintModeSelect";
import { useNavigate, useParams } from "react-router-dom";
import { Globe, FileText, CheckCircle2, Loader2, Plus } from "lucide-react";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import { GlobalSearchInput, useDebounce } from "../../../features/search";
import { useOrders } from "../../../entities/orders";
import { OrderCard, Checkbox, fmt } from "./OrderCard";
import type { ApiOrder } from "./OrderCard";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import PopupConfirm from "../../../shared/components/popupConfirm";
import { useOrderQrScanner } from "../../../shared/lib/useOrderQrScanner";
import {
  playMissingOrderFeedback,
  playScanFeedback,
} from "../../scan/lib/scanShared";
import BackButton from "../../../shared/ui/BackButton";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";

// ─── Main Component ───────────────────────────────────────────────────────────
const NewOrderDetail = () => {
  const { t } = useTranslation("newOrders");
  const navigate = useNavigate();
  const { marketId } = useParams();
  const roleState = useSelector((state: RootState) => state.role);
  const currentUser = useSelector((state: RootState) => state.user.user as Record<string, unknown> | null);
  const isMarketRole = roleState.role === "market";
  // Market roli bo'lsa har doim order qo'sha oladi
  const canAddOrder = isMarketRole;
  // Backend payloadlari farq qilgani uchun manager/registratorlarda
  // qabul qilishni doim transfer-batches endpointiga yo'naltiramiz.
  const shouldUseBranchTransferReceive =
    !isMarketRole &&
    !!currentUser &&
    (roleState.role === "manager" || roleState.role === "registrator");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isReceiveConfirmOpen, setIsReceiveConfirmOpen] = useState(false);
  const [receivedOrderIds, setReceivedOrderIds] = useState<Set<string>>(new Set());
  const pendingScanOrderIdsRef = useRef<Set<string>>(new Set());
  const selectedOrdersKeyRef = useRef("");

  const { useGetTodayOrdersByMarket, deleteOrder, createReceiveOrder, createTransferBatch } = useOrders();
  const receiveMutation = shouldUseBranchTransferReceive
    ? createTransferBatch
    : createReceiveOrder;
  const { api: notifApi } = useAppNotification();

  // Redux dan search qiymatini olish
  const searchQuery = useSelector((state: RootState) =>
    (state.search["new_order_detail_search"] as string) || ""
  );

  // Backend ga yuborish uchun debounce (500ms)
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const applyDebounce = useDebounce((val: string) => setDebouncedSearch(val), 500);

  useEffect(() => {
    applyDebounce(searchQuery);
  }, [searchQuery, applyDebounce]);

  const params = debouncedSearch.trim() ? { search: debouncedSearch.trim() } : undefined;
  const { data: res, isLoading, refetch } = useGetTodayOrdersByMarket(marketId ? Number(marketId) : 0, params);
  const rawOrders = useMemo<ApiOrder[]>(() => res?.data ?? res ?? [], [res]);
  const orders = useMemo(
    () => rawOrders.filter((order) => !receivedOrderIds.has(order.id)),
    [rawOrders, receivedOrderIds],
  );
  const ordersKey = orders.map((order) => order.id).join("|");

  const toggleSelect = useCallback((id: string) => {
    if (isMarketRole) return;
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) {
        s.delete(id);
      } else {
        s.add(id);
      }
      return s;
    });
  }, [isMarketRole]);

  useEffect(() => {
    if (isMarketRole) return;
    if (!orders.length || selectedOrdersKeyRef.current === ordersKey) return;

    selectedOrdersKeyRef.current = ordersKey;
    setSelectedIds(new Set(orders.map((order) => order.id)));
  }, [isMarketRole, orders, ordersKey]);

  const handleMissingScannedOrder = useCallback(() => {
    playMissingOrderFeedback();
    notifApi.warning({
      message: t("qrNotFound"),
      description: t("newOrderScanMissing"),
      placement: "topRight",
      duration: 3,
    });
  }, [notifApi, t]);

  const receiveScannedOrder = useCallback((order: ApiOrder) => {
    const orderId = order.id;
    if (pendingScanOrderIdsRef.current.has(orderId)) {
      return;
    }

    pendingScanOrderIdsRef.current.add(orderId);
    receiveMutation.mutate(
      { orderIds: [orderId] },
      {
        onSuccess: () => {
          void playScanFeedback("success");
          setReceivedOrderIds((prev) => {
            const next = new Set(prev);
            next.add(orderId);
            return next;
          });
          setSelectedIds((prev) => {
            if (!prev.has(orderId)) return prev;
            const next = new Set(prev);
            next.delete(orderId);
            return next;
          });
          void refetch();
          notifApi.success({
            message: t("newOrderReceiveSuccess"),
            description: t("newOrderReceiveDescription"),
            placement: "topRight",
            duration: 2,
          });
        },
        onError: (err: unknown) => {
          void playScanFeedback("error");
          const msg = getBackendErrorMessage(err) ?? t("receiveError");
          notifApi.error({
            message: t("receiveError"),
            description: msg,
            placement: "topRight",
            duration: 5,
          });
        },
        onSettled: () => {
          pendingScanOrderIdsRef.current.delete(orderId);
        },
      },
    );
  }, [receiveMutation, notifApi, refetch, t]);

  useOrderQrScanner({
    orders,
    onMatch: receiveScannedOrder,
    onMissing: handleMissingScannedOrder,
  });

  const toggleSelectAll = useCallback(() => {
    if (isMarketRole) return;
    setSelectedIds((p) => p.size === orders.length ? new Set() : new Set(orders.map((o) => o.id)));
  }, [isMarketRole, orders]);

  const handleEdit = useCallback((id: string) => navigate(`/new-orders/${marketId}/edit/${id}`), [navigate, marketId]);

  // 1-bosqich: popup ochish
  const handleDelete = useCallback((id: string) => {
    setDeleteTargetId(id);
  }, []);

  // 2-bosqich: tasdiqlash → API
  const handleConfirmDelete = useCallback(() => {
    if (!deleteTargetId) return;
    deleteOrder.mutate(deleteTargetId, {
      onSuccess: () => setDeleteTargetId(null),
      onError: () => setDeleteTargetId(null),
    });
  }, [deleteTargetId, deleteOrder]);

  const allSelected = selectedIds.size === orders.length && orders.length > 0;
  const totalSum = orders.reduce((s, o) => s + o.total_price, 0);


  const handleAccepted = useCallback(() => {
    // snapshot: setSelectedIds(new Set()) dan KEYIN selectedIds.size o'zgaradi,
    // lekin closure eski qiymatni ko'radi — shuning uchun oldindan saqlaymiz
    const ids = [...selectedIds];
    const isAll = ids.length === orders.length;
    receiveMutation.mutate({ orderIds: ids }, {
      onSuccess: () => {
        setReceivedOrderIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.add(id));
          return next;
        });
        setIsReceiveConfirmOpen(false);
        setSelectedIds(new Set());
        if (isAll) {
          navigate(-1);
        } else {
          refetch();
        }
      },
      onError: (err: unknown) => {
        setIsReceiveConfirmOpen(false);
        const msg = getBackendErrorMessage(err) ?? t("receiveError");
        notifApi.error({ message: t("receiveError"), description: msg, placement: "topRight", duration: 5 });
      },
    });
  }, [selectedIds, orders.length, receiveMutation, navigate, refetch, notifApi, t]);

  const handlePrint = useCallback(async (mode: string) => {
    const printableOrders = selectedIds.size > 0
      ? orders.filter((order) => selectedIds.has(order.id))
      : orders;

    if (!printableOrders.length) {
      notifApi.warning({
        message: t("print"),
        description: t("notFound"),
        placement: "topRight",
        duration: 4,
      });
      return;
    }

    if (mode === "pdf") {
      try {
        const { openOrdersLabelPdf } = await import("./lib/printLabelPdf");
        await openOrdersLabelPdf(printableOrders);
      } catch {
        notifApi.error({
          message: t("print"),
          description: t("printError"),
          placement: "topRight",
          duration: 5,
        });
      }
      return;
    }

    // Browser print (fallback)
    try {
      const { openOrdersLabelBrowserPrint } = await import("./lib/printLabelPdf");
      openOrdersLabelBrowserPrint(printableOrders);
    } catch {
      notifApi.error({
        message: t("print"),
        description: t("printError"),
        placement: "topRight",
        duration: 5,
      });
    }
  }, [notifApi, orders, selectedIds, t]);

  const printOptions = useMemo<PrintSelectOption[]>(
    () => [
      {
        id: "browser",
        label: t("browserPrint"),
        hint: t("anyPrinter"),
        icon: <Globe size={14} className="text-emerald-500" />,
      },
      {
        id: "pdf",
        label: t("pdfPrint"),
        hint: t("gainschaPrinter"),
        icon: <FileText size={14} className="text-amber-500" />,
      },
    ],
    [t],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl">

      {/* Header */}
      <div className="py-3 pb-3 sm:py-4 sm:pb-4 md:py-6 md:pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {!isMarketRole ? (
              <BackButton className="mt-1 h-10 min-w-10 shrink-0 rounded-xl px-2" label="" />
            ) : null}
            <div className="group relative min-w-0 overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-elevated)] p-3 dark:bg-[color:var(--color-surface-elevated-dark)] sm:p-4">
              <div className="pointer-events-none absolute -left-6 top-1/2 h-14 w-14 -translate-y-1/2 rounded-full bg-main/12 blur-xl transition-all duration-300 group-hover:bg-main/18" />
              <div className="relative flex items-start">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-extrabold leading-tight text-maindark dark:text-primary">
                    {t("ordersHeader")}
                  </h2>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-maindark/65 dark:text-primary/70 sm:text-sm">
                    {t("totalCount", { count: orders.length })} • {fmt(totalSum)} so'm
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
            <div className="w-full sm:flex-1 lg:w-80 lg:flex-none">
              <GlobalSearchInput searchKey="new_order_detail_search" placeholder={t("searchOrder")} />
            </div>

            {/* Market roli uchun buyurtma qo'shish tugmasi */}
            {canAddOrder && (
              <button
                onClick={() => navigate("/orders/add")}
                className="flex items-center justify-center gap-2 rounded-2xl bg-main px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-main/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-main/90 active:translate-y-0 sm:w-auto"
              >
                <Plus size={16} />
                {t("addOrderBtn")}
              </button>
            )}

            {!isMarketRole && (
              <PrintModeSelect
                count={selectedIds.size}
                onSelect={(mode) => {
                  void handlePrint(mode);
                }}
                buttonLabel={t("print")}
                menuLabel={t("print")}
                options={printOptions}
                className={selectedIds.size === 0 ? "bg-main/40 shadow-none border-main/40 text-white" : "bg-main hover:bg-main/90 border-main text-white shadow-md shadow-main/20"}
              />
            )}
          </div>
        </div>

        {/* Select All */}
        {!isMarketRole && (
          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-gray-200 bg-white px-3 py-3 dark:border-white/5 dark:bg-maindark sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div onClick={toggleSelectAll} className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={allSelected} onChange={toggleSelectAll} />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {allSelected ? t("deselectAll") : t("selectAll")}
              </span>
            </div>
            {selectedIds.size > 0 && (
              <span className="text-xs font-bold text-white bg-main px-2.5 py-1 rounded-lg">{t("selectedCount", { count: selectedIds.size })}</span>
            )}
          </div>
        )}
      </div>

      {/* Orders List */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-24 sm:pb-28 md:pb-4">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-main/20 border-t-main animate-spin" />
          </div>
        ) : orders.length > 0 ? orders.map((order) => (
          <OrderCard key={order.id} order={order}
            isSelected={!isMarketRole && selectedIds.has(order.id)}
            onToggle={() => toggleSelect(order.id)}
            onEdit={handleEdit}
            onDelete={handleDelete}
            showCheckbox={!isMarketRole}
          />
        )) : (
          <div className="h-64 flex flex-col items-center justify-center text-gray-300 dark:text-gray-700">
            <FileText size={48} className="mb-4 opacity-20" />
            <p className="font-bold uppercase tracking-widest text-sm opacity-50">{t("notFound")}</p>
          </div>
        )}
      </div>

      {/* Sticky Footer — doim pastda qotib turadi */}
      {!isMarketRole && (
        <div className="shrink-0 border-t border-gray-100 bg-transparent py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] dark:border-white/5 sm:py-4">
          <button
            onClick={() => setIsReceiveConfirmOpen(true)}
            disabled={receiveMutation.isPending || selectedIds.size === 0}
            className={`w-full flex items-center justify-center gap-3 rounded-2xl py-3.5 text-sm font-bold text-white sm:py-4 sm:text-base
              bg-linear-to-r from-emerald-500 to-emerald-400 shadow-xl shadow-emerald-500/30
              hover:shadow-emerald-500/50 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer
              disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0
              ${selectedIds.size === 0 ? "opacity-40" : "opacity-100"}`}
          >
            {receiveMutation.isPending
              ? <Loader2 size={20} className="animate-spin" />
              : <CheckCircle2 size={20} />}
            {receiveMutation.isPending
              ? t("receiving")
              : selectedIds.size > 0
                ? t("receiveOrders", { count: selectedIds.size })
                : t("selectOrders")}
          </button>
        </div>
      )}

      {/* Delete tasdiqlash popupi */}
      <PopupConfirm
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleConfirmDelete}
        isLoading={deleteOrder.isPending}
        title={t("deleteOrderTitle")}
        message={t("deleteOrderMessage")}
      />

      <PopupConfirm
        isOpen={isReceiveConfirmOpen}
        onClose={() => setIsReceiveConfirmOpen(false)}
        onConfirm={handleAccepted}
        isLoading={receiveMutation.isPending}
        title={t("receiveOrderTitle")}
        message={t("receiveOrderMessage")}
        confirmLabel={t("receiveConfirm")}
        variant="success"
      />
    </div>
  );
};

export default memo(NewOrderDetail);
