// dizayn-v2: superadmin-mails-detail, superadmin-mails-detail-send-dialog, superadmin-mails-detail-refused, superadmin-mails-detail-old, admin-mails-detail, admin-mails-send-branch-dialog, admin-mails-refused-detail, admin-mails-old-detail, manager-mails-detail-receive, manager-mails-detail-refused-receive, manager-mails-detail-old, registrator-mails-detail, registrator-mails-detail-send-dialog, registrator-mails-detail-refused, registrator-mails-detail-old, courier-mails-detail-receive, courier-mails-detail-refused, courier-mails-detail-old, courier-mails-detail-print-menu
import { Fragment, memo, useEffect, useMemo, useCallback, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CircleX, Info, Lock, Trash2, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  useDeleteOrdersFromPost,
  useMails,
  useMailDetail,
  type PostOrder,
  useReceiveCanceledPost,
  useReceivePost,
} from "../../../entities/mails";
import type { RootState } from "../../../app/config/store";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import { canDispatchPostToBranch } from "../../../app/lib/access";
import { getDispatchDestinations, type Branch } from "../../../entities/branch";
import { getUserBranchType } from "../../../widgets/Sidebar/model/menuConfig";
import PrintModeSelect from "../../../shared/components/PrintModeSelect";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { useOrderQrScanner } from "../../../shared/lib/useOrderQrScanner";
import {
  Badge,
  Button,
  ErrorState,
  PageHeader,
  Skeleton,
  SkeletonTable,
  StatCard,
  StatusBadge,
} from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import { DetailAlert } from "../../new_orders/components/detail/DetailAlert";
import { extractScannerToken, normalizeScannerCandidates } from "../../../shared/lib/scanToken";
import { playScanFeedback } from "../../../shared/lib/scanner/feedback";
import { orderByRecent, scanNotify, useRecentScans } from "../../../shared/lib/scanner/scanSession";
import type { ScanTargetListItem } from "../../../shared/lib/scanner/scanTargets";
import { fetchScanDetail, getBackendErrorMessage } from "../../scan/lib/scanResource";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { getMailTabPath, normalizeMailTab, type MailTab } from "../lib/navigation";

// ─── UI komponentlar ──────────────────────────────────────────────────────────
import MailStatCards from "./ui/MailStatCards";
import OrdersTable, { type OrdersTableColumn } from "./ui/OrdersTable";
import SendButton from "./ui/SendButton";
import SendPostModal from "./ui/SendPostModal";
import DeleteFromPostDialog from "./ui/DeleteFromPostDialog";
import { useMailPrintOptions } from "./ui/printOptions";
import { getPostStatusBadge } from "./lib/postStatus";
import { printOrders, type PrintMode } from "./lib/printMode";
import { resolveDispatchRegionId } from "./lib/dispatchRegion";
import { extractNotReceivedOrderIds, hasOnTheRoadOrders } from "./lib/receiveResult";
import {
  REFUSED_MAIL_ORDER_STATUSES,
  TODAY_MAIL_ORDER_STATUSES,
  extractOrderItems,
  getOrderIdentifiers,
  isSameCustomerMarketOrder,
  normalizeMatchText,
  toText,
  unwrapScannedOrder,
} from "./lib/scanMatch";

// ─── Model ────────────────────────────────────────────────────────────────────
import { useMailDetailState } from "./model/useMailDetailState";

/**
 * POCHTA TAFSILOTI — `/mails/:id` (dizayn v2, sahifa shell ichida).
 *
 * Rejim rol va URL/holatdan (`?type=refused`, `?view=old`, `?view=old-all-batches`; URL tozalanib holatda saqlanadi):
 *  - jo'natish (superadmin/admin/HQ registratori) — «Pochtani jo'natish — n ta» → «Filialni tanlang» oynasi;
 *  - qabul (kuryer, filial menejeri) — faqat yo'ldagi buyurtmalar, «Pochtani qabul qilish — n ta»;
 *    kuryer telefonida tugma pastki menyu ustidagi panelda;
 *  - rad etilgan pochtani qabul qilish — info ogohlantirish, `POST post/cancel/receive/:id`;
 *  - kuryerning rad etilgan pochtasi — faqat o'qish, «Barchasini chop etish»;
 *  - eski pochta (tarix) — faqat o'qish; qolib ketgan yo'ldagi buyurtma bo'lsa qabul qayta ochiladi (fix3b).
 *
 * Tuzilma: `PageHeader` (orqaga — kelingan tab, holat badge'i, chop etish + bitta asosiy amal) → ogohlantirishlar →
 * `MailStatCards` → `OrdersTable` (skaner izohi, tanlov paneli, jadval / telefonda kartalar). USB (HID) skaner —
 * `useOrderQrScanner`.
 *
 * KAMERA (Trello v1eLN2tV 2-bosqich; maketlar `superadmin-mails-detail-camera`, `registrator-mails-detail-camera`,
 * `manager-mails-detail-receive-camera`, `courier-mails-detail-receive-camera`; rad etilgan pochta — maket yo'q,
 * eng yaqini `manager-mails-detail-receive-camera`): sahifada kamera tugmasi yo'q — markaziy «Skaner» (desktopda
 * «Skanerlash») shu sahifaning maqsadini ochadi. Kamera skani USB bilan aynan bir yo'l — buyurtma faqat tanlanadi
 * (jo'natish / qabul — sahifadagi asosiy tugma). Pochtada yo'q kod ro'yxatda «Bu pochtada yo'q · rad etildi».
 * Eski pochta, kuryerning rad etilgan pochtasi va amalsiz rejimda kamera maqsadi yo'q (markaziy tugma — `/scan`).
 */

/** «← …» havolasi — qaytiladigan bo'lim nomi (taxta `tizim-states-navigation`). */
const MAIL_TAB_LABEL_KEYS: Record<MailTab, string> = {
  today: "todayTab",
  return: "returnTab",
  refused: "refusedTab",
  old: "oldTab",
};

/** Kuryer maketlari: «Tuman» (manzilsiz), «Holat» planshetda yashirin; eski pochtada «Holat» yo'q. */
const COURIER_COLUMNS: readonly OrdersTableColumn[] = ["order", "customer", "district", "market", "delivery", "status", "amount"];
const COURIER_HISTORY_COLUMNS: readonly OrdersTableColumn[] = ["order", "customer", "district", "market", "delivery", "amount"];
const COURIER_TABLET_HIDDEN: readonly OrdersTableColumn[] = ["district", "market", "status"];
/** Menejer qabul maketi: «Yetkazish» «Holat» dan oldin va planshetda ham ko'rinadi. */
const MANAGER_COLUMNS: readonly OrdersTableColumn[] = [
  "order",
  "customer",
  "districtAddress",
  "market",
  "delivery",
  "status",
  "amount",
];
const MANAGER_TABLET_HIDDEN: readonly OrdersTableColumn[] = ["districtAddress", "market"];

// ─── Yuklanish holati: sarlavha, ko'rsatkichlar va jadval skeletlari ──────────
const MailDetailSkeleton = memo(() => {
  const { t } = useTranslation("mails");
  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4" aria-busy="true">
      <div className="flex min-w-0 flex-col gap-2">
        <Skeleton width={128} height={14} />
        <Skeleton width={300} height={28} className="max-w-full" />
        <Skeleton width={220} height={14} />
      </div>
      <div className="grid grid-cols-3 gap-4 max-md:hidden">
        <StatCard loading label={t("detailPage.statSelected")} />
        <StatCard loading label={t("detailPage.statHome")} />
        <StatCard loading label={t("detailPage.statCenter")} />
      </div>
      <SkeletonTable
        rows={6}
        columns={[
          t("detailPage.columns.order"),
          t("detailPage.columns.customer"),
          t("detailPage.columns.districtAddress"),
          t("detailPage.columns.market"),
          t("detailPage.columns.status"),
          t("detailPage.columns.amount"),
        ]}
      />
    </div>
  );
});
MailDetailSkeleton.displayName = "MailDetailSkeleton";

// ─── Asosiy Page ──────────────────────────────────────────────────────────────
const MailDetailPage = () => {
  const { t, i18n } = useTranslation(["mails", "newOrders", "orders"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const postId = id;
  const { role } = useSelector((state: RootState) => state.role);
  const user = useSelector((state: RootState) => state.user.user);
  // Menejer ham, registrator ham ishlatadi — shuning uchun "user" filial turi.
  const userBranchType = getUserBranchType(user);
  const isBranchReceiverManager =
    role === "manager" &&
    (userBranchType === "HQ" ||
      userBranchType === "PICKUP" ||
      userBranchType === "REGIONAL" ||
      userBranchType === "HYBRID");
  const isCourier = role === "courier";
  const isCourierLikeReceiver = isCourier || isBranchReceiverManager;
  const isHqRefusedReceiver =
    role === "admin" ||
    role === "superadmin" ||
    ((role === "manager" || role === "registrator") && userBranchType === "HQ");
  // Pochtani filialga jo'natish: superadmin/admin yoki HQ registratori
  // (backend bilan bir xil). Boshqa registratorlar uchun server doim 403
  // qaytaradi, shuning uchun ularga "jo'natish" tugmasi ko'rsatilmaydi.
  const canDispatchToBranch = useSelector(canDispatchPostToBranch);
  const navState = location.state as {
    fromTab?: string;
    type?: string;
    view?: string;
    fromSearch?: string;
    fallbackRegionId?: string;
    fallbackRegionName?: string;
    expectedOrderCount?: number;
  } | null;

  const search = location.search ? new URLSearchParams(location.search) : null;
  const fromTabRaw = navState?.fromTab ?? search?.get("from") ?? undefined;
  const typeRaw = navState?.type ?? search?.get("type") ?? undefined;
  const viewRaw = navState?.view ?? search?.get("view") ?? undefined;
  const fromSearch = navState?.fromSearch ?? "";

  const isRefusedDetail = typeRaw === "refused";
  const isAllBatchesDetail = viewRaw === "old-all-batches";
  const isOldMailView = viewRaw === "old";
  const isReadOnlyRefusedCourier = isCourier && isRefusedDetail;
  const canReceiveRefusedPost = isCourierLikeReceiver || isHqRefusedReceiver;
  const fromTab = fromTabRaw;
  const { useGetRefusedMailsCourierByPostId } = useMails();
  const {
    data: regularResponse,
    isLoading: regularLoading,
    isError: regularError,
    error: regularErrorValue,
    refetch: refetchRegularDetail,
  } = useMailDetail(!isRefusedDetail && !isAllBatchesDetail ? postId ?? "" : "");
  const refusedQuery = useGetRefusedMailsCourierByPostId(isRefusedDetail ? postId ?? "" : "");
  const { data: refusedResponse, isLoading: refusedLoading, isError: refusedError } = refusedQuery;
  const { apiRequest } = useAppNotification();

  // URL ni tozalash: /mails/:id?from=... -> /mails/:id (state orqali saqlab qolamiz)
  useEffect(() => {
    if (!location.search) return;
    navigate(location.pathname, {
      replace: true,
      state: {
        fromTab: fromTabRaw,
        type: typeRaw,
        view: viewRaw,
        fallbackRegionId: navState?.fallbackRegionId,
        fallbackRegionName: navState?.fallbackRegionName,
        expectedOrderCount: navState?.expectedOrderCount,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [sentOrderIds, setSentOrderIds] = useState<Set<string>>(new Set());
  const regularOrdersFromPost = useMemo(
    () => regularResponse?.data?.allOrdersByPostId ?? [],
    [regularResponse],
  );
  const refusedOrdersFromPost = useMemo<PostOrder[]>(() => refusedResponse?.data ?? [], [refusedResponse]);
  /**
   * fix3b LC-11: eski yozuvlarda filial/kuryer qabulidan keyin pochta RECEIVED
   * bo'lib qolgan, ichida esa hamon yo'lda (ON_THE_ROAD) buyurtma bor (bitta
   * yangilash yiqilgan yoki qabul paytida HQ yangi buyurtma qo'shgan).
   * RECEIVED pochta "eski" ko'rinishda faqat o'qish uchun ochilardi va bu
   * posilkalarni hech kim qabul qila olmasdi. Qabul qiluvchiga (kuryer yoki
   * filial menejeri) qabul qilish qayta ochiladi — backend ham bunday
   * pochtani qabul qiladi.
   */
  const hasStuckOnTheRoadOrders =
    isOldMailView &&
    !isRefusedDetail &&
    isCourierLikeReceiver &&
    hasOnTheRoadOrders(regularOrdersFromPost);
  const isOldDetail = (isOldMailView && !hasStuckOnTheRoadOrders) || isAllBatchesDetail;
  const isRegularRefusedDetail =
    !isOldDetail &&
    regularOrdersFromPost.length > 0 &&
    regularOrdersFromPost.every((order) => REFUSED_MAIL_ORDER_STATUSES.has(order.status));
  const isEffectiveRefusedDetail = isRefusedDetail || isRegularRefusedDetail;
  const shouldReceiveCurrentPost = isEffectiveRefusedDetail ? canReceiveRefusedPost : isCourierLikeReceiver;
  // Qabul rejimi (kuryer/menejer, bekor qilingan pochta) — hozirgidek hammaga;
  // "jo'natish" rejimi — faqat filialga jo'nata oladiganlarga.
  const canShowActionButton = shouldReceiveCurrentPost || isEffectiveRefusedDetail || canDispatchToBranch;
  const fallbackRegionId = toText(navState?.fallbackRegionId);
  const fallbackRegionName = toText(navState?.fallbackRegionName);
  const shouldLoadRegionFallback =
    !isAllBatchesDetail &&
    !isEffectiveRefusedDetail &&
    !isOldDetail &&
    !regularLoading &&
    regularOrdersFromPost.length === 0 &&
    Boolean(fallbackRegionId);
  const { data: regionFallbackResponse, isLoading: regionFallbackLoading } = useQuery({
    queryKey: ["mails", "detail-region-fallback", fallbackRegionId, postId],
    queryFn: () =>
      api
        .get(API_ENDPOINTS.ORDERS.BASE, {
          params: {
            page: 1,
            limit: Math.max(100, Number(navState?.expectedOrderCount ?? 0) || 0),
            region_id: fallbackRegionId,
          },
        })
        .then((res) => res.data),
    enabled: shouldLoadRegionFallback,
    staleTime: 10_000,
  });
  const shouldLoadRefusedRegionFallback =
    !isAllBatchesDetail &&
    isEffectiveRefusedDetail &&
    !isOldDetail &&
    !refusedLoading &&
    refusedOrdersFromPost.length === 0 &&
    Boolean(fallbackRegionId);
  const { data: refusedRegionFallbackResponse, isLoading: refusedRegionFallbackLoading } = useQuery({
    queryKey: ["mails", "detail-refused-region-fallback", fallbackRegionId, postId],
    queryFn: () =>
      api
        .get(API_ENDPOINTS.ORDERS.BASE, {
          params: {
            page: 1,
            limit: Math.max(100, Number(navState?.expectedOrderCount ?? 0) || 0),
            region_id: fallbackRegionId,
          },
        })
        .then((res) => res.data),
    enabled: shouldLoadRefusedRegionFallback,
    staleTime: 10_000,
  });
  const regionFallbackOrders = useMemo(
    () =>
      extractOrderItems(regionFallbackResponse).filter((order) =>
        TODAY_MAIL_ORDER_STATUSES.has(order.status),
      ),
    [regionFallbackResponse],
  );
  const refusedRegionFallbackOrders = useMemo(
    () =>
      extractOrderItems(refusedRegionFallbackResponse).filter((order) =>
        REFUSED_MAIL_ORDER_STATUSES.has(order.status),
      ),
    [refusedRegionFallbackResponse],
  );
  const rawOrders = useMemo<PostOrder[]>(() => {
    // «Hamma batchlar» dan ochilgan tarix — pochta emas, ro'yxat bo'sh (v1 dagidek).
    if (isAllBatchesDetail) {
      return [];
    }

    if (isRefusedDetail) {
      return refusedOrdersFromPost.length > 0
        ? refusedOrdersFromPost
        : refusedRegionFallbackOrders;
    }

    return regularOrdersFromPost.length > 0
      ? regularOrdersFromPost
      : regionFallbackOrders;
  }, [
    isAllBatchesDetail,
    isRefusedDetail,
    refusedOrdersFromPost,
    refusedRegionFallbackOrders,
    regularOrdersFromPost,
    regionFallbackOrders,
  ]);
  const orders = useMemo(
    () =>
      rawOrders.filter((order) => {
        // Tarix (eski) ko'rinishida hamma buyurtma ko'rinadi — shu sahifada
        // qabul qilingan qoldiqlar ham (LC-11), faqat ish rejimida yashiriladi.
        if (!isOldDetail && sentOrderIds.has(order.id)) return false;

        if (
          shouldReceiveCurrentPost &&
          !isEffectiveRefusedDetail &&
          !isOldDetail &&
          order.status !== "on the road"
        ) {
          return false;
        }

        return true;
      }),
    [
      rawOrders,
      sentOrderIds,
      shouldReceiveCurrentPost,
      isEffectiveRefusedDetail,
      isOldDetail,
    ],
  );
  const homeStats = useMemo(() => {
    const homeOrders = orders.filter(
      (order: PostOrder) => order.where_deliver === "address",
    );
    return {
      homeOrders: homeOrders.length,
      homeOrdersTotalPrice: homeOrders.reduce(
        (sum: number, order: PostOrder) => sum + order.total_price,
        0,
      ),
    };
  }, [orders]);
  const centerStats = useMemo(() => {
    const centerOrders = orders.filter(
      (order: PostOrder) => order.where_deliver === "center",
    );
    return {
      centerOrders: centerOrders.length,
      centerOrdersTotalPrice: centerOrders.reduce(
        (sum: number, order: PostOrder) => sum + order.total_price,
        0,
      ),
    };
  }, [orders]);

  // ─── Checkbox state ────────────────────────────────────────────────────────
  const { selectedIds, allSelected, someSelected, toggleAll, toggleOne, selectOne, deselectOne, clearSelection } =
    useMailDetailState(orders);
  // Kamera ro'yxati: skan tartibi (`order:<id>` / `missing:<kod>`) va pochtada yo'q kodlar.
  const { recent: recentScanKeys, touch: touchRecentScan } = useRecentScans();
  const [rejectedCodes, setRejectedCodes] = useState<string[]>([]);
  const hasRefusedOrders = orders.some((order) => REFUSED_MAIL_ORDER_STATUSES.has(order.status));
  const canManualSelectRefusedOrder =
    !isOldDetail &&
    !isReadOnlyRefusedCourier &&
    canReceiveRefusedPost &&
    (isEffectiveRefusedDetail || hasRefusedOrders);

  // ─── Modal state (faqat courier bo'lmaganlar uchun) ────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCheckingCouriers, setIsCheckingCouriers] = useState(false);
  const [branchRecipients, setBranchRecipients] = useState<Branch[]>([]);

  // ─── Receive post hook (faqat courier uchun) ──────────────────────────────
  const receivePost = useReceivePost();
  const receiveCanceledPost = useReceiveCanceledPost();
  const isReceiving = isEffectiveRefusedDetail
    ? receiveCanceledPost.isPending
    : receivePost.isPending;
  // Pochtadan o'chirish (yokjwjXG): faqat superadmin, faqat jo'natilmagan (NEW) pochta.
  const deleteFromPost = useDeleteOrdersFromPost();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState("");
  const postMeta = regularResponse?.data?.post ?? null;
  const postStatus = postMeta?.status ?? null;
  // Holat badge'i: server holati birlamchi; u yo'q, lekin pochta rad etilgan deb aniqlangan bo'lsa — «Rad etilgan».
  // Menejerga jo'natilgan (`sent`) pochta uning qabul ekranida «Yangi» (`manager-mails-detail-receive`, ro'yxatdagidek).
  const isManagerIncoming =
    role === "manager" && !isOldDetail && !isEffectiveRefusedDetail && String(postStatus ?? "").toLowerCase() === "sent";
  const headerStatus = getPostStatusBadge(
    isManagerIncoming ? "new" : (postStatus ?? (isEffectiveRefusedDetail ? "canceled" : null)),
  );
  const canDeleteFromPost =
    role === "superadmin" && !isEffectiveRefusedDetail && !isOldDetail && postStatus === "new";

  // ─── Region nomi ──────────────────────────────────────────────────────────
  // `regionLabel` — aniq viloyat (yo'q bo'lsa `null`); `regionName` — sarlavha uchun, pochta raqami bilan to'ldirilgan.
  const regionLabel = useMemo(
    () =>
      // 4YZcTTDQ: pochtaning o'z viloyati (`data.post.region`) birlamchi — buyurtmalar bo'sh yoki tuman
      // boshqa viloyatga o'tkazilgan bo'lsa ham to'g'ri; qolganlari — eski backend uchun zaxira.
      postMeta?.region?.name ??
      orders[0]?.district?.region?.name ??
      orders[0]?.region?.name ??
      (fallbackRegionName || null),
    [postMeta, orders, fallbackRegionName],
  );
  const regionName =
    regionLabel ??
    (isEffectiveRefusedDetail
      ? t("refusedMailNumber", { id: postId })
      : t("mailNumberWithId", { id: postId }));

  // ─── Region ID (manzil filiallar uchun) ───────────────────────────────────
  // fix3 LC-09: pochtaning o'z viloyati (tuman qayta biriktirilgan bo'lsa ham
  // to'g'ri), birinchi buyurtmaning geografik viloyati EMAS.
  const regionId = useMemo(
    () => resolveDispatchRegionId(postMeta?.region_id || fallbackRegionId, orders),
    [postMeta, fallbackRegionId, orders],
  );

  const selectScannedOrder = useCallback((order: PostOrder) => {
    if (selectedIds.has(order.id)) {
      void playScanFeedback("duplicate", t("common:scannerFeedbackDuplicate"));
      scanNotify.warning(t("common:scannerFeedbackDuplicate"), { description: `#${order.id}`, duration: 2000 });
      return;
    }

    selectOne(order.id);
    touchRecentScan(`order:${order.id}`);
    void playScanFeedback("success", t("detailPage.cameraSelected", { id: order.id }));
    scanNotify.success(t("orderSelected"), { description: `#${order.id}`, duration: 2000 });
  }, [selectOne, selectedIds, t, touchRecentScan]);

  const rejectScannedCode = useCallback((rawValue: string) => {
    const code = extractScannerToken(rawValue) ?? rawValue.trim();
    setRejectedCodes((prev) => (prev.includes(code) ? prev : [...prev, code]));
    touchRecentScan(`missing:${code}`);
    void playScanFeedback("missing", t("detailPage.cameraNotInMail"));
  }, [t, touchRecentScan]);

  const handleMissingScannedOrder = useCallback(async (rawValue: string) => {
    const rawCandidates = normalizeScannerCandidates(rawValue, window.location.origin);

    try {
      const detail = await fetchScanDetail(rawValue);
      const scannedOrder = detail.type === "order" ? unwrapScannedOrder(detail.data) : {};
      const scannedIdentifiers = getOrderIdentifiers(scannedOrder);
      rawCandidates.forEach((candidate) => {
        const text = normalizeMatchText(candidate);
        if (text) scannedIdentifiers.add(text);
      });

      const matchedByIdentifier = orders.find((order) => {
        const orderIdentifiers = getOrderIdentifiers(order);
        return [...scannedIdentifiers].some((identifier) => orderIdentifiers.has(identifier));
      });
      const comparableMatches = matchedByIdentifier
        ? []
        : orders.filter((order) => isSameCustomerMarketOrder(scannedOrder, order));
      const matchedOrder = matchedByIdentifier ?? (comparableMatches.length === 1 ? comparableMatches[0] : undefined);

      if (matchedOrder) {
        selectScannedOrder(matchedOrder);
        return;
      }

      rejectScannedCode(rawValue);
      scanNotify.warning(t("qrNotFound"), { description: t("mailScanMissing"), duration: 3000 });
    } catch (error) {
      // Server ham tanimadi (404) — bu pochtada yo'q kod (ro'yxatda «rad etildi»); boshqa xato — tekshirib bo'lmadi.
      if (getErrorStatus(error) === 404) {
        rejectScannedCode(rawValue);
        scanNotify.warning(t("qrNotFound"), { description: t("mailScanMissing"), duration: 3000 });
        return;
      }
      const message = getBackendErrorMessage(error) ?? t("mailScanMissing");
      void playScanFeedback("error", message);
      // Skaner oqimi: xato qisqa turadi (v1 dagidek 3 s) — keyingi skanerlashda ekran to'silib qolmasin.
      scanNotify.error(t("qrNotFound"), {
        description: message,
        duration: 3000,
      });
    }
  }, [orders, rejectScannedCode, selectScannedOrder, t]);

  const scannerEnabled = orders.length > 0 && !isOldDetail && !isReadOnlyRefusedCourier;
  // Kamera — faqat amal bor rejimda (jo'natish, qabul, rad etilganni qabul): aks holda markaziy tugma `/scan`.
  const cameraEnabled = !isOldDetail && !isReadOnlyRefusedCourier && canShowActionButton;
  const cameraMode = isEffectiveRefusedDetail ? "refused" : shouldReceiveCurrentPost ? "receive" : "send";
  const cameraList = useMemo<ScanTargetListItem[]>(() => {
    const selectedItems = orders
      .filter((order) => selectedIds.has(order.id))
      .map<{ key: string; item: ScanTargetListItem }>((order) => ({
        key: `order:${order.id}`,
        item: {
          key: `order:${order.id}`,
          title: [`№${order.id}`, order.customer?.name?.trim()].filter(Boolean).join(" · "),
          subtitle: [order.district?.name?.trim(), formatMoneyLocalized(Number(order.total_price) || 0, { language })]
            .filter(Boolean)
            .join(" · "),
          tone: "success",
          onUndo: () => deselectOne(order.id),
        },
      }));
    const rejectedItems = rejectedCodes.map<{ key: string; item: ScanTargetListItem }>((code) => ({
      key: `missing:${code}`,
      item: {
        key: `missing:${code}`,
        title: t("detailPage.cameraRejectedTitle", { code }),
        subtitle: t("detailPage.cameraRejectedText"),
        tone: "danger",
      },
    }));
    return orderByRecent([...selectedItems, ...rejectedItems], (entry) => entry.key, recentScanKeys).map(
      (entry) => entry.item,
    );
  }, [deselectOne, language, orders, recentScanKeys, rejectedCodes, selectedIds, t]);
  const cameraContext = [
    postId ? t("mailNumberWithId", { id: postMeta?.id ?? postId }) : null,
    regionLabel,
  ]
    .filter(Boolean)
    .join(" · ");
  useOrderQrScanner({
    orders,
    enabled: !isOldDetail && !isReadOnlyRefusedCourier,
    onMatch: selectScannedOrder,
    onMissing: (rawValue) => {
      void handleMissingScannedOrder(rawValue);
    },
    camera: cameraEnabled
      ? {
          id: `mail:${postId}:${cameraMode}`,
          title: t(`detailPage.cameraTitle.${cameraMode}`),
          context: cameraContext || undefined,
          note: { title: t("detailPage.cameraNoteTitle"), text: t("detailPage.cameraNoteText") },
          progress: { done: selectedIds.size, total: orders.length, label: t("detailPage.cameraMeter") },
          list: cameraList,
          listTitle: t("detailPage.cameraListTitle"),
          finish: { label: t("ui:camera.action.finish"), onFinish: () => undefined },
        }
      : undefined,
  });

  const handleBack = useCallback(() => {
    navigate(`${getMailTabPath(normalizeMailTab(fromTab))}${fromSearch}`);
  }, [fromSearch, fromTab, navigate]);

  // ─── Pochtani qabul qilish (kuryer, menejer, rad etilgan pochta) ─────────
  const handleReceive = useCallback(() => {
    if (selectedIds.size === 0 || !postId) return;
    const receivedIds = Array.from(selectedIds);
    const hideReceived = (ids: string[]) => {
      if (ids.length === 0) return;
      setSentOrderIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
    };

    if (isEffectiveRefusedDetail) {
      apiRequest({
        request: () =>
          receiveCanceledPost.mutateAsync({
            postId,
            payload: { order_ids: receivedIds },
          }),
        successMessage: t("receiveRefusedSuccess"),
        errorMessage: t("receiveRefusedError"),
        onSuccess: () => {
          hideReceived(receivedIds);
          clearSelection();
          void refetchRegularDetail();
        },
      });
      return;
    }

    /**
     * fix3b LC-11: backend tanlangan, lekin WAITING ga o'tmagan buyurtmalarni
     * `not_received_order_ids` da qaytaradi. Ular "qabul qilindi" deb
     * yashirilmaydi — ro'yxatda qoladi va ogohlantirishda sanab o'tiladi.
     */
    void receivePost
      .mutateAsync({ postId, payload: { order_ids: receivedIds } })
      .then((response) => {
        const notReceivedIds = extractNotReceivedOrderIds(response);
        const notReceivedSet = new Set(notReceivedIds);
        const acceptedIds = receivedIds.filter((id) => !notReceivedSet.has(id));

        if (acceptedIds.length > 0) {
          notify.success(t("common:success"), {
            description: notReceivedIds.length
              ? t("receivePartialSuccess", { count: acceptedIds.length })
              : t("receiveSuccess"),
          });
        }
        if (notReceivedIds.length > 0) {
          notify.warning(t("receiveNotReceivedTitle", { count: notReceivedIds.length }), {
            description: t("receiveNotReceivedDescription", {
              ids: notReceivedIds.map((id) => `#${id}`).join(", "),
            }),
            duration: 10000,
          });
        }

        hideReceived(acceptedIds);
        clearSelection();
        void refetchRegularDetail();
      })
      .catch((error: unknown) => {
        notify.error(t("common:error"), { description: getBackendErrorMessage(error) ?? t("receiveError") });
      });
  }, [
    selectedIds,
    postId,
    isEffectiveRefusedDetail,
    receiveCanceledPost,
    receivePost,
    apiRequest,
    clearSelection,
    refetchRegularDetail,
    t,
  ]);

  // ─── Muvaffaqiyatli yuborilgandan keyin ───────────────────────────────────
  const handleSendSuccess = useCallback(async (sentIds: string[] = Array.from(selectedIds)) => {
    setSentOrderIds((prev) => {
      const next = new Set(prev);
      sentIds.forEach((id) => next.add(id));
      return next;
    });
    clearSelection();
    const refreshed = await refetchRegularDetail();
    const remainingOrders =
      refreshed.data?.data?.allOrdersByPostId?.filter(
        (order) => !sentIds.includes(order.id),
      ).length ?? 0;

    if (remainingOrders === 0) {
      navigate(getMailTabPath("today"));
    }
  }, [clearSelection, navigate, refetchRegularDetail, selectedIds]);

  // ─── «Filialni tanlang» oynasini ochish (jo'natish) ───────────────────────
  const handleSend = useCallback(() => {
    if (selectedIds.size === 0 || !postId || !regionId || isCheckingCouriers) return;

    setIsCheckingCouriers(true);

    // Manzil filiallar (faol REGIONAL/HYBRID, menejeri bilan) bitta so'rovda.
    // Avvalgi GET /branches + GET /managers faqat superadmin/admin uchun edi —
    // HQ registratori 403 olardi.
    getDispatchDestinations({ region_id: String(regionId) })
      .then((response) => {
        // Himoya: backend filtrlaydi, lekin viloyat va faollik shu yerda ham tekshiriladi.
        const branches = (response?.data ?? []).filter(
          (branch) => String(branch.region?.id ?? "") === String(regionId) && branch.status === "active",
        );

        if (branches.length === 0) {
          notify.error(t("common:error"), { description: t("noActiveBranchInRegion") });
          return;
        }

        setBranchRecipients(branches);
        setIsModalOpen(true);
      })
      .catch((error: unknown) => {
        // 403 va boshqa rad javoblarda backend xabari ko'rinadi.
        notify.error(t("common:error"), {
          description: getBackendErrorMessage(error) ?? t("branchesLoadError"),
        });
      })
      .finally(() => {
        setIsCheckingCouriers(false);
      });
  }, [selectedIds, postId, regionId, isCheckingCouriers, t]);

  const selectedOrders = useMemo(
    () => orders.filter((order: PostOrder) => selectedIds.has(order.id)),
    [orders, selectedIds],
  );
  const printOptions = useMailPrintOptions();

  const handlePrintOrders = useCallback((mode: PrintMode, printTargets: PostOrder[]) => {
    if (printTargets.length === 0) return;
    printOrders(mode, printTargets);
  }, []);

  const handlePrint = useCallback(
    (mode: PrintMode) => {
      handlePrintOrders(mode, selectedOrders);
    },
    [handlePrintOrders, selectedOrders],
  );

  // D16: kuryerning rad etilgan pochtasida tanlov yo'q — «Barchasini chop etish» hamma buyurtmani oladi.
  const handlePrintAll = useCallback(
    (mode: PrintMode) => {
      handlePrintOrders(mode, orders);
    },
    [handlePrintOrders, orders],
  );

  const handlePrintOne = useCallback(
    (order: PostOrder, mode: PrintMode) => {
      handlePrintOrders(mode, [order]);
    },
    [handlePrintOrders],
  );

  const openDeleteConfirm = useCallback((orderIds: string[]) => {
    if (orderIds.length === 0) return;
    setDeleteTargetIds(orderIds);
    setDeleteError("");
    setIsDeleteConfirmOpen(true);
  }, []);

  const handleDeleteOne = useCallback((orderId: string) => openDeleteConfirm([orderId]), [openDeleteConfirm]);

  const closeDeleteConfirm = useCallback(() => {
    setIsDeleteConfirmOpen(false);
    setDeleteTargetIds([]);
    setDeleteError("");
  }, []);

  /**
   * `POST /post/delete` — yo hammasi, yo hech biri. Rad etilsa (409: pochta
   * jo'natilgan, buyurtma kuryerda …) sabab oynada qoladi.
   */
  const handleDeleteFromPost = useCallback(
    async (reason: string) => {
      if (!postId || deleteTargetIds.length === 0) return;
      setDeleteError("");
      try {
        const result = await deleteFromPost.mutateAsync({ post_id: postId, order_ids: deleteTargetIds, reason });
        closeDeleteConfirm();
        clearSelection();
        if (result.deleted.length > 0) {
          notify.success(t("deleteFromPostSuccess", { count: result.deleted.length }), {
            description: result.skipped.length > 0 ? t("deleteFromPostSkipped", { count: result.skipped.length }) : undefined,
          });
        } else {
          // Backend hech narsani o'chirmadi — "o'chirildi" deyish yolg'on bo'lardi.
          notify.warning(t("deleteFromPostNothing"), {
            description: result.skipped.length > 0 ? t("deleteFromPostSkipped", { count: result.skipped.length }) : undefined,
          });
        }
        if (result.post_deleted) {
          notify.info(t("deleteFromPostEmptied"));
          navigate(getMailTabPath("today"));
          return;
        }
        await refetchRegularDetail();
      } catch (error) {
        setDeleteError(getBackendErrorMessage(error) ?? t("deleteFromPostFailed"));
      }
    },
    [postId, deleteTargetIds, deleteFromPost, closeDeleteConfirm, clearSelection, t, navigate, refetchRegularDetail],
  );

  const count = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);

  // ─── Yuklanish ────────────────────────────────────────────────────────────
  if (regularLoading || refusedLoading || regionFallbackLoading || refusedRegionFallbackLoading)
    return <MailDetailSkeleton />;

  // ─── Xato ─────────────────────────────────────────────────────────────────
  if (regularError || refusedError)
    return (
      <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
        <PageHeader
          back={handleBack}
          backLabel={t(MAIL_TAB_LABEL_KEYS[normalizeMailTab(fromTab)])}
          title={t("mailNumberWithId", { id: postId })}
        />
        <ErrorState
          framed
          error={regularErrorValue ?? refusedQuery.error}
          title={t("loadError")}
          onRetry={() => {
            if (regularError) void refetchRegularDetail();
            if (refusedError) void refusedQuery.refetch?.();
          }}
        />
      </div>
    );

  // ─── Sarlavha (dizayn v2) ─────────────────────────────────────────────────
  // Holat birlamchi manbasi — serverdagi `data.post` (4YZcTTDQ). Maketlar rolga qarab:
  //  - superadmin/admin/registrator (`*-mails-detail`, `-refused`, `-old`): viloyat sarlavhasi,
  //    holat badge'i, eski pochtada «Faqat o'qish», izohda «Pochta №… · N ta buyurtma»;
  //  - kuryer (`courier-mails-detail-*`): badge yo'q, rad etilganda izoh oldida qizil ikonka,
  //    rad etilgan / eski pochtada «N ta rad etilgan buyurtma» / «N ta buyurtma»;
  //  - menejer (`manager-mails-detail-receive`, `-refused-receive`): sarlavhada pochta raqami,
  //    izohda viloyat va sana; eski pochtasi — adminniki kabi (`admin-mails-old-detail`).
  const mailNumber = postId ? t("mailNumberWithId", { id: postMeta?.id ?? postId }) : null;
  const isManagerHeader = role === "manager" && !isOldDetail && Boolean(mailNumber);
  const ordersCountText = isCourier && isOldDetail
    ? t("headerOrdersCount", { count: orders.length })
    : isOldDetail
      ? t("oldOrdersCount", { count: orders.length })
      : isManagerHeader || (isCourier && isEffectiveRefusedDetail)
        ? t(isEffectiveRefusedDetail ? "headerRefusedOrdersCount" : "headerOrdersCount", { count: orders.length })
        : isEffectiveRefusedDetail
          ? t("refusedOrdersCount", { count: orders.length })
          : t("ordersCount", { count: orders.length });
  const headerParts = (
    isManagerHeader
      ? [
          regionLabel,
          postMeta?.createdAt ? formatDateTimeLocalized(postMeta.createdAt, { language: i18n.language }) : null,
          ordersCountText,
        ]
      : [mailNumber, ordersCountText]
  ).filter((part): part is string => Boolean(part));
  const showStatusBadge = !isCourier && headerStatus !== null;
  const showReadOnlyBadge = !isCourier && isOldDetail;

  // ─── Rejimlar (maket) ─────────────────────────────────────────────────────
  const isManager = role === "manager";
  const isCourierHistory = isCourier && (isOldDetail || isReadOnlyRefusedCourier);
  const showPrimaryAction = orders.length > 0 && !isOldDetail && !isReadOnlyRefusedCourier && canShowActionButton;
  const primaryIsReceive = shouldReceiveCurrentPost || isEffectiveRefusedDetail;
  const selectedCount = selectedIds.size;
  const selectedValue = count(selectedCount);
  const totalSum = orders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0);
  const selectedSum = selectedOrders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0);

  const primaryButton = showPrimaryAction ? (
    <SendButton
      selectedCount={selectedCount}
      isCourier={shouldReceiveCurrentPost}
      mode={isEffectiveRefusedDetail ? "receive" : "send"}
      onSend={handleSend}
      onReceive={handleReceive}
      disabled={isEffectiveRefusedDetail && !canReceiveRefusedPost}
      isBusy={primaryIsReceive ? isReceiving : isCheckingCouriers}
      block={isCourier && isPhone}
    />
  ) : null;

  // Chop etish: tanlanganlar (menyu; telefonda pastki varaqa). Kuryerning rad etilgan pochtasida — barchasi.
  const renderPrintSelected = (className?: string, compact = false) => (
    <PrintModeSelect
      count={selectedCount}
      onSelect={(mode) => handlePrint(mode as PrintMode)}
      buttonLabel={t("print")}
      ariaLabel={isCourier ? t("detailPage.printSelectedLabel", { value: selectedValue, count: selectedCount }) : undefined}
      menuLabel={t("detailPage.printMenuLabel")}
      menuTitle={t(isCourier ? "detailPage.printMenuTitleLabels" : "detailPage.printMenuTitle", {
        value: selectedValue,
        count: selectedCount,
      })}
      sheetTitle={t("detailPage.printSheetTitle")}
      sheetDescription={t("detailPage.printSheetDescription", { value: selectedValue, count: selectedCount })}
      options={printOptions}
      className={className}
      compact={compact}
    />
  );
  const printAll = (
    <PrintModeSelect
      count={orders.length}
      hideCount
      onSelect={(mode) => handlePrintAll(mode as PrintMode)}
      buttonLabel={t("detailPage.printAll")}
      ariaLabel={t("detailPage.printAllLabel", { value: count(orders.length), count: orders.length })}
      menuLabel={t("detailPage.printMenuLabel")}
      menuTitle={t("detailPage.printAllMenuTitle", { value: count(orders.length), count: orders.length })}
      sheetTitle={t("detailPage.printSheetTitle")}
      sheetDescription={t("detailPage.printAllSheetDescription", { value: count(orders.length), count: orders.length })}
      options={printOptions}
      className="w-full"
    />
  );

  // Sarlavha amallari: telefonda kuryer uchun yo'q (chop etish — kartada, qabul — pastki panelda).
  const headerActions = isOldDetail
    ? null
    : isReadOnlyRefusedCourier
      ? isPhone || orders.length === 0
        ? null
        : printAll
      : isCourier && isPhone
        ? null
        : (
            <div className="flex flex-wrap items-center gap-2 max-md:w-full max-md:flex-col max-md:items-stretch">
              {renderPrintSelected("max-md:w-full")}
              {primaryButton}
            </div>
          );

  // Karta: sarlavha, skaner izohi va tanlov izohi rejimga qarab (maketlar).
  const ordersTitle =
    isCourier && !isEffectiveRefusedDetail && !isCourierHistory ? t("detailPage.onTheRoadTitle") : undefined;
  const ordersAria = isOldDetail
    ? t("detailPage.oldOrdersAria")
    : isEffectiveRefusedDetail
      ? t("detailPage.refusedOrdersAria")
      : undefined;
  const scanHint =
    scannerEnabled && !isEffectiveRefusedDetail
      ? t(isCourier ? "detailPage.scanHintCourier" : isManager ? "detailPage.scanHintManager" : "detailPage.scanHintStaff")
      : undefined;
  const selectionHint = isEffectiveRefusedDetail
    ? t("detailPage.selectionHintRefused")
    : isCourier
      ? t("detailPage.selectionHintReceiveShort")
      : shouldReceiveCurrentPost
        ? t("detailPage.selectionHintReceive")
        : t("detailPage.selectionHintSend");
  const tableColumns = isCourier
    ? isOldDetail
      ? COURIER_HISTORY_COLUMNS
      : COURIER_COLUMNS
    : isManager && !isOldDetail
      ? MANAGER_COLUMNS
      : undefined;
  const tabletHidden = isCourier ? COURIER_TABLET_HIDDEN : isManager && !isOldDetail ? MANAGER_TABLET_HIDDEN : undefined;
  const readOnlyBadge = isCourierHistory ? (
    <Badge icon={Lock}>{t("detailPage.readOnly")}</Badge>
  ) : null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        back={handleBack}
        backLabel={t(MAIL_TAB_LABEL_KEYS[normalizeMailTab(fromTab)])}
        title={isManagerHeader ? mailNumber : t("regionOrdersTitle", { region: regionName })}
        meta={
          showStatusBadge || showReadOnlyBadge ? (
            <>
              {showStatusBadge && headerStatus ? (
                <StatusBadge data-testid="mail-post-status" tone={headerStatus.tone} label={t(headerStatus.labelKey)} />
              ) : null}
              {showReadOnlyBadge ? (
                <Badge data-testid="mail-read-only" icon={Lock}>
                  {t("readOnlyBadge")}
                </Badge>
              ) : null}
            </>
          ) : null
        }
        description={
          <span data-testid="mail-detail-sub">
            {isCourier && isEffectiveRefusedDetail ? (
              <CircleX size={14} aria-hidden="true" className="mr-1.5 inline-block align-[-2px] text-danger-fg" />
            ) : null}
            {headerParts.map((part, index) => (
              <Fragment key={index}>
                {index > 0 ? " · " : null}
                <span className="whitespace-nowrap">{part}</span>
              </Fragment>
            ))}
          </span>
        }
        actions={headerActions}
      />

      {canManualSelectRefusedOrder ? (
        <DetailAlert tone="info" icon={Info} role="note" title={t("detailPage.refusedAlertTitle")} titleBlock>
          {t("detailPage.refusedAlertText")}
        </DetailAlert>
      ) : null}

      {hasStuckOnTheRoadOrders && orders.length > 0 ? (
        <DetailAlert
          tone="warning"
          icon={TriangleAlert}
          role="note"
          titleBlock
          title={t("detailPage.leftoversTitle", { value: count(orders.length), count: orders.length })}
        >
          <span className="text-[13px]">{t("detailPage.leftoversText")}</span>
        </DetailAlert>
      ) : null}

      <MailStatCards
        totalOrders={orders.length}
        selectedCount={selectedCount}
        homeStats={homeStats}
        centerStats={centerStats}
        showSelectionCard={!isOldDetail && !isReadOnlyRefusedCourier}
        layout={isCourier ? "courier" : "staff"}
        leadCard={isCourier ? (isOldDetail ? "total" : isReadOnlyRefusedCourier ? "refused" : "selected") : undefined}
        selectedSum={selectedSum}
        totalSum={totalSum}
      />

      <OrdersTable
        orders={orders}
        selectedIds={selectedIds}
        allSelected={allSelected}
        someSelected={someSelected}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
        onClearSelection={clearSelection}
        onPrintOne={isOldDetail ? undefined : handlePrintOne}
        onDeleteOne={handleDeleteOne}
        // yokjwjXG: savat = buyurtmani SHU pochtadan o'chirish (`POST /post/delete`),
        // `POST /post/cancel` (bekor qilinganlarni qaytarish) EMAS. Faqat
        // superadmin va jo'natilmagan (NEW) pochtada — backend bilan bir xil.
        canDelete={canDeleteFromPost}
        variant={isOldDetail ? "history" : "default"}
        readOnly={isOldDetail || isReadOnlyRefusedCourier}
        title={ordersTitle}
        ariaLabel={ordersAria}
        headerExtra={readOnlyBadge}
        scanHint={scanHint}
        scannerReady={scannerEnabled && (!isEffectiveRefusedDetail || isManager)}
        scannerReadyLabel={isEffectiveRefusedDetail ? t("detailPage.scannerReadyShort") : undefined}
        selectionHint={selectionHint}
        columns={tableColumns}
        tabletHidden={tabletHidden}
        orderHref={isCourier ? null : undefined}
        sortable={isCourier}
        cardVariant={isCourier ? "courier" : "default"}
        notice={
          isReadOnlyRefusedCourier ? (
            <>
              <Info aria-hidden="true" size={16} className="shrink-0 text-text-subtle" />
              <span className="min-w-0">{t("detailPage.courierRefusedNote")}</span>
            </>
          ) : undefined
        }
        phoneHeaderAction={isReadOnlyRefusedCourier && isPhone && orders.length > 0 ? printAll : undefined}
        phoneSelectionAction={isCourier && isPhone ? renderPrintSelected("shrink-0", true) : undefined}
        printLabel={isCourier ? (order) => t("detailPage.printRowLabel", { id: order.id }) : undefined}
      />

      {/* Tanlanganlarni pochtadan o'chirish (superadmin, NEW pochta). */}
      {canDeleteFromPost && selectedCount > 0 ? (
        <div
          data-testid="mail-delete-selected"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-border bg-surface px-5 py-3 max-md:px-4"
        >
          <span className="text-sm font-semibold text-text">
            {t("selectedCountLabel", { count: selectedCount })}
          </span>
          <Button
            variant="danger-soft"
            leftIcon={Trash2}
            aria-haspopup="dialog"
            onClick={() => openDeleteConfirm(Array.from(selectedIds))}
            className="max-md:w-full"
          >
            {t("deleteSelectedFromPost")}
          </Button>
        </div>
      ) : null}

      {/* Kuryer telefoni: «Pochtani qabul qilish — n ta» pastki menyu ustidagi panelda (maket `courier-mails-detail-receive`). */}
      {isCourier && isPhone && primaryButton ? (
        <>
          <div aria-hidden="true" className="h-[72px] shrink-0" />
          <div className="fixed inset-x-0 bottom-[var(--shell-bottomnav-h)] z-30 border-t border-border bg-surface px-4 py-3">
            {primaryButton}
          </div>
        </>
      ) : null}

      {/* Pochta jo'natish oynasi — filial tanlash */}
      {canDispatchToBranch && !isCourierLikeReceiver && !isEffectiveRefusedDetail && !isOldDetail && (
        <SendPostModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          postId={postId ?? ""}
          branches={branchRecipients}
          selectedIds={selectedIds}
          onSuccess={handleSendSuccess}
          regionName={regionLabel}
        />
      )}

      <DeleteFromPostDialog
        open={isDeleteConfirmOpen}
        count={deleteTargetIds.length}
        pending={deleteFromPost.isPending}
        error={deleteError}
        onCancel={closeDeleteConfirm}
        onConfirm={(reason) => void handleDeleteFromPost(reason)}
      />
    </div>
  );
};

export default memo(MailDetailPage);
