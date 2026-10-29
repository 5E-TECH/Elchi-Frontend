// dizayn-v2: superadmin-batches-detail, admin-batches-detail, manager-batches-detail-send, manager-batches-detail-readonly, manager-returns-batch-detail
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Inbox, Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useLocation, useParams } from "react-router-dom";
import type { RootState } from "../../../app/config/store";
import {
  BATCH_STATUS_TONE,
  useBatchDetail,
  useBatchHistory,
  useBatchRemainingDetail,
  useSendTransferBatch,
} from "../../../entities/batch";
import type { PostOrder } from "../../../entities/mails";
import {
  printPackageReceipt,
  useReceiptPrint,
  type ReceiptPackageSheet,
} from "../../../features/print-receipts";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { extractScannerToken } from "../../../shared/lib/scanToken";
import { orderByRecent, scanNotify, useRecentScans } from "../../../shared/lib/scanner/scanSession";
import type { ScanTargetListItem } from "../../../shared/lib/scanner/scanTargets";
import { useOrderQrScanner } from "../../../shared/lib/useOrderQrScanner";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  SkeletonLines,
  SkeletonTable,
} from "../../../shared/ui/primitives";
import { useMailDetailState } from "../../mails/detail/model/useMailDetailState";
import OrdersTable, { type OrdersTableColumn } from "../../mails/detail/ui/OrdersTable";
import SendButton from "../../mails/detail/ui/SendButton";
import { playScanFeedback } from "../../../shared/lib/scanner/feedback";
import { formatBatchDisplayId } from "../lib/batchFormat";
import { toBatchReceiptSource } from "../lib/batchReceipt";
import { mapBatchOrdersToPostOrders } from "../lib/batchOrderMailAdapter";
import {
  isPlaceholderBranchName,
  knownText,
  readBatchDetailState,
  readBatchRegion,
  resolveBatchBack,
  summarizeDelivery,
} from "../model/batchView";
import BatchHistoryCard from "./BatchHistoryCard";
import BatchInfoCard from "./BatchInfoCard";
import BatchPrintMenu from "./BatchPrintMenu";
import BatchQrCard from "./BatchQrCard";

/** Jo'natish rejimi (maket `manager-batches-detail-send`, `manager-returns-batch-detail`): market ustuni yo'q. */
const SEND_COLUMNS: readonly OrdersTableColumn[] = ["order", "customer", "address", "delivery", "status", "amount"];
const SEND_TABLET_HIDDEN: readonly OrdersTableColumn[] = ["address"];
/** Faqat o'qish (maket `*-batches-detail`, `manager-batches-detail-readonly`): market — ma'lum bo'lsa (yetishmovchilik 7). */
const READ_COLUMNS: readonly OrdersTableColumn[] = ["order", "customer", "market", "address", "delivery", "status", "amount"];
const READ_COLUMNS_NO_MARKET: readonly OrdersTableColumn[] = ["order", "customer", "address", "delivery", "status", "amount"];
const READ_TABLET_HIDDEN: readonly OrdersTableColumn[] = ["market", "delivery"];

/** Filial nomi: javobda bor bo'lsa, aks holda (`—`, «Filial #12») — `null`. */
const branchName = (name: string | null | undefined) => (isPlaceholderBranchName(name) ? null : knownText(name));

/** `GET transfer-batches/:id/history` ruxsati (backend `@Roles` — logist yo'q). */
const HISTORY_ROLES = new Set(["superadmin", "admin", "manager", "registrator", "branch"]);

/**
 * PAKET TAFSILOTI — `/batches/:id` (superadmin, admin, menejer HQ · PICKUP · HYBRID; registrator ham — jo'natish
 * huquqi bilan), dizayn v2.
 *
 * Sarlavha: «← Paketlar / Qaytarishlar / Eski pochtalar» (kelgan sahifa — `state.from`), «Paket B-172» + holat,
 * «from → to · Yaratilgan: …»; amallar «Chop etish» (paket cheki: termal 100×60 yoki A5, `BatchPrintMenu`) va jo'natish rejimida
 * «HQ'ga yuborish — n ta». Kartalar: «Paket ma'lumotlari» (+ yetkazish turi bo'yicha), «QR kod», «Paketdagi
 * buyurtmalar» (pochta tafsilotining `OrdersTable` kartasi), «Tarix».
 *
 * Jo'natish rejimi: paket holati `new` va rol menejer yoki registrator (`canSendToMainBranch`) — tanlov, USB skaner
 * (buyurtma QR'i → tanlanadi) va `PATCH transfer-batches/:id/send { orderIds }`; yuborilganlar ro'yxatdan
 * yashiriladi, `…/remaining` qayta o'qiladi; xatoda tanlov saqlanadi. Superadmin va admin — doim faqat o'qish.
 *
 * KAMERA (Trello v1eLN2tV 2-bosqich; maket `manager-batches-detail-send-camera`): faqat jo'natish rejimida. Sahifada
 * kamera tugmasi yo'q (ega qarori — maketdagi «Kamera» o'rniga markaziy «Skaner» / «Skanerlash» shu sahifa maqsadini
 * ochadi). Kamera skani USB bilan aynan bir yo'l — buyurtma faqat tanlanadi («HQ'ga yuborish · Paket B-172 · <filial>»,
 * «6 / 9 ta tanlandi», ro'yxatda «Bekor qilish» va «Bu paketda yo'q · tanlanmadi»); yuborish — sahifadagi tugma.
 * Faqat o'qish rejimida maqsad yo'q (markaziy tugma universal `/scan` ni ochadi).
 * Ma'lumot: `GET transfer-batches/:id` va `…/remaining` (buyurtmalar — qolganlari, bo'lmasa hammasi; v1 dagidek).
 * Filial nomlari (3HKvAyhm) — tafsilotdagi `source_branch` / `destination_branch` `{ id, name }` dan, BARCHA rollarda
 * (menejer ham); `GET branches/:id` chaqirilmaydi. «Tarix» — `GET transfer-batches/:id/history` (eng eskisi birinchi
 * keladi, maketdagidek eng yangisi tepada ko'rsatiladi), o'z yuklanish / xato holati bilan — sahifani kutdirmaydi.
 */
const BatchDetailPage = () => {
  const { t, i18n } = useTranslation(["batches", "newOrders", "mails", "common"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { id = "" } = useParams();
  const location = useLocation();
  const role = useSelector((state: RootState) => state.role.role);
  const detailQuery = useBatchDetail(id);
  const remainingQuery = useBatchRemainingDetail(id);
  const sendBatch = useSendTransferBatch();
  const [sentOrderIds, setSentOrderIds] = useState<Set<string>>(new Set());

  const batch = detailQuery.data ?? remainingQuery.data;
  const remainingBatch = remainingQuery.data;
  const isLoading = detailQuery.isLoading || remainingQuery.isLoading;
  const canSendToMainBranch = batch?.status === "new" && (role === "manager" || role === "registrator");
  const isReturn = batch?.direction === "return";

  // Filial nomlari — tafsilot javobidan (`source_branch` / `destination_branch`, 3HKvAyhm; `null` — filial topilmadi
  // → «—»). `GET branches/:id` (faqat SA/admin) endi chaqirilmaydi.
  const fromName = branchName(batch?.from_branch.name);
  const toName = branchName(batch?.to_branch.name);

  // «Tarix» — alohida so'rov (logistga yopiq: unda tafsilot javobidagi `history`, odatda bo'sh).
  const canReadHistory = HISTORY_ROLES.has(String(role ?? ""));
  const historyQuery = useBatchHistory(id, { enabled: canReadHistory });

  const rawOrders = useMemo(
    () => mapBatchOrdersToPostOrders(remainingBatch ?? batch),
    [batch, remainingBatch],
  );
  const orders = useMemo(() => rawOrders.filter((order) => !sentOrderIds.has(order.id)), [rawOrders, sentOrderIds]);
  // «Yetkazish turi bo'yicha» — paketning o'zi (barcha buyurtmalari), qolganlari emas.
  const delivery = useMemo(() => summarizeDelivery(mapBatchOrdersToPostOrders(batch)), [batch]);
  const hasMarket = useMemo(() => orders.some((order) => Boolean(order.market?.name)), [orders]);

  const { selectedIds, allSelected, someSelected, toggleAll, toggleOne, selectOne, deselectOne, clearSelection } =
    useMailDetailState(orders);
  // Kamera ro'yxati: skan tartibi (`order:<id>` / `missing:<kod>`) va paketda yo'q kodlar.
  const { recent: recentScanKeys, touch: touchRecentScan, clear: clearRecentScans } = useRecentScans();
  const [rejectedCodes, setRejectedCodes] = useState<string[]>([]);
  // Boshqa pochta / paketga o'tilsa (sahifa qayta o'rnatilmaydi) — kamera ro'yxati yangidan. Effekt emas, render
  // paytida (React tavsiyasi): oldingisining «… yo'q» qatorlari bir kadr ham yangisida turmaydi.
  const [scanListOwner, setScanListOwner] = useState(id);
  if (scanListOwner !== id) {
    setScanListOwner(id);
    setRejectedCodes([]);
    clearRecentScans();
  }

  // Skaner chaqiruvlari joriy tanlovni o'qiydi: ketma-ket ikki skaner ham takror deb topilsin.
  const selectedRef = useRef(selectedIds);
  useEffect(() => {
    selectedRef.current = selectedIds;
  }, [selectedIds]);

  const handleMissingScannedOrder = useCallback(
    (rawValue: string) => {
      const code = extractScannerToken(rawValue) ?? rawValue.trim();
      if (code) {
        setRejectedCodes((prev) => (prev.includes(code) ? prev : [...prev, code]));
        touchRecentScan(`missing:${code}`);
      }
      scanNotify.warning(t("detail.scanMissingTitle"), { description: t("detail.scanMissing"), duration: 3000 });
      void playScanFeedback("missing", t("detail.cameraNotInBatch", { code }));
    },
    [t, touchRecentScan],
  );

  const selectScannedOrder = useCallback(
    (order: PostOrder) => {
      if (!canSendToMainBranch) return;
      if (selectedRef.current.has(order.id)) {
        void playScanFeedback("duplicate", t("common:scannerFeedbackDuplicate"));
        scanNotify.warning(t("detail.scanDuplicate"), { description: `№${order.id}`, duration: 2000 });
        return;
      }
      selectedRef.current = new Set(selectedRef.current).add(order.id);
      selectOne(order.id);
      touchRecentScan(`order:${order.id}`);
      scanNotify.success(t("detail.scanSelected"), { description: `№${order.id}`, duration: 2000 });
      void playScanFeedback("success", t("detail.cameraSelected", { id: order.id }));
    },
    [canSendToMainBranch, selectOne, t, touchRecentScan],
  );

  const displayId = formatBatchDisplayId(knownText(batch?.id) ?? id);
  const scannerEnabled = canSendToMainBranch && orders.length > 0;
  const cameraList = useMemo<ScanTargetListItem[]>(() => {
    const selectedItems = orders
      .filter((order) => selectedIds.has(order.id))
      .map((order) => ({
        key: `order:${order.id}`,
        title: [`№${order.id}`, order.customer?.name?.trim()].filter(Boolean).join(" · "),
        subtitle: [order.district?.name?.trim(), formatMoneyLocalized(Number(order.total_price) || 0, { language })]
          .filter(Boolean)
          .join(" · "),
        tone: "success" as const,
        // Server amali hali yo'q — «Bekor qilish» faqat tanlovdan chiqaradi.
        onUndo: () => deselectOne(order.id),
      }));
    const rejectedItems = rejectedCodes.map((code) => ({
      key: `missing:${code}`,
      title: t("detail.cameraRejectedTitle", { code }),
      subtitle: t("detail.cameraRejectedText"),
      tone: "danger" as const,
    }));
    return orderByRecent<ScanTargetListItem>([...selectedItems, ...rejectedItems], (item) => item.key, recentScanKeys);
  }, [deselectOne, language, orders, recentScanKeys, rejectedCodes, selectedIds, t]);
  useOrderQrScanner({
    orders,
    // Faqat jo'natish rejimida; yuborish so'rovi ketayotganda skan e'tiborsiz, ochiq kamera yopilmaydi.
    enabled: canSendToMainBranch,
    paused: sendBatch.isPending,
    onMatch: selectScannedOrder,
    onMissing: handleMissingScannedOrder,
    camera: {
      id: `batch-send:${id}`,
      title: t("detail.cameraTitle"),
      context: [t("detail.title", { id: displayId }), fromName].filter(Boolean).join(" · "),
      note: { title: t("detail.cameraNoteTitle"), text: t("detail.cameraNoteText") },
      progress: { done: selectedIds.size, total: orders.length, label: t("detail.cameraMeter") },
      list: cameraList,
      listTitle: t("detail.cameraListTitle"),
      finish: { label: t("ui:camera.action.finish"), onFinish: () => undefined },
    },
  });

  const count = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);

  const handleSend = useCallback(async () => {
    if (!id || selectedIds.size === 0 || sendBatch.isPending) return;
    const sentIds = Array.from(selectedIds);

    try {
      await sendBatch.mutateAsync({ batchId: id, orderIds: sentIds });
    } catch (error) {
      // Tanlov saqlanadi — qayta urinish mumkin; backend xabari ustun (v1 dagidek).
      notify.error(t("detail.sendError"), {
        description: getBackendErrorMessage(error) ?? t("detail.sendErrorDescription"),
      });
      return;
    }

    const value = count(sentIds.length);
    notify.success(t("detail.sendSuccess"), {
      description: toName
        ? t("detail.sendSuccessDescription", { value, count: sentIds.length, to: toName })
        : t("detail.sendSuccessDescriptionNoTarget", { value, count: sentIds.length }),
    });
    setSentOrderIds((prev) => {
      const next = new Set(prev);
      sentIds.forEach((orderId) => next.add(orderId));
      return next;
    });
    clearSelection();
    await remainingQuery.refetch();
  }, [clearSelection, count, id, remainingQuery, selectedIds, sendBatch, t, toName]);

  const refetchAll = useCallback(() => {
    void detailQuery.refetch();
    void remainingQuery.refetch();
  }, [detailQuery, remainingQuery]);

  const back = resolveBatchBack(readBatchDetailState(location.state), batch);
  const backLabel = t(`detail.back.${back.label}`);
  // Paket cheki (HJ5sLHiz, TZ F8/F10): termal 100×60 yoki A5 — `features/print-receipts` (lokal QR, bitta joylash).
  const receiptPrint = useReceiptPrint();
  const print = (sheet: ReceiptPackageSheet) => {
    if (!batch) return;
    const source = toBatchReceiptSource(batch, { from: fromName, to: toName });
    void receiptPrint.run({ print: () => printPackageReceipt(source, { sheet, output: "browser" }) });
  };

  // ─── Yuklanish ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-w-0 flex-col gap-6 max-md:gap-4" aria-busy="true">
        <span role="status" className="sr-only">
          {t("detail.loading")}
        </span>
        <PageHeader
          back={back.to}
          backLabel={backLabel}
          title={<Skeleton width={200} height={32} />}
          description={<Skeleton width={320} height={14} />}
        />
        <div className="flex flex-wrap items-stretch gap-6 max-md:gap-4">
          <Card title={t("detail.infoTitle")} className="min-w-0 flex-[2_1_440px]">
            <SkeletonLines lines={4} />
          </Card>
          <Card title={t("detail.qrCode")} className="min-w-0 flex-[1_1_240px]">
            <Skeleton width={160} height={160} className="mx-auto" />
          </Card>
        </div>
        <Card title={t("detail.ordersTitle")} padding="none">
          <SkeletonTable framed={false} rows={5} columns={[t("detail.orders"), t("detail.amount")]} />
        </Card>
      </div>
    );
  }

  // ─── Topilmadi / xato ────────────────────────────────────────────────────────
  if (!batch) {
    const error = detailQuery.error ?? remainingQuery.error;
    const notFound = !error || getErrorStatus(error) === 404;
    return (
      <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
        <PageHeader back={back.to} backLabel={backLabel} title={t("detail.title", { id: displayId })} />
        <Card padding="none">
          {notFound ? (
            <EmptyState icon={Package} title={t("detail.notFound")} description={t("detail.notFoundHint")} />
          ) : (
            <ErrorState error={error} onRetry={refetchAll} />
          )}
        </Card>
      </div>
    );
  }

  // ─── Ko'rinish ───────────────────────────────────────────────────────────────
  const region = readBatchRegion(batch) ?? toName;
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const selectedCount = selectedIds.size;
  const sendLabel = t("detail.send", { value: count(selectedCount) });
  const sendButton = (block: boolean) => (
    <SendButton
      selectedCount={selectedCount}
      isCourier={false}
      mode="send"
      onSend={() => void handleSend()}
      onReceive={() => void handleSend()}
      isBusy={sendBatch.isPending}
      sendLabel={sendLabel}
      busyLabel={t("detail.sending")}
      block={block}
      // Qaytarish paketi (maket `manager-returns-batch-detail`): tugma telefonda ham sarlavhada, karta ostida yo'q.
      className={block || isReturn ? undefined : "max-md:hidden"}
    />
  );

  const qrHint = canSendToMainBranch
    ? isReturn
      ? t("detail.qrHintReturn")
      : toName
        ? t("detail.qrHint", { to: toName })
        : t("detail.qrHintNoTarget")
    : null;

  const description = (
    <>
      {fromName || toName ? (
        <>
          <span className="inline-flex flex-wrap items-center gap-x-1.5">
            {fromName}
            {fromName && toName ? (
              <ArrowRight aria-hidden="true" size={14} strokeWidth={2} className="shrink-0 text-text-subtle" />
            ) : null}
            {toName}
          </span>
          {" · "}
        </>
      ) : null}
      <span className="whitespace-nowrap">
        {t("detail.createdAt", { date: formatDateTimeLocalized(batch.created_at, { language }) })}
      </span>
    </>
  );

  // Backend — xronologik (eng eskisi birinchi); maket — eng yangisi tepada.
  const historyItems = canReadHistory ? [...(historyQuery.data ?? [])].reverse() : batch.history;

  const infoItems = [
    {
      label: t("detail.branch"),
      value: fromName ?? "—",
      sub: knownText(batch.from_branch.code),
    },
    { label: t("detail.destination"), value: toName ?? "—" },
    { label: t("detail.region"), value: region ?? "—" },
    { label: t("detail.direction"), value: t(`direction.${batch.direction}`) },
    { label: t("detail.orders"), value: t("qty", { value: count(batch.orders_count) }) },
    { label: t("detail.amount"), value: money(batch.total_price) },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        back={back.to}
        backLabel={backLabel}
        title={t("detail.title", { id: displayId })}
        meta={
          <Badge tone={BATCH_STATUS_TONE[batch.status]} dot>
            {t(`batchStatus.${batch.status}`, { ns: "newOrders" })}
          </Badge>
        }
        description={description}
        // Faqat o'qish maketlarida (`*-batches-detail`, `manager-batches-detail-readonly`) sarlavhada amal yo'q —
        // «Chop etish» QR kartasida. Jo'natish rejimida: «Chop etish» + asosiy tugma.
        actions={
          canSendToMainBranch ? (
            <>
              <BatchPrintMenu onSelect={print} loading={receiptPrint.printing} />
              {sendButton(false)}
            </>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-stretch gap-6 max-md:gap-4">
        <BatchInfoCard
          items={infoItems}
          delivery={delivery}
          className={canSendToMainBranch ? "flex-[2_1_520px]" : "flex-[2_1_440px]"}
        />
        <BatchQrCard
          displayId={displayId}
          token={batch.token}
          hint={qrHint}
          // Maket: oddiy paketda izoh faqat planshetda, qaytarish paketida planshet va telefonda.
          hintClassName={isReturn ? "hidden max-lg:block" : "hidden max-lg:block max-md:hidden"}
          onPrint={print}
          printing={receiptPrint.printing}
          className={canSendToMainBranch ? "flex-[1_1_280px]" : "flex-[1_1_240px]"}
        />
      </div>

      <OrdersTable
        orders={orders}
        selectedIds={selectedIds}
        allSelected={allSelected}
        someSelected={someSelected}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
        readOnly={!canSendToMainBranch}
        title={t("detail.ordersTitle")}
        ariaLabel={t("detail.ordersLabel")}
        scanHint={canSendToMainBranch ? t("detail.scanHint") : undefined}
        scannerReady={scannerEnabled}
        scannerReadyLabel={isReturn ? t("mails:detailPage.scannerReadyShort") : undefined}
        scannerReadyOnPhone={isReturn}
        appearance="batch"
        selectionHint={isReturn ? t("detail.selectionHintReturn") : t("detail.selectionHint")}
        onClearSelection={clearSelection}
        columns={canSendToMainBranch ? SEND_COLUMNS : hasMarket ? READ_COLUMNS : READ_COLUMNS_NO_MARKET}
        tabletHidden={canSendToMainBranch ? SEND_TABLET_HIDDEN : READ_TABLET_HIDDEN}
        empty={<EmptyState icon={Inbox} title={t("detail.emptyOrders")} description={t("detail.emptyOrdersHint")} />}
        footerAction={canSendToMainBranch && !isReturn && orders.length > 0 ? sendButton(true) : undefined}
      />

      <BatchHistoryCard
        items={historyItems}
        direction={batch.direction}
        targetName={toName}
        loading={canReadHistory && historyQuery.isPending && historyQuery.fetchStatus !== "idle"}
        error={canReadHistory && !historyQuery.data ? historyQuery.error : null}
        onRetry={() => void historyQuery.refetch()}
        retrying={historyQuery.isFetching}
      />
    </div>
  );
};

export default memo(BatchDetailPage);
