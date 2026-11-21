// dizayn-v2: courier-courier-bulk-main, manager-courier-bulk-main, courier-courier-bulk-confirm-dialog
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useSelector } from "react-redux";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Check,
  CircleX,
  PackageCheck,
  Repeat,
  RotateCcw,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOrders } from "../../entities/orders";
import { isCourierHeldOrder } from "../../entities/orders/custody";
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
  COURIER_BULK_PROOF_CONCURRENCY,
  COURIER_BULK_REQUEST_HEADERS,
  extractCourierBulkOrders,
  extractCourierBulkTotal,
  getCourierBulkActionsAfterFinalize,
  getCourierBulkCancelOnlyTasks,
  getCourierBulkCounts,
  getCourierBulkFinalizeTasks,
  getCourierBulkKept,
  getCourierBulkProofKey,
  getCourierBulkUnmarkedCount,
  hasAllCourierBulkProofs,
  isCourierBulkOrderMarked,
  mergeCourierBulkOrders,
  runCourierBulkAction,
  runLimited,
  splitCourierBulkTasksByProof,
  getCourierBulkIdempotencyKey,
  withCourierBulkRetry,
  summarizeCourierBulkResults,
  type CourierBulkAction,
  type CourierBulkFinalizeTask,
  type CourierBulkOrder,
  type CourierBulkScanMode,
} from "./model/courierBulk";
import {
  pruneCourierBulkActions,
  readCourierBulkMarks,
  writeCourierBulkMarks,
} from "./model/courierBulkMarksStorage";
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
type KeptCounts = { tomorrow: number; replacement: number };

const NOTHING_KEPT: KeptCounts = { tomorrow: 0, replacement: 0 };

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
        // Menejer: faqat filialda / filial kuryerlarida JISMONAN turganlar — sota/bekor qila oladiganlari (BE
        // `scope=actionable`; yaratilgan filial bo'yicha boshqa filialdagi buyurtma chiqib, 400 bermasin). Kuryerga
        // ta'sir qilmaydi.
        scope: "actionable",
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
 * filialga cheklaydi). Kun yakunida har buyurtma natijasi belgilanadi: «Sotildi» — sotiladi, «Bekor» — bekor
 * qilinadi, «Ertaga» — so'rovsiz kutilmoqda holatida qoladi (FE-CB-09). BEEPOST MODELI (ega 2026-11-21): sukut
 * natija — «Sotildi»: kuryer kun oxirida faqat qaytgan (bekor) va ertaga qoladigan posilkalarni skanerlaydi,
 * qolgani sotiladi (tasdiq oynasida belgilash katagi bilan). Boshqa rejimda qayta skanerlash belgini o'sha rejimga
 * ko'chiradi; belgilar brauzerda saqlanadi (sahifa yangilansa yo'qolmaydi); «Faqat bekorlar» — sotuvsiz bekor.
 * Menejer kuryer qo'lidagi buyurtmani kuryer nomidan sotadi (BE LC-04, pul kuryer kassasi orqali).
 * Belgilash: qatordagi «Sotildi | Bekor | Ertaga», USB skaner yoki kamera (skanerlash rejimi bo'yicha).
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
 * Saqlangan: barcha sahifalarni yig'ish (100 tadan, 50 sahifagacha), skan takrori / topilmadi, xato bergan va
 * «ertaga» belgilari qoladi.
 *
 * YUBORISH: isbotsizlar BULK so'rov bilan (`POST /orders/bulk/cancel`, keyin `/bulk/sell`; 20 tadan bo'lak, bo'laklar
 * ketma-ket, server har buyurtma natijasini qaytaradi) — ilgari har buyurtmaga alohida so'rov ketardi (100 ta = 100
 * so'rov, gateway chegarasi 429 / order-service 500). Isbot (j9KFyqlS, dev cf13e85): tasdiqdan keyin market isbot
 * talab qiladigan buyurtmalar bo'lsa — isbot qadami (`CourierBulkProofDialog`, har buyurtmaga `ProofField`; hammasiga
 * fayl tanlanmaguncha «Yakunlash» o'chiq); ular yakka so'rov bilan, ko'pi bilan 2 tadan parallel. Har so'rovda
 * `X-Request-Source: courier-bulk` va yakunlash kaliti (`Idempotency-Key`).
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
  // Menejer `can_sell_cancel` siz hech narsani sota ham, bekor qila ham olmaydi (backend 403) — yakunlash o'chiq.
  const managerCannotFinalize = isManager && !getUserCanSellCancel(currentUser);
  const isPhone = useIsPhone();
  const isBelowLg = useIsBelowLg();
  const { SellOrder, CancelOrder, BulkOrderAction } = useOrders();
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

  // Belgilar brauzerda saqlanadi (foydalanuvchi bo'yicha): sahifa yangilansa / qaytilsa yo'qolmaydi.
  const marksKey = `${role ?? ""}:${currentUser?.id ?? ""}`;
  const [loadedMarksKey, setLoadedMarksKey] = useState(marksKey);
  const [scanMode, setScanMode] = useState<CourierBulkScanMode>(() => readCourierBulkMarks(marksKey)?.scanMode ?? "cancel");
  const [actions, setActions] = useState<Record<string, CourierBulkAction>>(
    () => readCourierBulkMarks(marksKey)?.actions ?? {},
  );
  // Profil keyinroq yuklansa (kalit o'zgardi) — shu foydalanuvchining belgilari (holat render paytida — effektsiz).
  if (loadedMarksKey !== marksKey) {
    setLoadedMarksKey(marksKey);
    const saved = readCourierBulkMarks(marksKey);
    // Profil hali yuklanmagan paytda (kalitda id yo'q) qo'yilgan belgilar yo'qolmasin — saqlanganlar ustiga qo'shiladi.
    const carry = loadedMarksKey.endsWith(":");
    setActions(carry ? { ...(saved?.actions ?? {}), ...actions } : (saved?.actions ?? {}));
    if (!carry) setScanMode(saved?.scanMode ?? "cancel");
  }
  const ordersSettled = ordersQuery.isSuccess && !isFetching && !isFinalizing;
  useEffect(() => {
    // Ro'yxat to'liq yuklangach — unda yo'q buyurtmalar (sotilgan, boshqa kuryerga o'tgan) belgisi saqlanmaydi.
    const saved = ordersSettled ? pruneCourierBulkActions(actions, new Set(orders.map((order) => String(order.id)))) : actions;
    writeCourierBulkMarks(marksKey, { actions: saved, scanMode });
  }, [actions, marksKey, orders, ordersSettled, scanMode]);
  // Yakunlash jarayoni (bo'laklar bajarilgani bo'yicha) — tugmada «Bajarilmoqda: N / M».
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
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
  const { recent: recentScanIds, touch: touchRecentScan, forget: forgetRecentScan, clear: clearRecentScans } =
    useRecentScans();

  const counts = useMemo(() => getCourierBulkCounts(orders, actions), [actions, orders]);
  const unmarkedCount = useMemo(() => getCourierBulkUnmarkedCount(orders, actions), [actions, orders]);
  const hasMarks = useMemo(() => orders.some((order) => isCourierBulkOrderMarked(order.id, actions)), [actions, orders]);
  const isInitialLoading = isLoading && orders.length === 0;
  const isBusy = isFinalizing || SellOrder.isPending || CancelOrder.isPending || BulkOrderAction.isPending;


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

  /**
   * Skan (BeePost modeli): buyurtma tanlangan rejimga belgilanadi. Boshqa rejimda qayta skanerlansa — belgi o'sha
   * rejimga KO'CHADI («Bekor» → «Ertaga» va aksincha); ayni rejimda qayta skanerlansa — «Qayta skaner» ogohlantirishi
   * (belgi o'zgarmaydi). Ilgari takroriy token har doim rad etilardi — noto'g'ri rejimda skanerlangan posilkani skaner
   * bilan tuzatib bo'lmasdi.
   */
  const handleScanMatch = useCallback(
    (order: OrderListItem) => {
      const name = order.customer?.name ?? `#${order.id}`;
      const previous = actions[order.id];

      if (previous === scanMode) {
        scanNotify.warning(t("duplicateTitle"), { description: t("duplicateDescription") });
        void playScanFeedback("duplicate", t("duplicateDescription"));
        return;
      }

      const moved = previous === "cancel" || previous === "tomorrow";
      setActions((prev) => ({ ...prev, [order.id]: scanMode }));
      forgetRowError(order.id);
      touchRecentScan(order.id);
      setScanError("");
      scanNotify.success(t(moved ? "scanMovedTitle" : "scanSuccessTitle"), {
        description: t(scanMode === "cancel" ? "markedCancel" : "markedTomorrow", { name, id: order.id }),
        duration: 2000,
      });
      void playScanFeedback(
        "success",
        t(scanMode === "cancel" ? "camera.markedCancel" : "camera.markedTomorrow", { id: order.id, name }),
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

  /** Kamera «Bekor qilish»: belgi olinadi (server amali yo'q) — buyurtma yana sukut «sotildi»ga qaytadi. */
  const unmarkScannedOrder = useCallback(
    (orderId: string) => {
      setActions((prev) => {
        if (!(orderId in prev)) return prev;
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
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
      // Belgilanmaganlar yakunlashda sotiladi (sukut) — kamerada ham shu aytiladi.
      note: { title: t("camera.unmarked", { value: num(unmarkedCount) }) },
      list: cameraList,
      listTitle: t("camera.listTitle"),
      listDescription: t("camera.listDescription", {
        done: num(scannedOrders.length),
        total: num(orders.length),
        cancel: num(scannedCancelCount),
        tomorrow: num(scannedTomorrowCount),
      }),
      listNote: t("camera.unmarked", { value: num(unmarkedCount) }),
      finish: { label: t("ui:camera.action.finish"), onFinish: () => undefined },
    },
  });

  const clearActions = () => {
    setActions({});
    setRowErrors({});
    clearRecentScans();
    setScanError("");
  };

  /** Natija xabaridagi «… qoldi» qatorlari — so'rov ketmagan buyurtmalar, sababi bilan. */
  const keptNotes = (kept: KeptCounts) =>
    [
      kept.tomorrow > 0 ? t("finalizeTomorrowKept", { count: kept.tomorrow }) : "",
      kept.replacement > 0 ? t("finalizeReplacementKept", { count: kept.replacement }) : "",
    ].filter(Boolean);

  const handleProofChange = useCallback((proofKey: string, file: File | undefined) => {
    setProofs((previous) => ({ ...previous, [proofKey]: file }));
  }, []);

  /**
   * So'rovlarni yuborish. Isbotsizlar — BULK (`runCourierBulkAction`: avval barcha bekorlar, keyin sotuvlar, 20 tadan
   * bo'lak, bo'laklar ketma-ket); isbotlilar (fayl yuklash + amal) — yakka so'rov, ko'pi bilan 2 tadan parallel. Har
   * so'rov `X-Request-Source: courier-bulk` (audit) va shu yakunlashning barqaror `Idempotency-Key` i bilan —
   * vaqtinchalik xato (429, 5xx, tarmoq) bo'lsa ayni kalit bilan qayta yuboriladi (amal ikki marta bajarilmaydi).
   */
  const runFinalize = async (tasks: FinalizeTask[], kept: KeptCounts) => {
    // Ro'yxat so'rovi birinchi so'rovdan OLDIN o'chadi (sinxron render): javob React qayta chizishidan oldin kelsa ham
    // ["orders"] eskirishi ro'yxatni qayta so'ramaydi.
    flushSync(() => setIsFinalizing(true));
    setProgress({ done: 0, total: tasks.length });
    const advance = (count: number) =>
      setProgress((previous) => (previous ? { ...previous, done: Math.min(previous.total, previous.done + count) } : previous));
    const { proofTasks, plainTasks } = splitCourierBulkTasksByProof(tasks);
    const comment = {
      cancel: t(isManager ? "bulkCancelCommentManager" : "bulkCancelComment"),
      sold: t(isManager ? "bulkSoldCommentManager" : "bulkSoldComment"),
    };

    const runId = createIdempotencyKey();
    const runPlain = async () => {
      const outcome = new Map<string, PromiseSettledResult<unknown>>();
      const headers = { ...COURIER_BULK_REQUEST_HEADERS, "Idempotency-Key": `courier-bulk:${runId}` };
      // BeePost tartibi: avval bekorlar, keyin sotuvlar.
      for (const action of ["cancel", "sold"] as const) {
        const orderIds = plainTasks.filter((task) => task.action === action).map((task) => String(task.order.id));
        if (orderIds.length === 0) continue;
        const results = await runCourierBulkAction(
          orderIds,
          (chunk) => BulkOrderAction.mutateAsync({ action, orderIds: chunk, comment: comment[action], headers }),
          { onChunkDone: advance },
        );
        results.forEach((result, orderId) => outcome.set(`${action}:${orderId}`, result));
      }
      return outcome;
    };

    // Isbot faqat isbot talab qilinadigan buyurtmaga yuboriladi (keraksiz fayl yuklanmaydi).
    const runProofTask = async ({ order, action }: FinalizeTask) => {
      const proof = proofs[getCourierBulkProofKey({ order, action })];
      const proofData = proof instanceof File ? { proof } : {};
      // 429 / 5xx / tarmoq — kutib ayni kalit bilan qayta yuboriladi, buyurtma «o'tmay» qolmasin.
      const headers = {
        ...COURIER_BULK_REQUEST_HEADERS,
        "Idempotency-Key": getCourierBulkIdempotencyKey(runId, action, order.id),
      };
      try {
        await withCourierBulkRetry(() =>
          action === "cancel"
            ? CancelOrder.mutateAsync({
                orderId: order.id,
                data: { comment: comment.cancel, extraCost: 0, ...proofData },
                headers,
              })
            : SellOrder.mutateAsync({
                orderId: order.id,
                data: { comment: comment.sold, extraCost: 0, ...proofData },
                headers,
              }),
        );
      } finally {
        advance(1);
      }
    };

    const [plainOutcome, proofResults] = await Promise.all([
      runPlain(),
      runLimited(proofTasks, COURIER_BULK_PROOF_CONCURRENCY, runProofTask),
    ]);
    // Natija har vazifaga o'zi bilan bog'lanadi (`runLimited` — kirish tartibida); xatolar ro'yxati sahifa tartibida.
    const settled = new Map<FinalizeTask, PromiseSettledResult<unknown>>();
    plainTasks.forEach((task) => {
      const result = plainOutcome.get(`${task.action}:${String(task.order.id)}`);
      if (result) settled.set(task, result);
    });
    proofTasks.forEach((task, index) => settled.set(task, proofResults[index]));
    const { succeededOrderIds, failures } = summarizeCourierBulkResults(
      tasks,
      tasks.map((task) => settled.get(task) ?? { status: "rejected", reason: undefined }),
    );

    setIsFinalizing(false);
    setProgress(null);
    setProofStep((previous) => (previous ? { ...previous, open: false } : previous));
    // Bajarilganlar ro'yxatdan darhol olib tashlanadi (yangilanishni kutmasdan): aks holda ular bir lahza belgisiz
    // qolib, «eski holatiga qaytdi»dek ko'rinardi.
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

  /** Tasdiqdan keyin: isbot kerak bo'lsa — isbot qadami, aks holda darhol yuborish. */
  const startRun = async (tasks: FinalizeTask[], kept: KeptCounts) => {
    // Market isbot talab qiladigan buyurtmalar (j9KFyqlS): isbotsiz backend 400 qaytaradi — avval isbot
    // qadami. Isbot kerak bo'lmasa — qo'shimcha qadamsiz darhol yakunlanadi.
    const { proofTasks, plainTasks } = splitCourierBulkTasksByProof(tasks);
    if (proofTasks.length > 0) {
      setProofStep({ open: true, tasks, proofTasks, plainCount: plainTasks.length, kept });
      return;
    }
    await runFinalize(tasks, kept);
  };

  const handleFinalize = async () => {
    if (orders.length === 0 || isBusy || managerCannotFinalize) return;

    // BeePost modeli: belgilanmagani — «sotildi»; «ertaga» — so'rovsiz kutilmoqda qoladi (FE-CB-09).
    const tasks = getCourierBulkFinalizeTasks(orders, actions);
    // So'rov ketmaydiganlar sababi bilan: «ertaga»; almashtirish (lQjt6sKP — «Eski mahsulotni oldim» tasdig'i
    // «Buyurtmalar» sotish oynasida).
    const keptOrders = getCourierBulkKept(orders, actions);
    const kept: KeptCounts = {
      tomorrow: keptOrders.tomorrow.length,
      replacement: keptOrders.replacement.length,
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
    const soldTasks = tasks.filter((task) => task.action === "sold");
    // Sukut bo'yicha sotiladiganlar (qo'lda / skan bilan belgilanmagan) — belgilash katagi bilan tasdiqlanadi.
    const unmarkedSold = soldTasks.filter((task) => !isCourierBulkOrderMarked(task.order.id, actions)).length;
    // Menejer: kuryer qo'lidagilari kuryer nomidan sotiladi (BE LC-04 — pul kuryer kassasi orqali).
    const onBehalfSold = isManager ? soldTasks.filter((task) => isCourierHeldOrder(task.order)).length : 0;
    const consequences: ConfirmConsequence[] = [];
    if (soldTasks.length > 0) {
      consequences.push({
        text: t("confirmSold", { count: soldTasks.length }),
        hint: unmarkedSold > 0 ? t("confirm.soldUnmarkedHint", { count: unmarkedSold }) : t("confirm.soldMarked"),
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
    setIsConfirming(true);
    const confirmed = await confirm({
      title: t("confirmTitle"),
      description: t("confirmDescription", { count: orders.length }),
      icon: Zap,
      size: "md",
      closable: true,
      consequences,
      note: onBehalfSold > 0 ? t("confirm.managerOnBehalf", { count: onBehalfSold }) : undefined,
      children: (
        <BulkAlert tone="warning" role="note" title={t("confirm.irreversibleTitle")}>
          {t("confirm.irreversibleText", { count: tasks.length })}
        </BulkAlert>
      ),
      // BeePost'dagi xavfsizlik katagi: skanerlanmay qolgan posilka ham sotiladi — ongli tasdiq.
      acknowledge: unmarkedSold > 0 ? t("confirmAcknowledge", { count: unmarkedSold }) : undefined,
      confirmLabel: t("confirmAction"),
      confirmIcon: Check,
      cancelLabel: t("confirmBack"),
    }).finally(() => setIsConfirming(false));
    if (!confirmed) return;

    await startRun(tasks, kept);
  };

  /** «Faqat bekorlar» (BeePost «Faqat bekor»): «Bekor» belgilanganlar bekor qilinadi, sotuv so'rovi ketmaydi. */
  const handleCancelOnly = async () => {
    if (orders.length === 0 || isBusy || managerCannotFinalize) return;
    const tasks = getCourierBulkCancelOnlyTasks(orders, actions);
    if (tasks.length === 0) {
      notify.info(t("cancelOnlyTitle"), { description: t("cancelOnlyNothing") });
      return;
    }
    const single = tasks.length === 1 ? tasks[0].order : null;
    setIsConfirming(true);
    const confirmed = await confirm({
      title: t("cancelOnlyTitle"),
      description: t("cancelOnlyDescription", { count: tasks.length }),
      icon: CircleX,
      tone: "danger",
      size: "md",
      closable: true,
      consequences: [
        {
          text: t("confirmCancel", { count: tasks.length }),
          hint: single
            ? t("confirmCancelOneHint", { id: single.id, name: single.customer?.name ?? `#${single.id}` })
            : t("confirmCancelHint"),
          tone: "danger",
          icon: CircleX,
        },
      ],
      confirmLabel: t("cancelOnlyAction"),
      confirmIcon: CircleX,
      cancelLabel: t("confirmBack"),
    }).finally(() => setIsConfirming(false));
    if (!confirmed) return;

    await startRun(tasks, NOTHING_KEPT);
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
      loadingText={progress ? t("finalizeProgress", { done: progress.done, total: progress.total }) : undefined}
      onClick={() => void handleFinalize()}
    >
      {t("page.finalize")}
    </Button>
  );
  // «Faqat bekorlar» — faqat «Bekor» belgisi bo'lsa faol.
  const hasCancelMarks = orders.some((order) => actions[order.id] === "cancel");
  const cancelOnlyButton = (
    <Button
      variant="secondary"
      leftIcon={CircleX}
      fullWidth={isPhone}
      aria-haspopup="dialog"
      disabled={!hasCancelMarks || isBusy || managerCannotFinalize}
      onClick={() => void handleCancelOnly()}
    >
      {t("page.cancelOnly")}
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
              {cancelOnlyButton}
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
          <div className="fixed inset-x-0 bottom-[var(--shell-bottomnav-h)] z-30 flex gap-2 border-t border-border bg-surface px-4 py-3">
            {hasCancelMarks ? <div className="w-2/5 shrink-0">{cancelOnlyButton}</div> : null}
            <div className="min-w-0 flex-1">{finalizeButton}</div>
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
