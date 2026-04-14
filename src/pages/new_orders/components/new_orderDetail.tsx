import { memo, useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import HeaderName from "../../../shared/components/headerName";
import { MoveLeft, Printer, Globe, FileText, ChevronDown, CheckCircle2, Loader2 } from "lucide-react";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import { useNavigate, useParams } from "react-router-dom";
import { GlobalSearchInput, useDebounce } from "../../../features/search";
import { useOrders } from "../../../entities/orders";
import { OrderCard, Checkbox, fmt } from "./OrderCard";
import type { ApiOrder } from "./OrderCard";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import PopupConfirm from "../../../shared/components/popupConfirm";

const printOptions = [
  { key: "thermal", icon: <Printer size={18} />, bg: "bg-blue-500/10 text-blue-500", titleKey: "thermalPrinter", subKey: "viaMqtt" },
  { key: "browser", icon: <Globe size={18} />, bg: "bg-emerald-500/10 text-emerald-500", titleKey: "browserPrint", subKey: "anyPrinter" },
  { key: "pdf", icon: <FileText size={18} />, bg: "bg-amber-500/10 text-amber-500", titleKey: "pdfPrint", subKey: "gainschaPrinter" },
];

// ─── Main Component ───────────────────────────────────────────────────────────
const NewOrderDetail = () => {
  const { t } = useTranslation("newOrders");
  const navigate = useNavigate();
  const { marketId } = useParams();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isReceiveConfirmOpen, setIsReceiveConfirmOpen] = useState(false);

  const { getTodayOrdersByMarket, deleteOrder, createReceiveOrder } = useOrders();
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
  const { data: res, isLoading, refetch } = getTodayOrdersByMarket(marketId ? Number(marketId) : 0, params);
  const orders: ApiOrder[] = res?.data ?? res ?? [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((p) => p.size === orders.length ? new Set() : new Set(orders.map((o) => o.id)));
  }, [orders]);

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
    createReceiveOrder.mutate({ order_ids: ids }, {
      onSuccess: () => {
        setIsReceiveConfirmOpen(false);
        setSelectedIds(new Set());
        if (isAll) {
          navigate(-1);
        } else {
          refetch();
        }
      },
      onError: (err: any) => {
        setIsReceiveConfirmOpen(false);
        const msg = err?.response?.data?.message ?? err?.message ?? t("receiveError");
        notifApi.error({ message: t("receiveError"), description: msg, placement: "topRight", duration: 5 });
      },
    });
  }, [selectedIds, orders.length, createReceiveOrder, navigate, refetch, notifApi, t]);

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
      const { openOrdersLabelPdf } = await import("./lib/printLabelPdf");
      openOrdersLabelPdf(printableOrders);
      setIsOpen(false);
      return;
    }

    notifApi.info({
      message: t("print"),
      description: "Hozircha faqat PDF (60x100mm) format tayyorlandi.",
      placement: "topRight",
      duration: 4,
    });
    setIsOpen(false);
  }, [notifApi, orders, selectedIds, t]);

  return (
    <div className="flex flex-col h-full rounded-2xl bg-sidebar dark:bg-maindark overflow-hidden">

      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex justify-between items-center">
          <div onClick={() => navigate(-1)} className="cursor-pointer">
            <HeaderName name={t("ordersHeader")} description={`${t("totalCount", { count: orders.length })} • ${fmt(totalSum)} so'm`} icon={<MoveLeft />} />
          </div>

          <div className="flex items-center gap-3">
            <GlobalSearchInput searchKey="new_order_detail_search" placeholder={t("searchOrder")} />

            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setIsOpen((p) => !p)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-main hover:bg-main/90 text-white font-semibold text-sm transition-all shadow-md shadow-main/20 cursor-pointer">
                <Printer size={16} /> {t("print")}
                <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-primarydark shadow-2xl z-50 p-2">
                  {printOptions.map((o) => (
                    <button key={o.key} onClick={() => { void handlePrint(o.key); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer">
                      <div className={`p-2 rounded-lg ${o.bg} shrink-0`}>{o.icon}</div>
                      <div className="text-left">
                        <div className="text-sm font-semibold text-gray-800 dark:text-white">{t(o.titleKey)}</div>
                        <div className="text-xs text-gray-400">{t(o.subKey)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Select All */}
        <div className="mt-4 flex items-center justify-between px-4 py-3 rounded-xl bg-white dark:bg-maindark border border-gray-200 dark:border-white/5">
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
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-4 space-y-3">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-main/20 border-t-main animate-spin" />
          </div>
        ) : orders.length > 0 ? orders.map((order) => (
          <OrderCard key={order.id} order={order}
            isSelected={selectedIds.has(order.id)}
            onToggle={() => toggleSelect(order.id)}
            onEdit={handleEdit} onDelete={handleDelete} />
        )) : (
          <div className="h-64 flex flex-col items-center justify-center text-gray-300 dark:text-gray-700">
            <FileText size={48} className="mb-4 opacity-20" />
            <p className="font-bold uppercase tracking-widest text-sm opacity-50">{t("notFound")}</p>
          </div>
        )}
      </div>

      {/* Sticky Footer — doim pastda qotib turadi */}
      <div className="shrink-0 bg-sidebar dark:bg-maindark border-t border-gray-100 dark:border-white/5 px-6 py-4">
        <button
          onClick={() => setIsReceiveConfirmOpen(true)}
          disabled={createReceiveOrder.isPending || selectedIds.size === 0}
          className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base text-white
            bg-linear-to-r from-emerald-500 to-emerald-400 shadow-xl shadow-emerald-500/30
            hover:shadow-emerald-500/50 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer
            disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0
            ${selectedIds.size === 0 ? "opacity-40" : "opacity-100"}`}
        >
          {createReceiveOrder.isPending
            ? <Loader2 size={20} className="animate-spin" />
            : <CheckCircle2 size={20} />}
          {createReceiveOrder.isPending
            ? t("receiving")
            : selectedIds.size > 0
              ? t("receiveOrders", { count: selectedIds.size })
              : t("selectOrders")}
        </button>
      </div>

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
        isLoading={createReceiveOrder.isPending}
        title={t("receiveOrderTitle")}
        message={t("receiveOrderMessage")}
        confirmLabel={t("receiveConfirm")}
        variant="warning"
      />
    </div>
  );
};

export default memo(NewOrderDetail);
