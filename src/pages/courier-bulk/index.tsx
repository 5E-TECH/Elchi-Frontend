// dizayn-v2: courier-courier-bulk-main, manager-courier-bulk-main, courier-courier-bulk-confirm-dialog
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useSelector } from "react-redux";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, CircleX, PackageCheck, Repeat, RotateCcw, Truck, UserRound, Zap } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useOrders } from "../../entities/orders";
import type { OrderListItem } from "../../entities/order/types/order";
import { createIdempotencyKey } from "../../entities/warehouse/lib/idempotency";
import type { RootState } from "../../app/config/store";
import { getUserCanSellCancel } from "../new_orders/components/detail/orderDetailAccess";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { useOrderQrScanner } from "../../shared/lib/useOrderQrScanner";
import { formatMoneyLocalized, formatNumberLocalized } from "../../shared/lib/formatMoney";
import { notify } from "../../shared/lib/notify";
import { useIsPhone } from "../../shared/ui/primitives/date/useIsPhone";
import { Button, PageHeader, useConfirm, type ConfirmConsequence } from "../../shared/ui/primitives";
import { playScanFeedback } from "../../shared/lib/scanner/feedback";
import { orderByRecent, scanNotify, useRecentScans } from "../../shared/lib/scanner/scanSession";
import type { ScanTargetListItem } from "../../shared/lib/scanner/scanTargets";
import {
  COURIER_BULK_CONCURRENCY,
  COURIER_BULK_PROOF_CONCURRENCY,
  COURIER_BULK_REQUEST_HEADERS,
  extractCourierBulkOrders,
  extractCourierBulkTotal,
  getCourierBulkActionsAfterFinalize,
  getCourierBulkCounts,
  getCourierBulkFinalizeTasks,
  getCourierBulkKept,
  getCourierBulkProofKey,
  getCourierBulkUnmarkedCount,
  hasAllCourierBulkProofs,
  isCourierBulkAwaitingPost,
  isCourierBulkOrderMarked,
  isCourierBulkSellBlocked,
  mergeCourierBulkOrders,
  runLimited,
  splitCourierBulkTasksByProof,
  getCourierBulkIdempotencyKey,
  withCourierBulkRetry,
  summarizeCourierBulkResults,
  type CourierBulkAction,
  type CourierBulkFinalizeTask,
  type CourierBulkOrder,
  type CourierBulkScanMode,
  type CourierBulkViewer,
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
  kept: KeptCounts;
};

/** Yakunlashda so'rov ketmaydigan buyurtmalar soni, sababi bo'yicha (`getCourierBulkKept`). */
type KeptCounts = { tomorrow: number; replacement: number; courierHeld: number; awaitingPost: number };

const COURIER_BULK_QUERY_KEY = ["orders", "courier", "bulk", "waiting"] as const;

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
 * boshqa — Q8), tasdiq oynasi `courier-courier-bulk-confirm-dialog` (`useConfirm`).
 *
 * KAMERA (Trello v1eLN2tV 2-bosqich; maketlar `courier-courier-bulk-scanner-camera`, `…-camera-list`,
 * `manager-courier-bulk-camera-dialog`): sahifada kamera tugmasi yo'q (ega qarori — maketdagi «Kamera» /
 * «Kamera bilan skanerlash» o'rniga markaziy «Skaner» / «Skanerlash» shu sahifa maqsadini ochadi). Kamera ichida
 * «Bekor / Ertaga» rejimi (sahifadagi rejim bilan bitta holat), har skandan keyin YOPILMAYDI; kamera skani USB bilan
 * aynan bitta handler (`handleScanMatch`). «Ro'yxat» — «Skanerlanganlar · 4 / 7 · 2 ta bekor, 2 ta ertaga»,
 * «Bekor qilish» belgini olib tashlaydi (server amali hali yo'q). «Tugatish» kamerani yopadi — yakunlash sahifadagi
 * «Kunni yakunlash» (tasdiq oynasi) bilan.
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
  const currentUser = useSelector((state: RootState) => state.user.user);
  const isManager = role === "manager";
  const viewer: CourierBulkViewer = isManager ? "manager" : "courier";
  // Menejer `can_sell_cancel` siz hech narsani sota ham, bekor qila ham olmaydi (backend 403) — yakunlash o'chiq.
  const managerCannotFinalize = isManager && !getUserCanSellCancel(currentUser);
  const isPhone = useIsPhone();
  const isBelowLg = useIsBelowLg();
  const { SellOrder, CancelOrder } = useOrders();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [isFinalizing, setIsFinalizing] = useState(false);
  const ordersQuery = useQuery({
    queryKey: COURIER_BULK_QUERY_KEY,
    queryFn: fetchAllCourierWaitingOrders,
    staleTime: 15_000,
    // Yakunlash paytida har muvaffaqiyatli sotish/bekor ["orders"] ni yangilaydi — ro'yxat har safar barcha
    // sahifalari bilan qayta so'ralardi (gateway IP chegarasini ham yerdi). Oxirida bir marta yangilanadi.
    enabled: !isFinalizing,
  });
  const { data: orders = [], isLoading, isFetching, refetch } = ordersQuery;

  const [scanMode, setScanMode] = useState<CourierBulkScanMode>("cancel");
  const [actions, setActions] = useState<Record<string, CourierBulkAction>>({});
  const [scanError, setScanError] = useState("");
  // Tasdiq oynasi ochiq: yuboriladiganlar ro'yxati oyna ochilishida olingan — skan belgilarni o'zgartirmasin.
  const [isConfirming, setIsConfirming] = useState(false);
  const [proofStep, setProofStep] = useState<ProofStep | null>(null);
  // Tanlangan isbotlar (kalit — buyurtma + amal): oyna yopilsa yoki amal xato bersa ham saqlanadi
  // (qayta urinishda qayta tanlash shart emas); bajarilganlarniki tozalanadi.
  const [proofs, setProofs] = useState<Record<string, File | undefined>>({});
  const [result, setResult] = useState<CourierBulkResult | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  // Oxirgi yakunlashda xato bergan buyurtmalar (id → backend xatosi): qatorda sababi turadi — oyna yopilgach ham
  // buyurtma «o'zgarmay qolgan»dek ko'rinmasin. Belgi o'zgartirilsa yoki keyingi yakunlashda yangilanadi.
  const [rowErrors, setRowErrors] = useState<Record<string, unknown>>({});
  // Skanerlangan token → buyurtma (takror skan rad etiladi; kamera «Bekor qilish» shu buyurtma tokenlarini bo'shatadi).
  const scannedTokenRef = useRef<Map<string, string>>(new Map());
  const { recent: recentScanIds, touch: touchRecentScan, forget: forgetRecentScan, clear: clearRecentScans } =
    useRecentScans();

  const counts = useMemo(() => getCourierBulkCounts(orders, actions, viewer), [actions, orders, viewer]);
  const unmarkedCount = useMemo(() => getCourierBulkUnmarkedCount(orders, actions, viewer), [actions, orders, viewer]);
  const hasMarks = useMemo(() => orders.some((order) => isCourierBulkOrderMarked(order.id, actions)), [actions, orders]);
  const isInitialLoading = isLoading && orders.length === 0;
  const isBusy = isFinalizing || SellOrder.isPending || CancelOrder.isPending;


  const forgetRowError = useCallback((orderId: string) => {
    setRowErrors((prev) => {
      if (!(orderId in prev)) return prev;
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  }, []);

  /** Qatordagi natija tanlovi — aniq belgi (`sold` ham). */
  const setOrderAction = useCallback(
    (order: CourierBulkOrder, action: CourierBulkAction) => {
      setActions((prev) => ({ ...prev, [order.id]: action }));
      forgetRowError(order.id);
    },
    [forgetRowError],
  );

  /** Skan: tanlangan rejim belgisi; xuddi shu belgi qayta skanerlansa — aniq «sotildi». */
  const handleScanMatch = useCallback(
    (order: OrderListItem, rawValue: string) => {
      const tokenKey = rawValue.trim().toLowerCase() || order.id.toLowerCase();
      const name = order.customer?.name ?? `#${order.id}`;

      if (scannedTokenRef.current.has(tokenKey)) {
        scanNotify.warning(t("duplicateTitle"), { description: t("duplicateDescription") });
        void playScanFeedback("duplicate", t("duplicateDescription"));
        return;
      }

      // Pochtasi qabul qilinmagan posilka belgilanmaydi (so'rov baribir 400) — token band qilinmaydi.
      if (isCourierBulkAwaitingPost(order)) {
        scanNotify.warning(t("awaitingPostTitle"), { description: t("list.awaitingPostHint") });
        void playScanFeedback("error", t("list.awaitingPostHint"));
        return;
      }

      scannedTokenRef.current.set(tokenKey, order.id);
      const next: CourierBulkAction = actions[order.id] === scanMode ? "sold" : scanMode;
      setActions((prev) => ({ ...prev, [order.id]: prev[order.id] === scanMode ? "sold" : scanMode }));
      forgetRowError(order.id);
      touchRecentScan(order.id);
      setScanError("");
      scanNotify.success(t("scanSuccessTitle"), {
        description: t(next === "cancel" ? "markedCancel" : next === "tomorrow" ? "markedTomorrow" : "camera.markedSold", {
          name,
          id: order.id,
        }),
        duration: 2000,
      });
      void playScanFeedback(
        "success",
        t(next === "cancel" ? "camera.markedCancel" : next === "tomorrow" ? "camera.markedTomorrow" : "camera.markedSold", {
          id: order.id,
          name,
        }),
        undefined,
        { voice: "selected" },
      );
    },
    [actions, forgetRowError, scanMode, t, touchRecentScan],
  );

  const handleScanMissing = useCallback(() => {
    setScanError(t("scanMissing"));
    // Qisqa (3 s) — keyingi to'g'ri skandan keyin «Topilmadi» qaytib chiqmasin (G6F68ti6, 16-band).
    scanNotify.error(t("scanMissingTitle"), { description: t("scanMissing"), duration: 3000 });
    void playScanFeedback("missing", t("scanMissing"));
  }, [t]);

  /** Kamera «Bekor qilish»: belgi olinadi (server amali yo'q), shu buyurtmani qayta skanerlash mumkin. */
  const unmarkScannedOrder = useCallback(
    (orderId: string) => {
      setActions((prev) => {
        if (!(orderId in prev)) return prev;
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      for (const [token, id] of scannedTokenRef.current) if (id === orderId) scannedTokenRef.current.delete(token);
      forgetRecentScan(orderId);
      forgetRowError(orderId);
    },
    [forgetRecentScan, forgetRowError],
  );

  // Kamera ro'yxati — faqat SKAN bilan belgilanganlar (bekor / ertaga), yangisi birinchi. Qatordagi tanlov bilan
  // qo'lda belgilanganlar «N / M ta skanerlandi» ga kirmaydi va kamera «Bekor qilish» ularga tegmaydi.
  const scannedOrders = useMemo(() => {
    const scannedIds = new Set(recentScanIds);
    return orderByRecent(
      orders.filter(
        (order) =>
          scannedIds.has(order.id) && (actions[order.id] === "cancel" || actions[order.id] === "tomorrow"),
      ),
      (order) => order.id,
      recentScanIds,
    );
  }, [actions, orders, recentScanIds]);
  const scannedCancelCount = scannedOrders.filter((order) => actions[order.id] === "cancel").length;
  const scannedTomorrowCount = scannedOrders.length - scannedCancelCount;
  const cameraList = useMemo<ScanTargetListItem[]>(
    () =>
      scannedOrders.map((order) => {
        const action = actions[order.id];
        return {
          key: order.id,
          title: [`№${order.id}`, order.customer?.name].filter(Boolean).join(" · "),
          subtitle: [
            t(action === "cancel" ? "list.cancel" : "list.tomorrow"),
            order.district?.name ?? order.region?.name,
            formatMoneyLocalized(Number(order.total_price) || 0, { language }),
          ]
            .filter(Boolean)
            .join(" · "),
          tone: action === "cancel" ? "danger" : "warning",
          onUndo: () => unmarkScannedOrder(order.id),
        };
      }),
    [actions, language, scannedOrders, t, unmarkScannedOrder],
  );
  const num = (value: number) => formatNumberLocalized(value, { language });
  // «Skanerlanmagan N ta … sotilgan deb belgilanadi» — bekor / ertaga belgisi yo'qlar (skan yoki qatordagi tanlov);
  // bu yerdan sotilmaydiganlar (pochtasi qabul qilinmagan, almashtirish, menejerda kuryer qo'lidagi) kirmaydi.
  const unscannedCount = orders.filter(
    (order) =>
      actions[order.id] !== "cancel" &&
      actions[order.id] !== "tomorrow" &&
      !isCourierBulkAwaitingPost(order) &&
      !isCourierBulkSellBlocked(order, viewer),
  ).length;

  useOrderQrScanner({
    orders,
    // Isbot / natija oynasi ochiq bo'lsa skan belgilarni o'zgartirmaydi; yakunlash so'rovlari ketayotganda skan
    // e'tiborsiz, lekin ochiq kamera yopilmaydi.
    enabled: !proofStep?.open && !isResultOpen,
    paused: isBusy || isConfirming,
    onMatch: handleScanMatch,
    onMissing: handleScanMissing,
    camera: {
      id: "courier-bulk",
      title: t("page.finalize"),
      context: t("camera.context", { value: num(orders.length) }),
      modes: [
        { value: "cancel", label: t("scanMode.cancelShort") },
        { value: "tomorrow", label: t("scanMode.tomorrowShort") },
      ],
      mode: scanMode,
      onModeChange: (value) => setScanMode(value === "tomorrow" ? "tomorrow" : "cancel"),
      progress: { done: scannedOrders.length, total: orders.length, label: t("camera.meter") },
      note: { title: t("camera.unscanned", { value: num(unscannedCount) }) },
      list: cameraList,
      listTitle: t("camera.listTitle"),
      listDescription: t("camera.listDescription", {
        done: num(scannedOrders.length),
        total: num(orders.length),
        cancel: num(scannedCancelCount),
        tomorrow: num(scannedTomorrowCount),
      }),
      listNote: t("camera.unscanned", { value: num(unscannedCount) }),
      finish: { label: t("ui:camera.action.finish"), onFinish: () => undefined },
    },
  });

  const clearActions = () => {
    setActions({});
    setRowErrors({});
    scannedTokenRef.current.clear();
    clearRecentScans();
    setScanError("");
  };

  /** Natija xabaridagi «… qoldi» qatorlari — so'rov ketmagan buyurtmalar, sababi bilan. */
  const keptNotes = (kept: KeptCounts) =>
    [
      kept.tomorrow > 0 ? t("finalizeTomorrowKept", { count: kept.tomorrow }) : "",
      kept.replacement > 0 ? t("finalizeReplacementKept", { count: kept.replacement }) : "",
      kept.courierHeld > 0 ? t("finalizeCourierHeldKept", { count: kept.courierHeld }) : "",
      kept.awaitingPost > 0 ? t("finalizeAwaitingPostKept", { count: kept.awaitingPost }) : "",
    ].filter(Boolean);

  const handleProofChange = useCallback((proofKey: string, file: File | undefined) => {
    setProofs((previous) => ({ ...previous, [proofKey]: file }));
  }, []);

  /**
   * So'rovlarni yuborish. Isbotsiz buyurtmalar 6 tadan, isbotlilar (fayl yuklash + amal) ko'pi bilan 2 tadan
   * parallel; har so'rov `X-Request-Source: courier-bulk` (audit) va shu urinishdagi barqaror `Idempotency-Key`
   * bilan — vaqtinchalik xato (429, 5xx, tarmoq) bo'lsa ayni kalit bilan qayta yuboriladi (`withCourierBulkRetry`).
   */
  const runFinalize = async (tasks: FinalizeTask[], kept: KeptCounts) => {
    // Ro'yxat so'rovi birinchi so'rovdan OLDIN o'chadi (sinxron render): javob React qayta chizishidan oldin kelsa ham
    // ["orders"] eskirishi ro'yxatni qayta so'ramaydi.
    flushSync(() => setIsFinalizing(true));
    const { proofTasks, plainTasks } = splitCourierBulkTasksByProof(tasks);

    // Isbot faqat isbot talab qilinadigan buyurtmaga yuboriladi (keraksiz fayl yuklanmaydi).
    const runId = createIdempotencyKey();
    const runTask =
      (withProof: boolean) =>
      async ({ order, action }: FinalizeTask) => {
        const proof = withProof ? proofs[getCourierBulkProofKey({ order, action })] : undefined;
        const proofData = proof instanceof File ? { proof } : {};
        // 429 / 5xx / tarmoq — kutib ayni kalit bilan qayta yuboriladi, buyurtma «o'tmay» qolmasin.
        const headers = {
          ...COURIER_BULK_REQUEST_HEADERS,
          "Idempotency-Key": getCourierBulkIdempotencyKey(runId, action, order.id),
        };
        await withCourierBulkRetry(() =>
          action === "cancel"
            ? CancelOrder.mutateAsync({
                orderId: order.id,
                data: { comment: t("bulkCancelComment"), extraCost: 0, ...proofData },
                headers,
              })
            : SellOrder.mutateAsync({
                orderId: order.id,
                data: { comment: t("bulkSoldComment"), extraCost: 0, ...proofData },
                headers,
              }),
        );
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
    // Bajarilganlar ro'yxatdan darhol olib tashlanadi (yangilanishni kutmasdan): aks holda ular bir lahza belgisiz —
    // sukut «Sotildi» bilan — qolib, «eski holatiga qaytdi»dek ko'rinardi.
    if (succeededOrderIds.size > 0) {
      queryClient.setQueryData<CourierBulkOrder[]>(COURIER_BULK_QUERY_KEY, (previous) =>
        previous?.filter((order) => !succeededOrderIds.has(String(order.id))),
      );
    }
    setRowErrors(Object.fromEntries(failures.map(({ order, error }) => [String(order.id), error])));
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
      setResult({ failures, succeededCount: succeededOrderIds.size, keptNotes: keptNotes(kept) });
      setIsResultOpen(true);
      return;
    }

    const notes = keptNotes(kept);
    notify.success(t("finalizeSuccessTitle"), {
      description: [t("finalizeSuccessDescription", { count: succeededOrderIds.size }), ...notes].join(" "),
      // Qolganlari haqida izoh bo'lsa — o'qib ulgurilsin.
      duration: notes.length > 0 ? 6000 : 3000,
    });
  };

  const handleFinalize = async () => {
    if (orders.length === 0 || isBusy || managerCannotFinalize) return;

    // "Ertaga" — so'rovsiz, buyurtma kutilmoqda holatida qoladi (FE-CB-09).
    const tasks = getCourierBulkFinalizeTasks(orders, actions, viewer);
    // So'rov ketmaydiganlar sababi bilan: «ertaga»; almashtirish (lQjt6sKP — «Eski mahsulotni oldim» tasdig'i
    // «Buyurtmalar» sotish oynasida); menejerda kuryer qo'lidagi (LC-04); pochtasi qabul qilinmagan (6qypMFeT).
    const keptOrders = getCourierBulkKept(orders, actions, viewer);
    const kept: KeptCounts = {
      tomorrow: keptOrders.tomorrow.length,
      replacement: keptOrders.replacement.length,
      courierHeld: keptOrders.courierHeld.length,
      awaitingPost: keptOrders.awaitingPost.length,
    };

    if (tasks.length === 0) {
      notify.info(t("finalizeSuccessTitle"), {
        description: [
          t(kept.tomorrow > 0 ? "finalizeNothing" : "finalizeNothingPlain"),
          ...keptNotes({ ...kept, tomorrow: 0 }),
        ].join(" "),
      });
      return;
    }

    // «Kunni yakunlash» — tasdiqlash oynasi orqali (maket `courier-courier-bulk-confirm-dialog`).
    const cancelTasks = tasks.filter((task) => task.action === "cancel");
    const soldCount = tasks.length - cancelTasks.length;
    const unmarked = getCourierBulkUnmarkedCount(orders, actions, viewer);
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
    if (kept.tomorrow > 0) {
      consequences.push({
        text: t("confirmTomorrow", { count: kept.tomorrow }),
        hint: t("confirmTomorrowHint"),
        tone: "warning",
        icon: CalendarClock,
      });
    }
    if (kept.replacement > 0) {
      consequences.push({
        text: t("confirmReplacement", { count: kept.replacement }),
        hint: t("confirmReplacementHint"),
        tone: "warning",
        icon: Repeat,
      });
    }
    if (kept.courierHeld > 0) {
      consequences.push({
        text: t("confirmCourierHeld", { count: kept.courierHeld }),
        hint: t("confirmCourierHeldHint"),
        tone: "warning",
        icon: UserRound,
      });
    }
    if (kept.awaitingPost > 0) {
      consequences.push({
        text: t("confirmAwaitingPost", { count: kept.awaitingPost }),
        hint: t("confirmAwaitingPostHint"),
        tone: "warning",
        icon: Truck,
      });
    }
    setIsConfirming(true);
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
    }).finally(() => setIsConfirming(false));
    if (!confirmed) return;

    // Market isbot talab qiladigan buyurtmalar (j9KFyqlS): isbotsiz backend 400 qaytaradi — avval isbot
    // qadami. Isbot kerak bo'lmasa — qo'shimcha qadamsiz darhol yakunlanadi.
    const { proofTasks, plainTasks } = splitCourierBulkTasksByProof(tasks);
    if (proofTasks.length > 0) {
      setProofStep({ open: true, tasks, proofTasks, plainCount: plainTasks.length, kept });
      return;
    }

    await runFinalize(tasks, kept);
  };

  const handleProofSubmit = () => {
    if (!proofStep || isFinalizing || !hasAllCourierBulkProofs(proofStep.proofTasks, proofs)) return;
    void runFinalize(proofStep.tasks, proofStep.kept);
  };

  // «Kunni yakunlash» — DOM'da BITTA tugma: ≥ 768 sarlavhada, telefonda pastki menyu ustidagi panelda.
  const finalizeButton = (
    <Button
      size={isPhone ? "lg" : "md"}
      fullWidth={isPhone}
      leftIcon={Zap}
      aria-haspopup="dialog"
      disabled={orders.length === 0 || managerCannotFinalize}
      loading={isBusy}
      onClick={() => void handleFinalize()}
    >
      {t("page.finalize")}
    </Button>
  );

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
        isPhone={isPhone}
        isBelowLg={isBelowLg}
      />

      {managerCannotFinalize ? (
        <BulkAlert tone="danger" role="note" data-testid="courier-bulk-no-permission" title={t("noPermissionTitle")}>
          {t("noPermissionText")}
        </BulkAlert>
      ) : null}

      {/* Skan topilmadi — keyingi muvaffaqiyatli skangacha turadi (+ xabar, maket «Buyurtma topilmadi»). */}
      {scanError ? (
        <BulkAlert tone="danger" data-testid="courier-bulk-scan-error">
          {scanError}
        </BulkAlert>
      ) : null}

      <CourierBulkOrders
        query={ordersQuery}
        orders={orders}
        actions={actions}
        viewer={viewer}
        rowErrors={rowErrors}
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
