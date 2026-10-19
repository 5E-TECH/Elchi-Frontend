// dizayn-v2: superadmin-neworders-market-orders, superadmin-neworders-receive-confirm-dialog, admin-neworders-market-detail, admin-neworders-market-confirm-dialog, manager-new-orders-market-detail, manager-new-orders-receive-confirm-dialog, manager-new-orders-delete-confirm-dialog, registrator-new-orders-market-detail, registrator-new-orders-market-detail-receive-dialog, registrator-new-orders-market-detail-delete-dialog, market-new-orders-list, market-new-orders-delete-dialog
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Check, Info, ScanLine, SearchX } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { branchTypeOf, canViewBatchesPage } from "../../../app/lib/access";
import { useOrders } from "../../../entities/orders";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { useOrderQrScanner } from "../../../shared/lib/useOrderQrScanner";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  QueryBoundary,
  Skeleton,
  TextInput,
  type DataTableSelection,
  type DataTableSort,
} from "../../../shared/ui/primitives";
import { normalizeScannerCandidates } from "../../../shared/lib/scanToken";
import { playMissingOrderFeedback, playScanFeedback } from "../../../shared/lib/scanner/feedback";
import { useHasNewOrdersTabs } from "../model/useNewOrdersTabs";
import { listOf } from "../model/todayMarkets";
import NewOrdersTabs from "../ui/NewOrdersTabs";
import { DetailAlert } from "./detail/DetailAlert";
import { DeleteOrderDialog, ReceiveConfirmDialog } from "./marketOrders/MarketOrderDialogs";
import { MarketOrdersTable } from "./marketOrders/MarketOrdersTable";
import { SelectionBar } from "./marketOrders/SelectionBar";
import {
  DEFAULT_MARKET_ORDERS_SORT,
  matchesMarketOrderSearch,
  pickUnselectedPreview,
  readMarketName,
  readUserBranchName,
  sortMarketOrders,
  sumTotalPrice,
  type MarketOrder,
} from "./marketOrders/marketOrdersModel";
import { resolveReceiveMode } from "./newOrderReceiveRules";

/**
 * MARKETNING BUGUNGI YANGI BUYURTMALARI — `/new-orders/:marketId`, dizayn v2.
 *
 *  - Xodim (superadmin/admin/menejer/registrator; qobiq `bare`): «← Qabul va yaratish» · market nomi ·
 *    «Bugungi yangi buyurtmalar · 6 ta · 1 050 000 so'm», asosiy amal «Qabul qilish — N ta buyurtma».
 *    Karta: qidiruv + «QR skanerlansa…» + «USB skaner tayyor», tanlov paneli (chop etish), jadval/kartalar.
 *    USB skaner (klaviatura) bilan o'qilgan buyurtma darhol qabul qilinadi (`useOrderQrScanner`).
 *  - REGIONAL xodim: qabul yo'q — «Biriktirish» maslahati (`role="note"`), tanlov faqat chop etish uchun.
 *  - Market (qobiq `hosted`): sarlavha qobiqda; karta «Yangi buyurtmalar / Bekor qilinganlar» tablari bilan
 *    boshlanadi, tanlov va skaner yo'q, faqat o'chirish va ochish.
 *
 * Qabul usuli — `newOrderReceiveRules.ts` (HQ — `POST /orders/receive`, PICKUP/HYBRID — transfer-batches).
 */
const NewOrderDetail = () => {
  const { t, i18n } = useTranslation(["newOrders", "orders", "common"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const location = useLocation();
  const { marketId = "" } = useParams();
  const roleState = useSelector((state: RootState) => state.role);
  const currentUser = useSelector((state: RootState) => state.user.user as Record<string, unknown> | null);
  const isMarketRole = roleState.role === "market";
  // Qabul usuli rol va filial turidan kelib chiqadi (newOrderReceiveRules.ts):
  // HQ menejer/registratori — POST /orders/receive (HQ ning ota filiali yo'q,
  // transfer-batches 400 qaytaradi); boshqa filiallarda — transfer-batches.
  // Profil hali yuklanmagan bo'lsa — avvalgidek POST /orders/receive.
  const branchType = useSelector(branchTypeOf);
  const receiveMode = resolveReceiveMode(roleState.role, branchType);
  const shouldUseBranchTransferReceive = !!currentUser && receiveMode === "transfer";
  // fix3 CODE-17: REGIONAL xodimida qabul tugmasi va skaner-qabul yo'q
  // (backend transfer batch'ni doim 403 qiladi) — o'rniga /dispatch maslahati.
  const canReceive = !isMarketRole && receiveMode !== "none";
  const showReceiveViaDispatchHint = !isMarketRole && receiveMode === "none";
  const canOpenBatches = useSelector(canViewBatchesPage);
  const hasTabs = useHasNewOrdersTabs();
  // Qabul oynasida filial nomi faqat to'g'ridan-to'g'ri qabulda (transferda buyurtma HQ'ga jo'natiladi).
  const branchName = !isMarketRole && receiveMode === "receive" ? readUserBranchName(currentUser) : null;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<MarketOrder | null>(null);
  const [isReceiveConfirmOpen, setIsReceiveConfirmOpen] = useState(false);
  const [receivedOrderIds, setReceivedOrderIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<DataTableSort | null>(DEFAULT_MARKET_ORDERS_SORT);
  const pendingScanOrderIdsRef = useRef<Set<string>>(new Set());
  const receivedScanKeysRef = useRef<Set<string>>(new Set());

  const { useGetTodayOrders, useGetTodayOrdersByMarket, deleteOrder, createReceiveOrder, createTransferBatch } =
    useOrders();
  const receiveMutation = shouldUseBranchTransferReceive ? createTransferBatch : createReceiveOrder;

  // Qidiruv mijoz tomonida (backend `markets/:id/new` qidiruv parametrini qabul qilmaydi). Parametrsiz so'rov
  // kaliti market tabidagi son bilan umumiy (`useNewOrdersTabs`).
  const ordersQuery = useGetTodayOrdersByMarket(marketId ? Number(marketId) : 0);
  const { data: res, refetch } = ordersQuery;
  const rawOrders = useMemo(() => listOf<MarketOrder>(res), [res]);
  const orders = useMemo(
    () => rawOrders.filter((order) => !receivedOrderIds.has(order.id)),
    [rawOrders, receivedOrderIds],
  );
  const visibleRows = useMemo(
    () => sortMarketOrders(orders.filter((order) => matchesMarketOrderSearch(order, search)), sort),
    [orders, search, sort],
  );

  // Sarlavhadagi market nomi: buyurtmadan; ro'yxat bo'sh bo'lsa — marketlar ro'yxati (kesh «Marketlar» bilan umumiy).
  const nameFromOrders = readMarketName(rawOrders, undefined, marketId);
  const marketsQuery = useGetTodayOrders(undefined, !isMarketRole && ordersQuery.isSuccess && !nameFromOrders);
  const marketName = nameFromOrders ?? readMarketName([], marketsQuery.data, marketId);

  const rememberReceivedScan = useCallback((order: MarketOrder, rawValue?: string) => {
    const keys = receivedScanKeysRef.current;
    keys.add(String(order.id).toLowerCase());

    const token = order.qr_code_token?.trim();
    if (token) keys.add(token.toLowerCase());

    if (rawValue) {
      normalizeScannerCandidates(rawValue, window.location.origin).forEach((candidate) => {
        keys.add(candidate);
      });
    }
  }, []);

  const showAlreadyReceivedFeedback = useCallback(
    (orderId?: string | number) => {
      void playScanFeedback("duplicate", t("common:scannerFeedbackDuplicate"));
      notify.warning(t("common:scannerFeedbackDuplicate"), {
        description: orderId ? `№${orderId}` : t("newOrderAlreadyReceivedDescription"),
        duration: 2000,
      });
    },
    [t],
  );

  const handleMissingScannedOrder = useCallback(
    (rawValue: string) => {
      const isAlreadyReceived = normalizeScannerCandidates(rawValue, window.location.origin).some((candidate) =>
        receivedScanKeysRef.current.has(candidate),
      );

      if (isAlreadyReceived) {
        showAlreadyReceivedFeedback();
        return;
      }

      playMissingOrderFeedback();
      notify.warning(t("newOrderScanMissing"), { duration: 3000 });
    },
    [showAlreadyReceivedFeedback, t],
  );

  const receiveScannedOrder = useCallback(
    (order: MarketOrder, rawValue: string) => {
      const orderId = order.id;
      if (receivedOrderIds.has(orderId)) {
        rememberReceivedScan(order, rawValue);
        showAlreadyReceivedFeedback(orderId);
        return;
      }

      if (pendingScanOrderIdsRef.current.has(orderId)) {
        return;
      }

      pendingScanOrderIdsRef.current.add(orderId);
      receiveMutation.mutate(
        { orderIds: [orderId] },
        {
          onSuccess: () => {
            rememberReceivedScan(order, rawValue);
            void playScanFeedback("success", t("newOrderReceiveSuccess"));
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
            notify.success(t("newOrderReceiveSuccess"), {
              description: t("newOrderReceiveDescription"),
              duration: 2000,
            });
          },
          onError: (err: unknown) => {
            const msg = getBackendErrorMessage(err) ?? t("receiveError");
            const lowerMsg = msg.toLowerCase();
            const isAlreadyReceived =
              lowerMsg.includes("already") || lowerMsg.includes("allaqachon") || lowerMsg.includes("qabul qilingan");

            if (isAlreadyReceived) {
              rememberReceivedScan(order, rawValue);
              setReceivedOrderIds((prev) => {
                const next = new Set(prev);
                next.add(orderId);
                return next;
              });
              showAlreadyReceivedFeedback(orderId);
              return;
            }

            void playScanFeedback("error");
            notify.error(t("receiveError"), { description: msg });
          },
          onSettled: () => {
            pendingScanOrderIdsRef.current.delete(orderId);
          },
        },
      );
    },
    [receiveMutation, receivedOrderIds, refetch, rememberReceivedScan, showAlreadyReceivedFeedback, t],
  );

  const scannerEnabled = canReceive && rawOrders.length > 0;
  useOrderQrScanner({
    orders: rawOrders,
    enabled: scannerEnabled,
    onMatch: receiveScannedOrder,
    onMissing: handleMissingScannedOrder,
  });

  // «Barchasini tanlash» — qabul qilinmagan barcha buyurtmalar (qidiruvdan qat'i nazar, avvalgidek).
  const allSelected = orders.length > 0 && orders.every((order) => selectedIds.has(order.id));
  const toggleSelectAll = useCallback(() => {
    if (isMarketRole) return;
    setSelectedIds((prev) =>
      orders.length > 0 && orders.every((order) => prev.has(order.id))
        ? new Set()
        : new Set(orders.map((order) => order.id)),
    );
  }, [isMarketRole, orders]);

  const selection = useMemo<DataTableSelection<MarketOrder> | undefined>(
    () =>
      isMarketRole
        ? undefined
        : {
            isSelected: (order) => selectedIds.has(order.id),
            onToggle: (order, checked) =>
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (checked) next.add(order.id);
                else next.delete(order.id);
                return next;
              }),
            // Sarlavhadagi belgi — ko'rinib turgan (qidiruvdagi) qatorlar.
            onToggleAll: (checked) =>
              setSelectedIds((prev) => {
                const next = new Set(prev);
                visibleRows.forEach((order) => (checked ? next.add(order.id) : next.delete(order.id)));
                return next;
              }),
            headerLabel: t("marketOrders.selectAllLabel"),
            rowLabel: (order) => t("marketOrders.selectRow", { id: order.id }),
          },
    [isMarketRole, selectedIds, t, visibleRows],
  );

  // Xodimda qator (karta) bosilsa — tanlov (avvalgi kartadagidek); marketda — buyurtmani ochish.
  const handleRowClick = useCallback(
    (order: MarketOrder) => {
      if (isMarketRole) {
        navigate(`/new-orders/${marketId}/edit/${order.id}`);
        return;
      }
      selection?.onToggle(order, !selectedIds.has(order.id));
    },
    [isMarketRole, marketId, navigate, selectedIds, selection],
  );

  // Tasdiqlansa — API; xato bo'lsa oynada ko'rsatiladi va oyna ochiq qoladi.
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteOrder.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteOrder, deleteTarget]);

  // Sukut — hech narsa tanlanmagan (QMvu5Ajx): operator o'zi belgilaydi yoki «Barchasini tanlash». Son, qabul va
  // chop etish faqat ro'yxatda turgan tanlanganlardan — qabul qilingan / o'chirilgan buyurtma tanlovda qolib ketmaydi.
  const selectedOrders = useMemo(() => orders.filter((order) => selectedIds.has(order.id)), [orders, selectedIds]);
  const selectedTotal = sumTotalPrice(selectedOrders);
  const totalSum = sumTotalPrice(orders);

  const handleAccepted = useCallback(() => {
    // snapshot: setSelectedIds(new Set()) dan KEYIN tanlov o'zgaradi,
    // lekin closure eski qiymatni ko'radi — shuning uchun oldindan saqlaymiz
    const ids = selectedOrders.map((order) => order.id);
    const isAll = ids.length === orders.length;
    receiveMutation.mutate(
      { orderIds: ids },
      {
        onSuccess: () => {
          setReceivedOrderIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.add(id));
            return next;
          });
          setIsReceiveConfirmOpen(false);
          setSelectedIds(new Set());
          if (isAll) {
            // Hammasi qabul qilindi — ro'yxatga qaytish (havoladan ochilgan bo'lsa — «Qabul va yaratish»).
            if (location.key !== "default") navigate(-1);
            else navigate("/new-orders");
          } else {
            void refetch();
          }
        },
        onError: (err: unknown) => {
          setIsReceiveConfirmOpen(false);
          const msg = getBackendErrorMessage(err) ?? t("receiveError");
          notify.error(t("receiveError"), { description: msg });
        },
      },
    );
  }, [location.key, navigate, orders.length, receiveMutation, refetch, selectedOrders, t]);

  const handlePrint = useCallback(
    async (mode: string) => {
      const printableOrders = selectedOrders.length > 0 ? selectedOrders : orders;

      if (!printableOrders.length) {
        notify.warning(t("print"), { description: t("notFound") });
        return;
      }

      if (mode === "pdf") {
        try {
          const { openOrdersLabelPdf } = await import("./lib/printLabelPdf");
          await openOrdersLabelPdf(printableOrders);
        } catch {
          notify.error(t("print"), { description: t("printError") });
        }
        return;
      }

      // Brauzer orqali chop etish
      try {
        const { openOrdersLabelBrowserPrint } = await import("./lib/printLabelPdf");
        openOrdersLabelBrowserPrint(printableOrders);
      } catch {
        notify.error(t("print"), { description: t("printError") });
      }
    },
    [orders, selectedOrders, t],
  );

  // ─── Ko'rinish ───────────────────────────────────────────────────────────────
  const qty = (count: number) => t("marketOrders.ordersQty", { value: formatNumberLocalized(count, { language }) });
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const isLoaded = res !== undefined;
  const cardTitle = marketName ?? t("marketOrders.titleFallback");

  const searchField = (
    <TextInput
      mode="search"
      value={search}
      onValueChange={setSearch}
      placeholder={isMarketRole ? t("marketOrders.marketSearchPlaceholder") : t("marketOrders.searchPlaceholder")}
      aria-label={t("marketOrders.searchLabel")}
      className="min-w-0 max-w-[480px] flex-[1_1_320px]"
    />
  );

  const toolbar = isMarketRole ? (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 max-md:px-4">
      {searchField}
      {isLoaded ? (
        <p className="text-sm text-text-muted">
          <Trans
            t={t}
            i18nKey="marketOrders.marketSummary"
            values={{ value: formatNumberLocalized(orders.length, { language }), sum: money(totalSum) }}
            components={{ strong: <strong className="font-semibold text-text" /> }}
          />
        </p>
      ) : null}
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 max-md:px-4">
      {searchField}
      {canReceive || scannerEnabled ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          {canReceive ? (
            <p className="flex items-center gap-1.5 text-xs text-text-muted">
              <ScanLine size={16} aria-hidden="true" className="shrink-0" />
              <span>{t("marketOrders.scanHint")}</span>
            </p>
          ) : null}
          {scannerEnabled ? (
            <Badge tone="success" dot role="status" className="max-md:hidden">
              {t("marketOrders.scannerReady")}
            </Badge>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const emptyState = (
    <EmptyState
      title={t("marketOrders.emptyTitle")}
      description={isMarketRole ? t("marketOrders.marketEmptyDescription") : t("marketOrders.emptyDescription")}
    />
  );

  const list = (
    <QueryBoundary
      query={{ ...ordersQuery, data: isLoaded ? orders : undefined }}
      skeleton="table"
      loadingLabel={t("marketOrders.loading")}
      empty={emptyState}
      className="border-t border-border"
    >
      {() =>
        visibleRows.length > 0 ? (
          <MarketOrdersTable
            variant={isMarketRole ? "market" : "staff"}
            rows={visibleRows}
            marketId={marketId}
            compactKeeps={roleState.role === "manager" || roleState.role === "registrator" ? "products" : "delivery"}
            sort={sort}
            onSortChange={setSort}
            selection={selection}
            onRowClick={handleRowClick}
            onDelete={setDeleteTarget}
            label={t("marketOrders.tableLabel")}
            busy={ordersQuery.isFetching}
          />
        ) : (
          <EmptyState
            icon={SearchX}
            title={t("marketOrders.noMatchTitle")}
            description={t("marketOrders.noMatchDescription")}
            action={
              <Button variant="secondary" size="sm" onClick={() => setSearch("")}>
                {t("marketOrders.clearSearch")}
              </Button>
            }
          />
        )
      }
    </QueryBoundary>
  );

  const deleteDialog = (
    <DeleteOrderDialog
      order={deleteTarget}
      variant={isMarketRole ? "market" : "staff"}
      marketName={marketName}
      onCancel={() => setDeleteTarget(null)}
      onConfirm={handleConfirmDelete}
    />
  );

  // Market — sarlavha va sahifa ildizi qobiqda (`hosted`); karta tablar bilan boshlanadi.
  if (isMarketRole) {
    return (
      <>
        <Card
          as="section"
          padding="none"
          aria-label={t("marketOrders.marketCardLabel")}
          title={hasTabs ? undefined : t("marketOrders.marketHeadTitle")}
        >
          <NewOrdersTabs />
          {toolbar}
          {list}
        </Card>
        {deleteDialog}
      </>
    );
  }

  const receiveCount = formatNumberLocalized(selectedOrders.length, { language });

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        back="/new-orders"
        backLabel={t("pageTitle")}
        title={marketName ?? (ordersQuery.isLoading ? <Skeleton width={224} height={32} /> : cardTitle)}
        description={
          isLoaded ? (
            <>
              {t("marketOrders.todayNew")} · <span className="whitespace-nowrap">{qty(orders.length)}</span> ·{" "}
              <span className="whitespace-nowrap">{money(totalSum)}</span>
            </>
          ) : null
        }
        actions={
          canReceive ? (
            <Button
              leftIcon={Check}
              aria-haspopup="dialog"
              disabled={selectedOrders.length === 0}
              loading={receiveMutation.isPending}
              loadingText={t("receiving")}
              onClick={() => setIsReceiveConfirmOpen(true)}
            >
              <Trans
                t={t}
                i18nKey="marketOrders.receive"
                values={{ value: receiveCount }}
                count={selectedOrders.length}
                components={{ long: <span className="max-md:hidden" /> }}
              />
            </Button>
          ) : null
        }
      />

      {showReceiveViaDispatchHint ? (
        <DetailAlert tone="info" icon={Info} role="note">
          {t("receiveViaDispatchHint")}
        </DetailAlert>
      ) : null}

      <Card as="section" padding="none" aria-label={t("marketOrders.cardLabel", { market: cardTitle })}>
        {toolbar}
        {orders.length > 0 ? (
          <SelectionBar
            selectedCount={selectedOrders.length}
            selectedTotal={selectedTotal}
            allSelected={allSelected}
            onToggleAll={toggleSelectAll}
            transferHint={receiveMode === "transfer"}
            printOnly={!canReceive}
            canOpenBatches={canOpenBatches}
            onPrint={(mode) => void handlePrint(mode)}
          />
        ) : null}
        {list}
      </Card>

      {canReceive ? (
        <ReceiveConfirmDialog
          open={isReceiveConfirmOpen}
          marketName={cardTitle}
          count={selectedOrders.length}
          total={selectedTotal}
          unselected={pickUnselectedPreview(orders, selectedIds)}
          branchName={branchName}
          loading={receiveMutation.isPending}
          onCancel={() => setIsReceiveConfirmOpen(false)}
          onConfirm={handleAccepted}
        />
      ) : null}
      {deleteDialog}
    </div>
  );
};

export default memo(NewOrderDetail);
