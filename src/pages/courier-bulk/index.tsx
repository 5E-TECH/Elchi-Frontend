// dizayn-v2: courier-courier-bulk-main, manager-courier-bulk-main, courier-courier-bulk-confirm-dialog
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Check, CircleX, PackageCheck, RotateCcw, ScanLine, Zap } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useOrders } from "../../entities/orders";
import type { OrderListItem } from "../../entities/order/types/order";
import type { RootState } from "../../app/config/store";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import ScannerCameraModal from "../../shared/components/ScannerCameraModal";
import { useOrderQrScanner } from "../../shared/lib/useOrderQrScanner";
import { normalizeScannerCandidates } from "../../shared/lib/scanToken";
import { formatNumberLocalized } from "../../shared/lib/formatMoney";
import { notify } from "../../shared/lib/notify";
import { useIsPhone } from "../../shared/ui/primitives/date/useIsPhone";
import { Button, PageHeader, useConfirm, type ConfirmConsequence } from "../../shared/ui/primitives";
import { playScanFeedback } from "../../shared/lib/scanner/feedback";
import {
  COURIER_BULK_CONCURRENCY,
  COURIER_BULK_PROOF_CONCURRENCY,
  COURIER_BULK_REQUEST_HEADERS,
  extractCourierBulkOrders,
  extractCourierBulkTotal,
  findCourierBulkOrderByScanCandidates,
  getCourierBulkActionsAfterFinalize,
  getCourierBulkCounts,
  getCourierBulkFinalizeTasks,
  getCourierBulkProofKey,
  getCourierBulkUnmarkedCount,
  hasAllCourierBulkProofs,
  isCourierBulkOrderMarked,
  mergeCourierBulkOrders,
  runLimited,
  splitCourierBulkTasksByProof,
  summarizeCourierBulkResults,
  type CourierBulkAction,
  type CourierBulkFinalizeTask,
  type CourierBulkOrder,
  type CourierBulkScanMode,
} from "./model/courierBulk";
import { useIsBelowLg } from "./model/useIsBelowLg";
import { BulkAlert } from "./ui/BulkAlert";
import { CourierBulkOrders } from "./ui/CourierBulkOrders";
import { CourierBulkProofDialog } from "./ui/CourierBulkProofDialog";
import { CourierBulkResultDialog, type CourierBulkResult } from "./ui/CourierBulkResultDialog";
import { CourierBulkSummary } from "./ui/CourierBulkSummary";

type FinalizeTask = CourierBulkFinalizeTask<CourierBulkOrder>;

/** Isbot qadami: tasdiqdan keyin isbot talab qilinadigan buyurtmalar bo'lsa ochiladi (j9KFyqlS). */
type ProofStep = {
  open: boolean;
  tasks: FinalizeTask[];
  proofTasks: FinalizeTask[];
  plainCount: number;
  tomorrowCount: number;
};

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

/**
 * «TEZKOR AMAL» — `/courier-bulk` (kuryer; REGIONAL/HYBRID menejer — filial kuryerlarining kutilayotganlari, backend
 * filialga cheklaydi). Kun yakunida har buyurtma natijasi belgilanadi: belgilanmagani sotiladi, «Bekor» — bekor
 * qilinadi, «Ertaga» — so'rovsiz kutilmoqda holatida qoladi (FE-CB-09). Belgilash: qatordagi «Sotildi | Bekor |
 * Ertaga», USB skaner yoki kamera (skanerlash rejimi bo'yicha).
 *
 * Maketlar: `courier-courier-bulk-main` (ikkala rol uchun bitta tartib; menejerda faqat «Kutilayotgan» izohi
 * boshqa — Q8), tasdiq oynasi `courier-courier-bulk-confirm-dialog` (`useConfirm`). Kamera oynasi
 * (`ScannerCameraModal`) — kamera ishi, o'zgarmagan.
 *
 * Saqlangan: barcha sahifalarni yig'ish (100 tadan, 50 sahifagacha), skan takrori / topilmadi, yakunlash
 * `runLimited` + so'rov tanalari, xato bergan va «ertaga» belgilari qoladi. «Faqat bekorlarni qo'llash»
 * olib tashlandi (maketlarda yo'q — Q9).
 *
 * Isbot (j9KFyqlS, dev cf13e85): tasdiqdan keyin market isbot talab qiladigan buyurtmalar bo'lsa — isbot qadami
 * (`CourierBulkProofDialog`, har buyurtmaga `ProofField`; hammasiga fayl tanlanmaguncha «Yakunlash» o'chiq).
 * Isbotlilar ko'pi bilan 2 tadan, qolganlari 6 tadan parallel; har so'rovda `X-Request-Source: courier-bulk`.
 * Xato berganlar — `CourierBulkResultDialog` (har biri backend sababi bilan, sahifa tartibida). Tanlangan isbot
 * shu buyurtma + amal uchun muvaffaqiyatgacha saqlanadi. Ikkala oynaga maket yo'q — eng yaqini:
 * `tizim-states-forms` + `courier-courier-bulk-confirm-dialog`.
 */
const CourierBulkPage = () => {
  const { t, i18n } = useTranslation("courierBulk");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const role = useSelector((state: RootState) => state.role.role);
  const isPhone = useIsPhone();
  const isBelowLg = useIsBelowLg();
  const { SellOrder, CancelOrder } = useOrders();
  const confirm = useConfirm();
  const ordersQuery = useQuery({
    queryKey: ["orders", "courier", "bulk", "waiting"],
    queryFn: fetchAllCourierWaitingOrders,
    staleTime: 15_000,
  });
  const { data: orders = [], isLoading, isFetching, refetch } = ordersQuery;

  const [scanMode, setScanMode] = useState<CourierBulkScanMode>("cancel");
  const [actions, setActions] = useState<Record<string, CourierBulkAction>>({});
  const [scanError, setScanError] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [proofStep, setProofStep] = useState<ProofStep | null>(null);
  // Tanlangan isbotlar (kalit — buyurtma + amal): oyna yopilsa yoki amal xato bersa ham saqlanadi
  // (qayta urinishda qayta tanlash shart emas); bajarilganlarniki tozalanadi.
  const [proofs, setProofs] = useState<Record<string, File | undefined>>({});
  const [result, setResult] = useState<CourierBulkResult | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const scannedTokenRef = useRef<Set<string>>(new Set());

  const counts = useMemo(() => getCourierBulkCounts(orders, actions), [actions, orders]);
  const unmarkedCount = useMemo(() => getCourierBulkUnmarkedCount(orders, actions), [actions, orders]);
  const hasMarks = useMemo(() => orders.some((order) => isCourierBulkOrderMarked(order.id, actions)), [actions, orders]);
  const isInitialLoading = isLoading && orders.length === 0;
  const isBusy = isFinalizing || SellOrder.isPending || CancelOrder.isPending;

  /** Skan: tanlangan rejim belgisi; xuddi shu belgi qayta skanerlansa — aniq «sotildi». */
  const toggleScanAction = useCallback((order: OrderListItem, action: CourierBulkScanMode) => {
    setActions((prev) => ({
      ...prev,
      [order.id]: prev[order.id] === action ? "sold" : action,
    }));
  }, []);

  /** Qatordagi natija tanlovi — aniq belgi (`sold` ham). */
  const setOrderAction = useCallback((order: CourierBulkOrder, action: CourierBulkAction) => {
    setActions((prev) => ({ ...prev, [order.id]: action }));
  }, []);

  const handleScanMatch = useCallback(
    (order: OrderListItem, rawValue: string) => {
      const tokenKey = rawValue.trim().toLowerCase() || order.id.toLowerCase();

      if (scannedTokenRef.current.has(tokenKey)) {
        notify.warning(t("duplicateTitle"), { description: t("duplicateDescription") });
        void playScanFeedback("duplicate");
        return;
      }

      scannedTokenRef.current.add(tokenKey);
      toggleScanAction(order, scanMode);
      setScanError("");
      notify.success(t("scanSuccessTitle"), {
        description: t(scanMode === "cancel" ? "markedCancel" : "markedTomorrow", {
          name: order.customer?.name ?? `#${order.id}`,
        }),
        duration: 2000,
      });
      void playScanFeedback("success");
    },
    [scanMode, t, toggleScanAction],
  );

  const handleScanMissing = useCallback(() => {
    setScanError(t("scanMissing"));
    notify.error(t("scanMissingTitle"), { description: t("scanMissing") });
    void playScanFeedback("missing");
  }, [t]);

  useOrderQrScanner({
    orders,
    // Isbot / natija oynasi ochiq bo'lsa USB skan belgilarni o'zgartirmaydi.
    enabled: !isBusy && !proofStep?.open && !isResultOpen && orders.length > 0,
    onMatch: handleScanMatch,
    onMissing: handleScanMissing,
  });

  const clearActions = () => {
    setActions({});
    scannedTokenRef.current.clear();
    setScanError("");
  };

  const handleProofChange = useCallback((proofKey: string, file: File | undefined) => {
    setProofs((previous) => ({ ...previous, [proofKey]: file }));
  }, []);

  /**
   * So'rovlarni yuborish. Isbotsiz buyurtmalar 6 tadan, isbotlilar (fayl yuklash + amal) ko'pi bilan 2 tadan
   * parallel; har so'rov `X-Request-Source: courier-bulk` bilan (audit).
   */
  const runFinalize = async (tasks: FinalizeTask[], tomorrowCount: number) => {
    setIsFinalizing(true);
    const { proofTasks, plainTasks } = splitCourierBulkTasksByProof(tasks);

    // Isbot faqat isbot talab qilinadigan buyurtmaga yuboriladi (keraksiz fayl yuklanmaydi).
    const runTask =
      (withProof: boolean) =>
      async ({ order, action }: FinalizeTask) => {
        const proof = withProof ? proofs[getCourierBulkProofKey({ order, action })] : undefined;
        const proofData = proof instanceof File ? { proof } : {};
        if (action === "cancel") {
          await CancelOrder.mutateAsync({
            orderId: order.id,
            data: { comment: t("bulkCancelComment"), extraCost: 0, ...proofData },
            headers: COURIER_BULK_REQUEST_HEADERS,
          });
        } else {
          await SellOrder.mutateAsync({
            orderId: order.id,
            data: { comment: t("bulkSoldComment"), extraCost: 0, ...proofData },
            headers: COURIER_BULK_REQUEST_HEADERS,
          });
        }
      };

    const [plainResults, proofResults] = await Promise.all([
      runLimited(plainTasks, COURIER_BULK_CONCURRENCY, runTask(false)),
      runLimited(proofTasks, COURIER_BULK_PROOF_CONCURRENCY, runTask(true)),
    ]);
    // Natija har vazifaga o'zi bilan bog'lanadi (`runLimited` — kirish tartibida); xatolar ro'yxati sahifa tartibida.
    const settled = new Map<FinalizeTask, PromiseSettledResult<unknown>>();
    plainTasks.forEach((task, index) => settled.set(task, plainResults[index]));
    proofTasks.forEach((task, index) => settled.set(task, proofResults[index]));
    const { succeededOrderIds, failures } = summarizeCourierBulkResults(
      tasks,
      tasks.map((task) => settled.get(task) ?? { status: "rejected", reason: undefined }),
    );

    setIsFinalizing(false);
    setProofStep((previous) => (previous ? { ...previous, open: false } : previous));
    // Bajarilganlarning belgisi xato bo'lsa ham tozalanadi; xato bergan va
    // "ertaga" belgilari qoladi. Ro'yxat har holda yangilanadi.
    setActions((previous) => getCourierBulkActionsAfterFinalize(previous, succeededOrderIds));
    const succeededProofKeys = new Set(
      proofTasks.filter(({ order }) => succeededOrderIds.has(String(order.id))).map(getCourierBulkProofKey),
    );
    setProofs((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([proofKey]) => !succeededProofKeys.has(proofKey))),
    );
    setScanError("");
    void refetch();

    if (failures.length > 0) {
      // Har xato bergan buyurtma — backend sababi bilan (faqat son emas).
      setResult({ failures, succeededCount: succeededOrderIds.size, tomorrowCount });
      setIsResultOpen(true);
      return;
    }

    notify.success(t("finalizeSuccessTitle"), {
      description: [
        t("finalizeSuccessDescription", { count: succeededOrderIds.size }),
        tomorrowCount > 0 ? t("finalizeTomorrowKept", { count: tomorrowCount }) : "",
      ]
        .filter(Boolean)
        .join(" "),
      duration: 3000,
    });
  };

  const handleFinalize = async () => {
    if (orders.length === 0 || isBusy) return;

    // "Ertaga" — so'rovsiz, buyurtma kutilmoqda holatida qoladi (FE-CB-09).
    const tasks = getCourierBulkFinalizeTasks(orders, actions);
    const tomorrowCount = orders.length - tasks.length;

    if (tasks.length === 0) {
      notify.info(t("finalizeSuccessTitle"), { description: t("finalizeNothing") });
      return;
    }

    // «Kunni yakunlash» — tasdiqlash oynasi orqali (maket `courier-courier-bulk-confirm-dialog`).
    const cancelTasks = tasks.filter((task) => task.action === "cancel");
    const soldCount = tasks.length - cancelTasks.length;
    const unmarked = getCourierBulkUnmarkedCount(orders, actions);
    const consequences: ConfirmConsequence[] = [];
    if (soldCount > 0) {
      consequences.push({
        text: t("confirmSold", { count: soldCount }),
        hint:
          unmarked > 0 ? (
            <Trans
              t={t}
              ns="courierBulk"
              i18nKey="confirm.soldUnmarked"
              count={unmarked}
              components={{ strong: <strong className="font-semibold text-text" /> }}
            />
          ) : (
            t("confirm.soldMarked")
          ),
        tone: "success",
        icon: PackageCheck,
      });
    }
    if (cancelTasks.length > 0) {
      const single = cancelTasks.length === 1 ? cancelTasks[0].order : null;
      consequences.push({
        text: t("confirmCancel", { count: cancelTasks.length }),
        hint: single
          ? t("confirmCancelOneHint", { id: single.id, name: single.customer?.name ?? `#${single.id}` })
          : t("confirmCancelHint"),
        tone: "danger",
        icon: CircleX,
      });
    }
    if (tomorrowCount > 0) {
      consequences.push({
        text: t("confirmTomorrow", { count: tomorrowCount }),
        hint: t("confirmTomorrowHint"),
        tone: "warning",
        icon: CalendarClock,
      });
    }
    const confirmed = await confirm({
      title: t("confirmTitle"),
      description: t("confirmDescription", { count: orders.length }),
      icon: Zap,
      size: "md",
      closable: true,
      consequences,
      children: (
        <BulkAlert tone="warning" role="note" title={t("confirm.irreversibleTitle")}>
          {t("confirm.irreversibleText", { count: tasks.length })}
        </BulkAlert>
      ),
      confirmLabel: t("confirmAction"),
      confirmIcon: Check,
      cancelLabel: t("confirmBack"),
    });
    if (!confirmed) return;

    // Market isbot talab qiladigan buyurtmalar (j9KFyqlS): isbotsiz backend 400 qaytaradi — avval isbot
    // qadami. Isbot kerak bo'lmasa — qo'shimcha qadamsiz darhol yakunlanadi.
    const { proofTasks, plainTasks } = splitCourierBulkTasksByProof(tasks);
    if (proofTasks.length > 0) {
      setProofStep({ open: true, tasks, proofTasks, plainCount: plainTasks.length, tomorrowCount });
      return;
    }

    await runFinalize(tasks, tomorrowCount);
  };

  const handleProofSubmit = () => {
    if (!proofStep || isFinalizing || !hasAllCourierBulkProofs(proofStep.proofTasks, proofs)) return;
    void runFinalize(proofStep.tasks, proofStep.tomorrowCount);
  };

  const handleCameraDecode = (value: string) => {
    const matched = findCourierBulkOrderByScanCandidates(orders, normalizeScannerCandidates(value, window.location.origin));
    if (matched) {
      handleScanMatch(matched, value);
      setIsCameraOpen(false);
      return;
    }
    handleScanMissing();
  };

  // «Kunni yakunlash» — DOM'da BITTA tugma: ≥ 768 sarlavhada, telefonda pastki menyu ustidagi panelda.
  const finalizeButton = (
    <Button
      size={isPhone ? "lg" : "md"}
      fullWidth={isPhone}
      leftIcon={Zap}
      aria-haspopup="dialog"
      disabled={orders.length === 0}
      loading={isBusy}
      onClick={() => void handleFinalize()}
    >
      {t("page.finalize")}
    </Button>
  );

  const markedCount = counts.total - unmarkedCount;
  const isManager = role === "manager";

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          isPhone ? undefined : (
            <>
              <Button variant="ghost" leftIcon={RotateCcw} disabled={!hasMarks || isBusy} onClick={clearActions}>
                {t("page.clearMarks")}
              </Button>
              {finalizeButton}
            </>
          )
        }
      />

      <CourierBulkSummary
        counts={counts}
        unmarked={unmarkedCount}
        viewer={isManager ? "manager" : "courier"}
        scanMode={scanMode}
        onScanModeChange={setScanMode}
        onOpenCamera={() => setIsCameraOpen(true)}
        busy={isBusy}
        isPhone={isPhone}
        isBelowLg={isBelowLg}
      />

      {/* Skan topilmadi — keyingi muvaffaqiyatli skangacha turadi (+ xabar, maket «Buyurtma topilmadi»). */}
      {scanError ? (
        <BulkAlert tone="danger" data-testid="courier-bulk-scan-error">
          {scanError}
        </BulkAlert>
      ) : null}

      {isPhone ? (
        <Button
          size="lg"
          fullWidth
          leftIcon={ScanLine}
          aria-haspopup="dialog"
          aria-label={
            isManager
              ? t("scanMode.cameraPhoneMarked", { marked: markedCount, total: counts.total })
              : undefined
          }
          disabled={isBusy}
          onClick={() => setIsCameraOpen(true)}
        >
          {t("scanMode.cameraPhone")}
          {isManager ? (
            // Maket `manager-courier-bulk-main`: asosiy tugma ichidagi belgi (`on-solid` fon, `action-fg` matn).
            <span className="ml-1 inline-flex h-5 items-center rounded-md bg-on-solid px-1.5 text-xs font-semibold text-action-fg">
              {t("scanMode.markedOfTotal", {
                marked: formatNumberLocalized(markedCount, { language }),
                total: formatNumberLocalized(counts.total, { language }),
              })}
            </span>
          ) : null}
        </Button>
      ) : null}

      <CourierBulkOrders
        query={ordersQuery}
        orders={orders}
        actions={actions}
        onSetAction={setOrderAction}
        busy={isBusy}
        refreshing={isFetching && !isInitialLoading}
        isPhone={isPhone}
        isBelowLg={isBelowLg}
        onClearMarks={clearActions}
        clearDisabled={!hasMarks || isBusy}
      />

      {isPhone ? (
        <>
          <div aria-hidden="true" className="h-[72px] shrink-0" />
          <div className="fixed inset-x-0 bottom-[var(--shell-bottomnav-h)] z-30 border-t border-border bg-surface px-4 py-3">
            {finalizeButton}
          </div>
        </>
      ) : null}

      <ScannerCameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onDecode={handleCameraDecode}
        title={t("scannerTitle")}
        subtitle={t("scannerSubtitle")}
        waitingText={t("scannerWaiting")}
        closeLabel={t("scannerClose")}
        torchOnLabel={t("torchOn")}
        torchOffLabel={t("torchOff")}
        invalidQrMessage={t("invalidQr")}
        error={scanError}
      />

      <CourierBulkProofDialog
        open={Boolean(proofStep?.open)}
        tasks={proofStep?.proofTasks ?? []}
        plainCount={proofStep?.plainCount ?? 0}
        proofs={proofs}
        onProofChange={handleProofChange}
        busy={isFinalizing}
        onClose={() => setProofStep((previous) => (previous ? { ...previous, open: false } : previous))}
        onSubmit={handleProofSubmit}
        onExited={() => setProofStep((previous) => (previous?.open ? previous : null))}
      />

      <CourierBulkResultDialog
        open={isResultOpen}
        result={result}
        onClose={() => setIsResultOpen(false)}
        onExited={() => setResult(null)}
      />
    </div>
  );
};

export default memo(CourierBulkPage);
