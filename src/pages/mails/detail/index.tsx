// dizayn-v2: superadmin-mails-detail, superadmin-mails-detail-duplicates, superadmin-mails-detail-search, superadmin-mails-detail-search-empty, admin-mails-detail-duplicates, admin-mails-detail-search, admin-mails-detail-search-empty, registrator-mails-detail-duplicates, registrator-mails-detail-search, registrator-mails-detail-search-empty, manager-mails-detail-receive-duplicates, manager-mails-detail-receive-search, manager-mails-detail-receive-search-empty, superadmin-mails-detail-send-dialog, superadmin-mails-detail-refused, superadmin-mails-detail-old, admin-mails-detail, admin-mails-send-branch-dialog, admin-mails-refused-detail, admin-mails-old-detail, manager-mails-detail-receive, manager-mails-detail-refused-receive, manager-mails-detail-old, registrator-mails-detail, registrator-mails-detail-send-dialog, registrator-mails-detail-refused, registrator-mails-detail-old, courier-mails-detail-receive, courier-mails-detail-refused, courier-mails-detail-old, courier-mails-detail-print-menu
import { Fragment, memo, useDeferredValue, useEffect, useMemo, useCallback, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useIsMutating, useMutationState, useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, CircleX, Info, Lock, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  useDeleteOrdersFromPost,
  useMails,
  useMailDetail,
  type CanceledPostActionResult,
  type PostOrder,
  type RequestOrderReturnResult,
  useReceiveCanceledPost,
  useReceivePost,
  useRequestOrderReturn,
  useReturnCanceledOrders,
} from "../../../entities/mails";
import { isHistoryView, isInPostNow } from "../../../entities/mails/lib/postHistory";
import type { RootState } from "../../../app/config/store";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import { canDispatchPostToBranch, canReassignPostToBranch } from "../../../app/lib/access";
import { getDispatchDestinations, type Branch } from "../../../entities/branch";
import { readBackendRejection } from "../../../shared/lib/backendReason";
import { coverageErrorLine, coverageRejectionText, readQrScopeText } from "../../../shared/lib/coverageReasons";
import { getCurrentBranchId } from "../../../shared/lib/currentBranch";
import {
  countReceiptsWithoutQr,
  preloadReceiptPrinting,
  receiptPackageWithoutQr,
  useReceiptPrint,
} from "../../../features/print-receipts";
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
  useConfirm,
} from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import { DetailAlert } from "../../new_orders/components/detail/DetailAlert";
import { extractScannerToken, normalizeScannerCandidates } from "../../../shared/lib/scanToken";
import { playScanFeedback } from "../../../shared/lib/scanner/feedback";
import { orderByRecent, scanNotify, useRecentScans } from "../../../shared/lib/scanner/scanSession";
import type { ScanSource, ScanTargetListItem } from "../../../shared/lib/scanner/scanTargets";
import { fetchScanDetail, getBackendErrorMessage } from "../../scan/lib/scanResource";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { getMailTabPath, normalizeMailTab, type MailTab } from "../lib/navigation";

// ─── UI komponentlar ──────────────────────────────────────────────────────────
import MailStatCards from "./ui/MailStatCards";
import OrdersTable, { type OrdersTableColumn } from "./ui/OrdersTable";
import SendButton from "./ui/SendButton";
import SendPostModal from "./ui/SendPostModal";
import TransferPostBranchModal from "./ui/TransferPostBranchModal";
import DeleteFromPostDialog from "./ui/DeleteFromPostDialog";
import { DuplicatePhonesAlert } from "./ui/DuplicatePhonesAlert";
import { useMailPrintOptions } from "./ui/printOptions";
import { getPostStatusBadge } from "./lib/postStatus";
import {
  postTotalsFromOrders,
  printOrders,
  printPostReceipt,
  toPostReceiptSource,
  type OrderPrintMode,
  type PostTotals,
  type PrintMode,
} from "./lib/printMode";
import { resolveDispatchRegionId } from "./lib/dispatchRegion";
import {
  extractNotReceivedOrderIds,
  hasOnTheRoadOrders,
  isScanReceivableStatus,
  readScanReceiveOutcome,
} from "./lib/receiveResult";
import {
  duplicateSiblings,
  filterMailOrders,
  findDuplicatePhones,
  isPhoneQuery,
  looksLikeTypedSearch,
  valueBeforeScan,
  type DuplicatePhoneGroup,
  type SearchEdit,
} from "./lib/mailSearch";
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
import { resolveReceiveAccess } from "./model/receiveAccess";

/**
 * POCHTA TAFSILOTI — `/mails/:id` (dizayn v2, sahifa shell ichida).
 *
 * Rejim rol va URL/holatdan (`?type=refused`, `?view=old`, `?view=old-all-batches`; URL tozalanib holatda saqlanadi):
 *  - jo'natish (superadmin/admin/HQ registratori) — «Pochtani jo'natish — n ta» → «Filialni tanlang» oynasi;
 *  - qabul (kuryer, filial menejeri) — faqat yo'ldagi buyurtmalar, «Pochtani qabul qilish — n ta»;
 *    kuryer telefonida tugma pastki menyu ustidagi panelda;
 *  - rad etilgan pochtani qabul qilish — info ogohlantirish, `POST post/cancel/receive/:id`;
 *    HQ qabul qiluvchisi (admin, superadmin, HQ menejeri / registratori): faqat tanlanganlar qabul qilinadi,
 *    qolganlari shu pochtada qoladi (hech narsa o'zi qaytmaydi); pochtani filial jo'natgan bo'lsa — ikkinchi amal
 *    «Filialga qaytarish» (tasdiq oynasi, `POST post/cancel/return/:id`). Pochtada buyurtma qolmasa — yopiladi,
 *    sahifa kelingan ro'yxatga qaytadi. Filial menejeri (kuryer pochtasini qabul qilish) — avvalgidek;
 *  - kuryerning jo'natilgan (`sent`) pochtasi — har yo'ldagi qatorda «Kelmagan — qaytarish» (telefonda kartaning
 *    ostida «Bu buyurtma kelmagan — qaytarish so'rovi», BeePost kabi; ega qarori 2026-11-03): tasdiq oynasi →
 *    `POST post/:id/orders/:orderId/return-request`, qator ro'yxatdan chiqadi, so'rov «Qaytarish»ga tushadi;
 *    qabul qilinadigan buyurtma qolmasa — kelingan ro'yxatga qaytiladi. So'rovi bor buyurtmalar qabul
 *    qilinadiganlar ro'yxatida (tanlov, son, skaner) yo'q — karta izohida sanaladi; ularning QR'i skanerlansa,
 *    buyurtma ro'yxatga qaytib tanlanadi (qabul qilinsa so'rov bekor bo'ladi — backend);
 *  - filial menejeri, o'z filialiga jo'natilgan (`sent`) o'tkazma pochtasi (kuryersiz, `post.branch_id` — menejer
 *    filiali; ega qarori 2026-11-04) — kuryerdagidek «Kelmagan — qaytarish», xuddi shu so'rov va oqim;
 *  - kuryerning rad etilgan pochtasi — faqat o'qish, «Barchasini chop etish»;
 *  - eski pochta (tarix) — faqat o'qish; qolib ketgan yo'ldagi buyurtma bo'lsa qabul qayta ochiladi (fix3b).
 *
 * SKAN = DARHOL QABUL (2026-11-07, BeePost kabi; ega: «skaner qilsa ptichka belgilanishi kerak emas — buyurtma qabul
 * bo'lib ro'yxatdan yo'qolsin»): pochtaning qabul qiluvchisi — kuryer (o'z pochtasi) yoki menejer (o'z filialiga
 * kuryersiz o'tkazma pochtasi) — `sent` pochtada yoki eski pochtadagi yo'ldagi qoldiqda (`view=old`) QR skanerlasa,
 * buyurtma tanlanmaydi: `PATCH post/receive/:id {order_ids: [id], scan: true}` — faqat shu buyurtma qabul qilinadi,
 * qolgan yo'ldagilarga tegilmaydi. Optimistik: ovoz va «№id qabul qilindi · N ta qoldi» darhol, qator yashiriladi
 * (muvaffaqiyatda qaytmaydi); xato — qator qaytadi, «qayta skanerlang». So'rovlar bitta navbatda (mutation `scope`,
 * sahifadan chiqilsa ham yuboriladi); navbat bo'sh bo'lmaguncha «Pochtani qabul qilish», «Kelmagan — qaytarish» va
 * avtomatik orqaga qaytish o'chiq. Faqat aniq moslik (id / QR token / skan javobidagi id) — «o'xshash» moslik yo'q.
 * Pochta to'liq qabul qilinsa — «Pochta to'liq qabul qilindi» va ~1.5 s dan keyin kelingan ro'yxatga. Qo'lda belgilash
 * va tugma (tanlanmaganlar qaytarishga) qoladi. Jo'natish, rad etilgan pochta, begona pochta — skan avvalgidek tanlaydi.
 *
 * POCHTA TARIXI (backend #618, vaICniE4): `GET post/orders/:id` qabul qilingan pochtaga (`received`,
 * `canceled_received`) sukut bo'yicha `view=all` beradi — pochtaga har qachon kirgan buyurtmalar (`in_post_now`).
 * Amal rejimlari (jo'natish, qabul, rad etilgan, eski holatsiz havola yoki skan — buyurtma sahifasidagi «Pochta»,
 * skanerdagi «Pochtani ochish») aniq `view=current` so'raydi va faqat hozir pochtadagi qatorlar bilan ishlaydi
 * (son, tanlov, skaner, qabul / jo'natish); eski pochta (tarix) — server sukuti. Qolib ketgan qabul faqat qabul
 * qiluvchiga qayta ochiladi: kuryerga — o'z pochtasida, menejerga — filial o'tkazmasi pochtasida (`courier_id` yo'q
 * yoki `'0'`); menejer o'z kuryerining qabul qilingan pochtasini endi ko'radi, lekin uni qabul qilmaydi.
 *
 * Tuzilma: `PageHeader` (orqaga — kelingan tab, holat badge'i, chop etish + bitta asosiy amal) → ogohlantirishlar →
 * `MailStatCards` → `OrdersTable` (skaner izohi, tanlov paneli, jadval / telefonda kartalar). USB (HID) skaner —
 * `useOrderQrScanner`.
 *
 * KAMERA (Trello v1eLN2tV 2-bosqich; maketlar `superadmin-mails-detail-camera`, `registrator-mails-detail-camera`,
 * `manager-mails-detail-receive-camera`, `courier-mails-detail-receive-camera`; rad etilgan pochta — maket yo'q,
 * eng yaqini `manager-mails-detail-receive-camera`): sahifada kamera tugmasi yo'q — markaziy «Skaner» (desktopda
 * «Skanerlash») shu sahifaning maqsadini ochadi. Kamera skani USB bilan aynan bir yo'l: jo'natish va rad etilgan pochtada
 * buyurtma faqat tanlanadi (amal — sahifadagi asosiy tugma), qabul qiluvchining skan-qabul rejimida (yuqorida) — darhol
 * qabul qilinadi («ta qabul qilindi» hisoblagichi). Pochtada yo'q kod ro'yxatda «Bu pochtada yo'q · rad etildi».
 * Eski pochta, kuryerning rad etilgan pochtasi va amalsiz rejimda kamera maqsadi yo'q (markaziy tugma — `/scan`).
 *
 * QIDIRUV VA TAKRORIY TELEFONLAR (MD-1, ega S1–S4; maketlar `*-mails-detail-search`, `-search-empty`,
 * `-duplicates`, menejerda `manager-mails-detail-receive-*`) — xodim jo'natish rejimida (superadmin, admin,
 * registrator) va menejer qabul rejimida. Rad etilgan pochtada (HQ va filial qabuli) — faqat qidiruv, takroriy
 * telefonlar bannerisiz (ega qarori 2026-11-09; maket yo'q — eng yaqini `admin-mails-detail-search`). Qidiruv
 * matni URL'da (`?q=`, `replace`, `location.state` saqlanadi), tanlov butun ro'yxatda qoladi; takroriy raqam banneri faqat ogohlantiradi. Maydon mahalliy qoralamaga bog'langan
 * (URL kechikib yoziladi). USB skaner qidiruv maydoni fokusda bo'lganda tokenni maydonga ham yozadi — skandan keyin
 * oldingi `q` tiklanadi (`valueBeforeScan`); shu pochtada topiladigan matn esa skan emas, qidiruv
 * (`looksLikeTypedSearch`).
 */

/** Qidiruv matni URL'ga (`?q=`) shuncha kutib yoziladi (har harfda `history.replaceState` emas). */
const MAIL_QUERY_DEBOUNCE_MS = 250;

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

/** Skan-qabul: pochta to'liq qabul qilingach kelingan ro'yxatga shuncha kutib qaytiladi (BeePost kabi). */
const SCAN_RECEIVE_DONE_BACK_MS = 1500;

/** Skan-qabul jurnalidagi yozuv: buyurtma (ro'yxatdan yashirilgan bo'lsa ham kamera ro'yxati uchun) va holat. */
type ScanReceiveLogEntry = { order: PostOrder; status: "pending" | "received" | "failed" };

/** Navbatdagi skan-qabul so'rovining buyurtmalari (`useMutationState` — sahifa qayta ochilganda ham). */
const readQueuedOrderIds = (variables: unknown): string[] => {
  const ids = (variables as { payload?: { order_ids?: unknown } } | undefined)?.payload?.order_ids;
  return Array.isArray(ids) ? ids.map((value) => String(value)) : [];
};

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
  const canReassignPost = useSelector(canReassignPostToBranch);
  /** Ko'ruvchining filiali — menejer o'tkazma pochtasining manzili o'zimi (`post.branch_id`) shundan. */
  const viewerBranchId = useSelector(getCurrentBranchId);
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
  /** Pochta ichidagi qidiruv (MD-1, `?q=`). */
  const mailQuery = search?.get("q") ?? "";
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
  // #618: eski pochta (tarix) — server sukuti (qabul qilinganda sobiq a'zolar ham); qolgan har rejim — `current`.
  const {
    data: regularResponse,
    isLoading: regularLoading,
    isError: regularError,
    error: regularErrorValue,
    refetch: refetchRegularDetail,
  } = useMailDetail(!isRefusedDetail && !isAllBatchesDetail ? postId ?? "" : "", {
    view: isOldMailView ? undefined : "current",
    // Xato sahifaning o'zida chiziladi (`ErrorState`) — global xabar takrorlanmaydi (anKpzwxk S8: kuryerga
    // 403 `post_not_visible_to_courier` ikki marta chiqardi).
    silentError: true,
  });
  const refusedQuery = useGetRefusedMailsCourierByPostId(isRefusedDetail ? postId ?? "" : "");
  const { data: refusedResponse, isLoading: refusedLoading, isError: refusedError } = refusedQuery;
  /**
   * HQ qabul qiluvchisi, rad etilgan rejim: qatorlar `post/orders/rejected/:id` dan, pochtaning o'zi (holat,
   * jo'natgan filial `post.branch`, qabul joyi `post.branch_id`) — shu yordamchi `current` so'rovidan. U faqat
   * «Filialga qaytarish» uchun: yiqilsa sahifa xato holatiga o'tmaydi, global xabar ham yo'q — tugma ko'rinmaydi.
   */
  const { data: refusedMetaResponse } = useMailDetail(isRefusedDetail && isHqRefusedReceiver ? postId ?? "" : "", {
    view: "current",
    silentError: true,
  });
  const { apiRequest } = useAppNotification();

  // URL ni tozalash: /mails/:id?from=...&q=... -> /mails/:id?q=... (rejim state orqali saqlanadi; qidiruv URL'da qoladi)
  useEffect(() => {
    if (!location.search) return;
    const keptQuery = mailQuery ? `?${new URLSearchParams({ q: mailQuery }).toString()}` : "";
    if (location.search === keptQuery) return;
    navigate({ pathname: location.pathname, search: keptQuery }, {
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
  /**
   * Kuryer / filial menejeri: qaytarish so'rovi bor, lekin QR'i shu sahifada skanerlangan buyurtmalar — yana qabul
   * qilinadiganlar.
   */
  const [reclaimedOrderIds, setReclaimedOrderIds] = useState<Set<string>>(new Set());
  /**
   * Skan-qabul (2026-11-07): shu sahifada skanerlab qabulga yuborilgan buyurtmalar — ro'yxatdan (va qaytarish
   * so'rovi izohidan) yashiriladi. Muvaffaqiyatda HECH QACHON olib tashlanmaydi (refetch kechiksa ham qaytib
   * chiqmaydi); faqat xatoda chiqariladi (qator qaytadi).
   */
  const [scanHiddenIds, setScanHiddenIds] = useState<Set<string>>(new Set());
  /** Skan-qabul jurnali (kamera ro'yxati, hisoblagich): navbatda · qabul qilindi · qabul qilinmadi. */
  const [scanLog, setScanLog] = useState<Record<string, ScanReceiveLogEntry>>({});
  /**
   * Shu sahifada skan-qabul bo'ldi — sahifa qabul rejimida «qulflanadi»: pochta `received` bo'lsa yoki eski
   * pochtadagi oxirgi yo'ldagi qoldiq qabul qilinsa ham refetchdan keyin faqat o'qish tarixiga o'tmaydi (kamera
   * yopilib ketmaydi, keyingi skan ham qabul — `already_received`).
   */
  const [scanReceiveLocked, setScanReceiveLocked] = useState(false);
  // Boshqa pochtaga o'tilsa (sahifa qayta o'rnatilmaydi) — skan-qabul holati yangidan (render paytida, React tavsiyasi).
  const [scanReceiveOwner, setScanReceiveOwner] = useState(id);
  if (scanReceiveOwner !== id) {
    setScanReceiveOwner(id);
    setScanHiddenIds(new Set());
    setScanLog({});
    setScanReceiveLocked(false);
  }
  const scanReceiveScope = `post-receive:${postId ?? ""}`;
  /**
   * Skan-qabul so'rovlari — bitta navbat (`useReceivePost` `scope`): ketma-ket, sahifa yashirin bo'lsa ham va sahifadan
   * chiqilsa ham yuboriladi.
   */
  const scanReceivePost = useReceivePost({ scope: scanReceiveScope });
  const scanQueueMutating = useIsMutating({ mutationKey: ["post-receive", scanReceiveScope] });
  const queuedOrderIdLists = useMutationState({
    filters: { mutationKey: ["post-receive", scanReceiveScope] },
    select: (mutation) => {
      const ids = readQueuedOrderIds(mutation.state.variables);
      if (mutation.state.status === "pending") return ids;
      // Qabul qilingani (yoki allaqachon qabul qilingani) — sahifa qayta ochilganda ham detal qayta so'rovi «kutilmoqda»
      // ni ko'rsatguncha yashirin qoladi (eski «yo'lda» surat bilan qaytib chiqmasin). Xato — qator qaytadi.
      if (mutation.state.status === "success") {
        return ids.filter((orderId) => readScanReceiveOutcome(mutation.state.data, orderId).ok);
      }
      return [];
    },
  });
  /** Navbatdagi va qabul qilingan buyurtmalar — sahifa yopilib qayta ochilganda ham (oldingi ochilishdagi so'rovlar). */
  const queuedOrderIds = useMemo(() => new Set(queuedOrderIdLists.flat()), [queuedOrderIdLists]);
  /** Ro'yxatdan yashiriladiganlar: shu sahifada skanerlab yuborilganlar + navbatdagilar. */
  const scanHiddenAll = useMemo(
    () => (queuedOrderIds.size === 0 ? scanHiddenIds : new Set([...scanHiddenIds, ...queuedOrderIds])),
    [queuedOrderIds, scanHiddenIds],
  );
  const scanPendingCount = useMemo(
    () => Object.values(scanLog).filter((entry) => entry.status === "pending").length,
    [scanLog],
  );
  /** Navbat bo'sh emas: «Pochtani qabul qilish», «Kelmagan — qaytarish» va avtomatik orqaga qaytish o'chiq. */
  const isScanQueueBusy = scanQueueMutating > 0 || scanPendingCount > 0;
  const regularOrdersFromPost = useMemo(
    () => regularResponse?.data?.allOrdersByPostId ?? [],
    [regularResponse],
  );
  /** Hozir pochtadagi qatorlar (#618: `view=all` dagi sobiq a'zolarsiz) — amal rejimlarining yagona manbasi. */
  const currentOrdersFromPost = useMemo(() => regularOrdersFromPost.filter(isInPostNow), [regularOrdersFromPost]);
  const postMeta = regularResponse?.data?.post ?? null;
  const refusedOrdersFromPost = useMemo<PostOrder[]>(() => refusedResponse?.data ?? [], [refusedResponse]);
  /**
   * fix3b LC-11: eski yozuvlarda filial/kuryer qabulidan keyin pochta RECEIVED
   * bo'lib qolgan, ichida esa hamon yo'lda (ON_THE_ROAD) buyurtma bor (bitta
   * yangilash yiqilgan yoki qabul paytida HQ yangi buyurtma qo'shgan).
   * RECEIVED pochta "eski" ko'rinishda faqat o'qish uchun ochilardi va bu
   * posilkalarni hech kim qabul qila olmasdi. Qabul qiluvchiga (kuryer yoki
   * filial menejeri) qabul qilish qayta ochiladi — backend ham bunday
   * pochtani qabul qiladi.
   *
   * vaICniE4 (#618): faqat hozir pochtadagi yo'ldagi qator sanaladi va faqat
   * pochtaning qabul qiluvchisiga: kuryer — `post.courier_id` o'zi bo'lsa;
   * menejer — filial o'tkazmasi pochtasida (`courier_id` yo'q yoki `'0'`).
   * Menejer o'z kuryerining qabul qilingan pochtasini (backend endi unga
   * `branch_id` yozadi va `receivePost` ni o'tkazadi) faqat ko'radi — kuryer
   * posilkalarini qabul qilmaydi: eski pochtada qabul qayta ochilmaydi,
   * holatsiz havolada (buyurtma sahifasidagi «Pochta», skanerdagi «Pochtani
   * ochish») esa sahifa eski pochtadagidek faqat o'qish uchun
   * (`isForeignReceivedPost`).
   */
  const postCourierId = toText(postMeta?.courier_id);
  /** Pochta qayerga ketgan: o'tkazma pochtasida — manzil filial (qabul qiladigan menejer filiali). */
  const postBranchId = toText(postMeta?.branch_id);
  const viewerId = toText(user?.id);
  /**
   * anKpzwxk (backend #620/#621): HQ → filial o'tkazmasini faqat manzil filial menejeri (REGIONAL/HYBRID,
   * `post.branch_id` — o'z filiali) qabul qiladi; HQ menejeri va boshqa filial menejeriga jo'natilgan o'tkazma —
   * faqat o'qish (`model/receiveAccess.ts`).
   */
  const receiveAccess = resolveReceiveAccess({
    role,
    branchType: userBranchType,
    myBranchId: viewerBranchId,
    viewerId,
    post: postMeta,
  });
  const { isPostReceiver, isReadOnlyForeignTransfer } = receiveAccess;
  const isReceivedPost = String(postMeta?.status ?? "").toLowerCase() === "received";
  const hasStuckOnTheRoadOrders =
    isOldMailView &&
    !isRefusedDetail &&
    isPostReceiver &&
    // Skan-qabul bo'lgan bo'lsa — oxirgi qoldiq qabul qilingach ham qabul rejimi (qulf).
    (hasOnTheRoadOrders(currentOrdersFromPost) || scanReceiveLocked);
  /** Holat (eski pochta yoki «Hamma batchlar») bo'yicha faqat o'qish. */
  const isOldByState = (isOldMailView && !hasStuckOnTheRoadOrders) || isAllBatchesDetail;
  const isRegularRefusedDetail =
    !isOldByState &&
    currentOrdersFromPost.length > 0 &&
    currentOrdersFromPost.every((order) => REFUSED_MAIL_ORDER_STATUSES.has(order.status));
  const isEffectiveRefusedDetail = isRefusedDetail || isRegularRefusedDetail;
  /**
   * Holatsiz ochilgan qabul qilingan (RECEIVED) oddiy pochta, ko'ruvchi — uning qabul qiluvchisi bo'lmagan kuryer
   * yoki menejer: qabul rejimi ochilmaydi (aks holda yo'ldagi qator «Pochtani qabul qilish» bilan chiqadi), sahifa
   * eski pochtadagidek faqat o'qish uchun.
   */
  const isForeignReceivedPost =
    !isOldByState && !isEffectiveRefusedDetail && isCourierLikeReceiver && isReceivedPost && !isPostReceiver;
  /** Jo'natilgan o'tkazma, ko'ruvchi — manzil filial menejeri emas: faqat o'qish («Faqat o'qish» + izoh). */
  const isForeignTransferPost = !isOldByState && !isEffectiveRefusedDetail && isReadOnlyForeignTransfer;
  const isOldDetail = isOldByState || isForeignReceivedPost || isForeignTransferPost;
  const shouldReceiveCurrentPost = isEffectiveRefusedDetail ? canReceiveRefusedPost : receiveAccess.canReceive;
  /**
   * Filial menejeri: o'z filialiga jo'natilgan o'tkazma pochtasi (kuryersiz, `post.branch_id` — menejer filiali).
   * Boshqa filialning o'tkazmasi (havola orqali ochilgan) yoki filiali noma'lum — «kelmagan» yo'q (backend — 403).
   */
  const isOwnBranchTransferPost = receiveAccess.isDestinationManager;
  /**
   * Jo'natilgan (`sent`) pochta, qabul rejimi — kuryerning pochtasi yoki menejer filialiga o'tkazma (ega qarori
   * 2026-11-04): qaytarish so'rovi bor buyurtmalar qabul qilinadiganlardan ajratiladi (karta izohida sanaladi).
   */
  const isSentReturnReceive =
    (isCourier || isOwnBranchTransferPost) &&
    shouldReceiveCurrentPost &&
    !isEffectiveRefusedDetail &&
    !isOldDetail &&
    String(postMeta?.status ?? "").toLowerCase() === "sent";
  /**
   * «Bu buyurtma kelmagan — qaytarish so'rovi» — faqat pochtaning o'z kuryeriga yoki manzil filial menejeriga
   * (backend ham shuni tekshiradi).
   */
  const canRequestReturn = isSentReturnReceive && isPostReceiver;
  /**
   * Skan = darhol qabul (2026-11-07): pochtaning qabul qiluvchisi — kuryer (o'z pochtasi) yoki menejer (o'z filialiga
   * kuryersiz o'tkazma); pochta jo'natilgan (`sent`) yoki eski pochtadagi yo'ldagi qoldiq (`view=old`). Bir marta
   * skan-qabul bo'lgach — qulf (pochta `received` bo'lsa ham rejim saqlanadi). Boshqa hamma joyda skan — tanlash.
   */
  const isScanReceive =
    !isRefusedDetail &&
    !isEffectiveRefusedDetail &&
    !isOldDetail &&
    isPostReceiver &&
    (isCourier || isOwnBranchTransferPost) &&
    (String(postMeta?.status ?? "").toLowerCase() === "sent" || hasStuckOnTheRoadOrders || scanReceiveLocked);
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
  /**
   * Shu sahifada amal bajarildi (qabul / qaytarish): pochta bo'shasa ham viloyat zaxirasi ochilmaydi — aks holda
   * yopilgan pochtada viloyatning boshqa rad etilgan buyurtmalari «shu pochtaniki» bo'lib chiqardi.
   */
  const hasLocalPostAction = sentOrderIds.size > 0;
  const shouldLoadRefusedRegionFallback =
    !isAllBatchesDetail &&
    isEffectiveRefusedDetail &&
    !isOldDetail &&
    !hasLocalPostAction &&
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
      return refusedOrdersFromPost.length > 0 || hasLocalPostAction
        ? refusedOrdersFromPost
        : refusedRegionFallbackOrders;
    }

    return regularOrdersFromPost.length > 0
      ? regularOrdersFromPost
      : regionFallbackOrders;
  }, [
    isAllBatchesDetail,
    isRefusedDetail,
    hasLocalPostAction,
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
        // Skan-qabulga yuborilganlar (navbatda yoki qabul qilingan) — ro'yxatdan darhol chiqadi.
        if (!isOldDetail && scanHiddenAll.has(order.id)) return false;
        // Ish rejimi — faqat hozir pochtadagilar (#618: sobiq a'zo tanlanmaydi, sanalmaydi, qabul qilinmaydi).
        if (!isOldDetail && !isInPostNow(order)) return false;

        if (
          shouldReceiveCurrentPost &&
          !isEffectiveRefusedDetail &&
          !isOldDetail &&
          order.status !== "on the road"
        ) {
          return false;
        }
        // Kuryer / filial menejeri: qaytarish so'rovi bor buyurtma qabul qilinmaydi (QR'i skanerlanmagan bo'lsa) —
        // izohda sanaladi.
        if (isSentReturnReceive && order.return_requested === true && !reclaimedOrderIds.has(order.id)) {
          return false;
        }

        return true;
      }),
    [
      rawOrders,
      sentOrderIds,
      scanHiddenAll,
      shouldReceiveCurrentPost,
      isEffectiveRefusedDetail,
      isOldDetail,
      isSentReturnReceive,
      reclaimedOrderIds,
    ],
  );
  /**
   * Jo'natilgan pochtada (kuryerniki yoki menejer filialiga o'tkazma) qaytarish so'rovi yuborilgan (hali yo'ldagi)
   * buyurtmalar — karta izohi.
   */
  const requestedOrders = useMemo(
    () =>
      isSentReturnReceive
        ? rawOrders.filter(
            (order) =>
              isInPostNow(order) &&
              order.status === "on the road" &&
              order.return_requested === true &&
              !reclaimedOrderIds.has(order.id) &&
              // So'rovi bor buyurtma skanerlab qabul qilinsa — izohdan ham chiqadi.
              !scanHiddenAll.has(order.id),
          )
        : [],
    [isSentReturnReceive, rawOrders, reclaimedOrderIds, scanHiddenAll],
  );
  const requestedOrderIds = useMemo(() => new Set(requestedOrders.map((order) => order.id)), [requestedOrders]);
  /** Skaner ro'yxati: qabul qilinadiganlar + so'rovi borlar (QR'i skanerlansa, buyurtma ro'yxatga qaytadi). */
  const scanOrders = useMemo(
    () => (requestedOrders.length > 0 ? [...orders, ...requestedOrders] : orders),
    [orders, requestedOrders],
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
  const {
    selectedIds,
    allSelected,
    someSelected,
    toggleAll,
    toggleOne,
    selectOne,
    deselectOne,
    clearSelection,
    setManySelected,
  } = useMailDetailState(orders);

  // ─── Qidiruv va takroriy telefonlar (MD-1) ────────────────────────────────
  // Qidiruv: xodim jo'natish, menejer qabul rejimi (maketlar) va rad etilgan pochta (ega qarori 2026-11-09 — maket
  // yo'q, eng yaqini `admin-mails-detail-search`); kuryer va eski pochtada yo'q.
  const searchMode: "send" | "receive" | "refused" | null =
    isOldDetail || isCourier
      ? null
      : isEffectiveRefusedDetail
        ? "refused"
        : role === "manager"
          ? shouldReceiveCurrentPost
            ? "receive"
            : null
          : "send";
  /** Takroriy telefonlar banneri — faqat jo'natish va qabul rejimida (rad etilgan pochtada — faqat qidiruv). */
  const duplicatesMode = searchMode === "refused" ? null : searchMode;
  // `q` — URL'da (`replace`; rejim `location.state` da saqlanadi). Maydon MAHALLIY qoralamaga bog'langan: router
  // har bir joylashuv o'zgarishini `startTransition` ichida qo'llaydi — URL'ga bevosita bog'langan maydonda kursor
  // oxirga sakraydi, tez yozilgan harflar yo'qoladi (IME ham buziladi). URL kechikish bilan yoziladi; tozalash,
  // chip va skandan keyingi tiklash — darhol.
  const [queryDraft, setQueryDraft] = useState(mailQuery);
  /** Oxirgi o'zimiz URL'ga yozgan (yoki URL'dan olgan) `q`. */
  const [writtenQuery, setWrittenQuery] = useState(mailQuery);
  const [prevMailQuery, setPrevMailQuery] = useState(mailQuery);
  if (prevMailQuery !== mailQuery) {
    // URL tashqaridan o'zgardi (back/forward, boshqa pochta) — maydon ham. O'zimiz yozgan qiymat — maydon tegilmaydi.
    setPrevMailQuery(mailQuery);
    if (mailQuery !== writtenQuery) {
      setWrittenQuery(mailQuery);
      setQueryDraft(mailQuery);
    }
  }
  /** Jadval qoralamadan bir qadam orqada (sekin telefonda yozish tormozlanmasin). */
  const appliedQuery = useDeferredValue(queryDraft);
  const searchResult = useMemo(
    () => filterMailOrders(orders, searchMode ? appliedQuery : ""),
    [appliedQuery, orders, searchMode],
  );
  const duplicateGroups = useMemo(() => (duplicatesMode ? findDuplicatePhones(orders) : []), [orders, duplicatesMode]);
  const duplicateMap = useMemo(() => duplicateSiblings(duplicateGroups), [duplicateGroups]);
  const duplicateNote = useCallback(
    (order: PostOrder) => {
      const siblings = duplicateMap.get(String(order.id));
      return siblings?.length
        ? t("detailPage.duplicates.rowBadgeTitle", { ids: siblings.map((siblingId) => `№${siblingId}`).join(", ") })
        : null;
    },
    [duplicateMap, t],
  );

  const writeMailQuery = useCallback(
    (value: string) => {
      setWrittenQuery(value);
      const next = value ? `?${new URLSearchParams({ q: value }).toString()}` : "";
      navigate({ pathname: location.pathname, search: next }, { replace: true, state: location.state });
    },
    [location.pathname, location.state, navigate],
  );
  // Kechikkan yozuv ENG SO'NGGI `writeMailQuery` ni chaqiradi (yo'l / `location.state` kutish orasida o'zgarishi mumkin).
  const writeMailQueryRef = useRef(writeMailQuery);
  useEffect(() => {
    writeMailQueryRef.current = writeMailQuery;
  });
  useEffect(() => {
    if (queryDraft === writtenQuery) return;
    const timer = window.setTimeout(() => writeMailQueryRef.current(queryDraft), MAIL_QUERY_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [queryDraft, writtenQuery]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchEditsRef = useRef<SearchEdit[]>([]);
  const queryDraftRef = useRef(queryDraft);
  useEffect(() => {
    queryDraftRef.current = queryDraft;
  }, [queryDraft]);
  /** Darhol qo'llash (chip, tozalash, skandan keyin tiklash): qoralama va URL birga. */
  const applyMailQuery = useCallback(
    (value: string) => {
      queryDraftRef.current = value;
      setQueryDraft(value);
      writeMailQuery(value);
    },
    [writeMailQuery],
  );
  const handleQueryChange = useCallback(
    (value: string) => {
      searchEditsRef.current = [
        ...searchEditsRef.current.slice(-63),
        { before: queryDraftRef.current, after: value, at: Date.now() },
      ];
      if (!value) {
        applyMailQuery("");
        return;
      }
      queryDraftRef.current = value;
      setQueryDraft(value);
    },
    [applyMailQuery],
  );
  /** USB skan qidiruv maydoniga ham yozilgan bo'lsa — maydon skandan oldingi qiymatiga qaytadi. */
  const restoreQueryAfterScan = useCallback(
    (source: ScanSource) => {
      if (source !== "keyboard" || !searchInputRef.current) return;
      if (document.activeElement !== searchInputRef.current) return;
      const before = valueBeforeScan(searchEditsRef.current, Date.now());
      searchEditsRef.current = [];
      if (before === null || before === queryDraftRef.current) return;
      applyMailQuery(before);
    },
    [applyMailQuery],
  );
  /**
   * Qidiruv maydoniga TEZ yozib Enter bosilgani (USB skanerga o'xshaydi): «kod» shu pochtadagi buyurtmalarni
   * ism / tuman / market bo'yicha topsa — bu qidiruv, skan emas («Bu pochtada yo'q» va tiklash yo'q).
   */
  const isTypedSearchInField = useCallback(
    (rawValue: string, source: ScanSource) =>
      source === "keyboard" &&
      searchMode !== null &&
      searchInputRef.current !== null &&
      document.activeElement === searchInputRef.current &&
      looksLikeTypedSearch(orders, rawValue),
    [orders, searchMode],
  );
  const activeDuplicateKey = duplicateGroups.find((group) => isPhoneQuery(queryDraft, group))?.key ?? null;
  const toggleDuplicatePhone = useCallback(
    (group: DuplicatePhoneGroup, active: boolean) => applyMailQuery(active ? "" : group.phone),
    [applyMailQuery],
  );
  // Kamera ro'yxati: skan tartibi (`order:<id>` / `missing:<kod>`) va pochtada yo'q kodlar.
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
  const requestOrderReturn = useRequestOrderReturn();
  const receiveCanceledPost = useReceiveCanceledPost();
  const returnCanceledOrders = useReturnCanceledOrders();
  /** Rad etilgan pochtadagi ikki amal (qabul, filialga qaytarish) bir vaqtda yurmaydi. */
  const isRefusedActionBusy = receiveCanceledPost.isPending || returnCanceledOrders.isPending;
  const isReceiving = isEffectiveRefusedDetail
    ? receiveCanceledPost.isPending
    : receivePost.isPending;

  // ─── HQ: rad etilgan pochta → «Filialga qaytarish» ────────────────────────
  /** HQ qabul qiluvchisi rad etilgan pochtada: tanlanmaganlar pochtada qoladi, qaytarish — alohida amal. */
  const isHqRefusedFlow = isEffectiveRefusedDetail && isHqRefusedReceiver && !isOldDetail;
  // Pochtaning o'zi: rad etilgan rejimda — yordamchi so'rovdan, holatsiz havolada — asosiy tafsilotdan.
  const refusedPostMeta = isRefusedDetail ? (refusedMetaResponse?.data?.post ?? null) : postMeta;
  const senderBranchId = toText(refusedPostMeta?.branch?.id);
  const senderBranchName = refusedPostMeta?.branch?.name?.trim() || null;
  /**
   * Faqat filial jo'natgan, hali ochiq (`canceled`) pochtada: jo'natgan filial (`post.branch`) bor va u qabul
   * joyining o'zi (HQ, `post.branch_id`) emas. HQ kuryeri olib kelgan pochtada (jo'natuvchi — HQ) tugma yo'q.
   */
  const canReturnToSender =
    isHqRefusedFlow &&
    String(refusedPostMeta?.status ?? "").toLowerCase() === "canceled" &&
    Boolean(senderBranchId) &&
    Boolean(senderBranchName) &&
    senderBranchId !== toText(refusedPostMeta?.branch_id);
  // Pochtadan o'chirish (yokjwjXG): faqat superadmin, faqat jo'natilmagan (NEW) pochta.
  const deleteFromPost = useDeleteOrdersFromPost();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState("");
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

    // Kuryer / filial menejeri: qaytarish so'rovi bor buyurtmaning QR'i — posilka kelgan; u qabul qilinadiganlarga
    // qaytib tanlanadi (bloklanmaydi: qabul qilinsa backend so'rovni bekor qiladi).
    const reclaimed = requestedOrderIds.has(order.id);
    if (reclaimed) {
      setReclaimedOrderIds((prev) => new Set(prev).add(order.id));
      setSentOrderIds((prev) => {
        if (!prev.has(order.id)) return prev;
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    }
    selectOne(order.id);
    touchRecentScan(`order:${order.id}`);
    void playScanFeedback("success", t("detailPage.cameraSelected", { id: order.id }), undefined, { voice: "selected" });
    scanNotify.success(t("orderSelected"), {
      description: reclaimed ? t("detailPage.requestReturn.scannedRequested", { id: order.id }) : `#${order.id}`,
      duration: reclaimed ? 4000 : 2000,
    });
  }, [requestedOrderIds, selectOne, selectedIds, t, touchRecentScan]);

  const rejectScannedCode = useCallback((rawValue: string) => {
    const code = extractScannerToken(rawValue) ?? rawValue.trim();
    setRejectedCodes((prev) => (prev.includes(code) ? prev : [...prev, code]));
    touchRecentScan(`missing:${code}`);
    void playScanFeedback("missing", t("detailPage.cameraNotInMail"));
  }, [t, touchRecentScan]);

  /** Skan javobini olib bo'lmadi: 404 — bu pochtada yo'q kod (ro'yxatda «rad etildi»); boshqa xato — tekshirib bo'lmadi. */
  const reportScanLookupError = useCallback((rawValue: string, error: unknown) => {
    if (getErrorStatus(error) === 404) {
      rejectScannedCode(rawValue);
      scanNotify.warning(t("qrNotFound"), { description: t("mailScanMissing"), duration: 3000 });
      return;
    }
    // Begona QR (#620, anKpzwxk): boshqa filial buyurtmasi — lokal sarlavha va izoh, «QR topilmadi» emas.
    const scope = readQrScopeText(t, error);
    if (scope) {
      void playScanFeedback("error", scope.line);
      scanNotify.error(scope.title, { description: scope.description || undefined, duration: 3000 });
      return;
    }
    const message = getBackendErrorMessage(error) ?? t("mailScanMissing");
    void playScanFeedback("error", message);
    // Skaner oqimi: xato qisqa turadi (v1 dagidek 3 s) — keyingi skanerlashda ekran to'silib qolmasin.
    scanNotify.error(t("qrNotFound"), {
      description: message,
      duration: 3000,
    });
  }, [rejectScannedCode, t]);

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

      const matchedByIdentifier = scanOrders.find((order) => {
        const orderIdentifiers = getOrderIdentifiers(order);
        return [...scannedIdentifiers].some((identifier) => orderIdentifiers.has(identifier));
      });
      const comparableMatches = matchedByIdentifier
        ? []
        : scanOrders.filter((order) => isSameCustomerMarketOrder(scannedOrder, order));
      const matchedOrder = matchedByIdentifier ?? (comparableMatches.length === 1 ? comparableMatches[0] : undefined);

      if (matchedOrder) {
        selectScannedOrder(matchedOrder);
        return;
      }

      rejectScannedCode(rawValue);
      scanNotify.warning(t("qrNotFound"), { description: t("mailScanMissing"), duration: 3000 });
    } catch (error) {
      reportScanLookupError(rawValue, error);
    }
  }, [scanOrders, rejectScannedCode, reportScanLookupError, selectScannedOrder, t]);

  const handleBack = useCallback(() => {
    navigate(`${getMailTabPath(normalizeMailTab(fromTab))}${fromSearch}`);
  }, [fromSearch, fromTab, navigate]);

  const count = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);

  // ─── Skan = darhol qabul (2026-11-07) ─────────────────────────────────────
  // Skaner indeksi — pochtadagi HAMMA joriy qator (yo'ldagi, qaytarish so'ralgan, kutilmoqda): ro'yxat bo'shasa ham
  // USB tinglaydi, qabul qilingan buyurtmaning qayta skani esa «Allaqachon qabul qilingan» bo'ladi (so'rovsiz).
  const scanReceiveIndex = useMemo(
    () => (isScanReceive ? currentOrdersFromPost : []),
    [currentOrdersFromPost, isScanReceive],
  );
  /** Shu ochilishda yuborilgan (javobi kutilayotgan) va qabul qilingan buyurtmalar — tez ketma-ket skanlar uchun ref. */
  const scanPendingRef = useRef(new Set<string>());
  const scanReceivedRef = useRef(new Set<string>());
  const queuedOrderIdsRef = useRef(queuedOrderIds);
  const scanVisibleOrdersRef = useRef(orders);
  const scanReceiveIndexRef = useRef(scanReceiveIndex);
  const isScanQueueBusyRef = useRef(isScanQueueBusy);
  const handleBackRef = useRef(handleBack);
  useEffect(() => {
    queuedOrderIdsRef.current = queuedOrderIds;
    scanVisibleOrdersRef.current = orders;
    scanReceiveIndexRef.current = scanReceiveIndex;
    isScanQueueBusyRef.current = isScanQueueBusy;
    handleBackRef.current = handleBack;
  });
  // Boshqa pochta — yangi to'plamlar (oldingi pochtaning so'rovlari o'z to'plamini yangilaydi).
  useEffect(() => {
    scanPendingRef.current = new Set();
    scanReceivedRef.current = new Set();
  }, [postId]);
  const mountedRef = useRef(false);
  const doneTimerRef = useRef<number | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (doneTimerRef.current !== null) window.clearTimeout(doneTimerRef.current);
      doneTimerRef.current = null;
    };
  }, []);

  /** Pochta to'liq qabul qilindi (javob `post_status: received`, navbat bo'sh) — xabar va ~1.5 s dan keyin orqaga. */
  const finishScanReceive = useCallback(() => {
    notify.success(t("detailPage.scanReceive.done"), {
      description: mountedRef.current ? t("detailPage.scanReceive.doneText") : undefined,
    });
    // Sahifadan chiqib ketilgan (navbat orqada tugadi) — hech qayoqqa o'tilmaydi.
    if (!mountedRef.current) return;
    // Kamera ochiq bo'lsa xabar uning ichida (ovozsiz — skan ovozi allaqachon chalingan).
    void playScanFeedback("success", t("detailPage.scanReceive.done"), undefined, { silent: true });
    if (doneTimerRef.current !== null) window.clearTimeout(doneTimerRef.current);
    doneTimerRef.current = window.setTimeout(() => {
      doneTimerRef.current = null;
      if (mountedRef.current && !isScanQueueBusyRef.current && scanPendingRef.current.size === 0) {
        handleBackRef.current();
      }
    }, SCAN_RECEIVE_DONE_BACK_MS);
  }, [t]);

  /**
   * Skanerlangan buyurtmani darhol qabul qilish: navbatda / allaqachon qabul qilingan — «Allaqachon qabul qilingan»
   * (so'rovsiz); yo'lda emas — xato (so'rovsiz); aks holda optimistik (ovoz, xabar, qator yashiriladi) va
   * `PATCH post/receive/:id {order_ids: [id], scan: true}` navbatga. Qaytarish so'ralgan buyurtma ham to'g'ridan
   * qabul qilinadi (backend so'rovni bekor qiladi) — `reclaimedOrderIds` ga tegilmaydi.
   */
  const receiveScannedOrder = useCallback(
    (order: PostOrder, source?: ScanSource) => {
      if (!postId) return;
      const orderId = String(order.id);
      touchRecentScan(`order:${orderId}`);
      const pending = scanPendingRef.current;
      const received = scanReceivedRef.current;
      if (
        pending.has(orderId) ||
        received.has(orderId) ||
        queuedOrderIdsRef.current.has(orderId) ||
        String(order.status ?? "").toLowerCase() === "waiting"
      ) {
        const message = t("detailPage.scanReceive.duplicate", { id: orderId });
        void playScanFeedback("duplicate", message, source);
        scanNotify.warning(message, { duration: 2000 });
        return;
      }
      if (!isScanReceivableStatus(order.status)) {
        const message = t("detailPage.scanReceive.notReceivable", { id: orderId });
        void playScanFeedback("error", message, source);
        scanNotify.error(message, { duration: 3000 });
        return;
      }

      pending.add(orderId);
      setScanReceiveLocked(true);
      setScanHiddenIds((prev) => new Set(prev).add(orderId));
      setScanLog((prev) => ({ ...prev, [orderId]: { order, status: "pending" } }));
      // «N ta qoldi» — ko'rinadigan qabul qilinadiganlar minus navbatdagilar (lokal hisob, ref'lar orqali: tez
      // ketma-ket skanlarda ham to'g'ri).
      const left = scanVisibleOrdersRef.current.filter(
        (row) => !pending.has(row.id) && !received.has(row.id) && !queuedOrderIdsRef.current.has(row.id),
      ).length;
      const leftValue = count(left);
      void playScanFeedback("success", t("detailPage.scanReceive.received", { id: orderId }), source, {
        voice: "received",
        text: t("detailPage.scanReceive.left", { value: leftValue, count: left }),
      });
      scanNotify.success(t("detailPage.scanReceive.toast", { id: orderId, value: leftValue, count: left }), {
        duration: 2000,
      });

      /** `heading` — o'z sarlavhasi («qayta skanerlang» siz); `sticky` — xabar foydalanuvchi yopguncha turadi. */
      const fail = (reason: string | null, heading?: string, sticky = false) => {
        pending.delete(orderId);
        setScanHiddenIds((prev) => {
          if (!prev.has(orderId)) return prev;
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
        setScanLog((prev) => ({ ...prev, [orderId]: { order, status: "failed" } }));
        const title = heading ?? t("detailPage.scanReceive.failed", { id: orderId });
        void playScanFeedback("error", title, undefined, reason ? { text: reason } : {});
        scanNotify.error(title, { description: reason ?? undefined, duration: sticky ? undefined : 6000 });
      };

      // `Promise.resolve().then` — so'rov xatosi (hatto sinxron) ham shu yerda ushlanadi, skan oqimi uzilmaydi.
      void Promise.resolve()
        .then(() => scanReceivePost.mutateAsync({ postId, payload: { order_ids: [orderId], scan: true } }))
        .then(
          (response) => {
            const outcome = readScanReceiveOutcome(response, orderId);
            if (!outcome.ok) {
              fail(outcome.error);
              return;
            }
            pending.delete(orderId);
            received.add(orderId);
            setScanLog((prev) => ({ ...prev, [orderId]: { order, status: "received" } }));
            if (outcome.postStatus === "received" && pending.size === 0) finishScanReceive();
          },
          (error: unknown) => {
            // #621 `post_receive_manager_only`: qabul faqat manzil filial menejerida — qayta skan foydasiz:
            // «Pochta qabul qilinmadi» + sabab (qolguncha turadi), sahifa yangilanadi (`handleReceive` dagidek).
            const rejection = readBackendRejection(error);
            if (rejection.reason === "post_receive_manager_only") {
              const text = coverageRejectionText(t, rejection, { context: "receive", fallbackTitle: "" });
              fail(text.description, text.title, true);
              void refetchRegularDetail();
              return;
            }
            // Boshqa tanilgan sabab — lokal matn; noma'lum — backend matni.
            fail(coverageErrorLine(t, error, "receive") ?? getBackendErrorMessage(error) ?? null);
          },
        );
    },
    [count, finishScanReceive, postId, refetchRegularDetail, scanReceivePost, t, touchRecentScan],
  );

  /** Skan-qabul: indeksda yo'q kod — faqat skan javobidagi buyurtma id'si pochta qatoriga AYNAN teng bo'lsa qabul. */
  const handleMissingScanReceive = useCallback(
    async (rawValue: string, source: ScanSource) => {
      try {
        const detail = await fetchScanDetail(rawValue);
        const scanned = detail.type === "order" ? unwrapScannedOrder(detail.data) : {};
        const scannedId = toText(scanned.id);
        const row = scannedId
          ? scanReceiveIndexRef.current.find((order) => String(order.id) === scannedId)
          : undefined;
        if (row) {
          receiveScannedOrder(row, source);
          return;
        }
        // Kuryerning yo'ldagi pochtasi ro'yxatida faqat yo'ldagilar keladi: qabul qilingan buyurtma qayta
        // skanerlansa indeksda yo'q — «QR topilmadi» emas, «Allaqachon qabul qilingan» (shu ochilishda yoki avval).
        const alreadyReceived =
          !!scannedId &&
          (scanReceivedRef.current.has(scannedId) ||
            scanPendingRef.current.has(scannedId) ||
            (toText(scanned.post_id) === String(postId) && toText(scanned.status).toLowerCase() === "waiting"));
        if (alreadyReceived) {
          const message = t("detailPage.scanReceive.duplicate", { id: scannedId });
          void playScanFeedback("duplicate", message, source);
          scanNotify.warning(message, { duration: 2000 });
          return;
        }
        rejectScannedCode(rawValue);
        scanNotify.warning(t("qrNotFound"), { description: t("mailScanMissing"), duration: 3000 });
      } catch (error) {
        reportScanLookupError(rawValue, error);
      }
    },
    [postId, receiveScannedOrder, rejectScannedCode, reportScanLookupError, t],
  );

  const scannerEnabled =
    (isScanReceive ? scanReceiveIndex.length > 0 : orders.length > 0) && !isOldDetail && !isReadOnlyRefusedCourier;
  // Kamera — faqat amal bor rejimda (jo'natish, qabul, rad etilganni qabul): aks holda markaziy tugma `/scan`.
  const cameraEnabled = !isOldDetail && !isReadOnlyRefusedCourier && canShowActionButton;
  const cameraMode = isEffectiveRefusedDetail ? "refused" : shouldReceiveCurrentPost ? "receive" : "send";
  /** Skan-qabul hisoblagichi: kutilmoqdadagilar + shu sahifada skanerlab qabulga yuborilganlar (optimistik). */
  const scanReceivedCount = useMemo(() => {
    if (!isScanReceive) return 0;
    const ids = new Set(scanHiddenAll);
    currentOrdersFromPost.forEach((order) => {
      if (String(order.status ?? "").toLowerCase() === "waiting") ids.add(order.id);
    });
    return ids.size;
  }, [currentOrdersFromPost, isScanReceive, scanHiddenAll]);
  const scanReceiveTotal = scanReceivedCount + orders.length;
  const cameraList = useMemo<ScanTargetListItem[]>(() => {
    const orderSubtitle = (order: PostOrder) =>
      [order.district?.name?.trim(), formatMoneyLocalized(Number(order.total_price) || 0, { language })]
        .filter(Boolean)
        .join(" · ");
    const orderTitle = (order: PostOrder) =>
      [`№${order.id}`, order.customer?.name?.trim()].filter(Boolean).join(" · ");
    // Skan-qabul: qabul qilinganlar (bekor qilib bo'lmaydi — server amali) va qabul qilinmaganlar; tanlash rejimi —
    // tanlanganlar («Bekor qilish» tanlovdan chiqaradi).
    const orderItems = isScanReceive
      ? Object.entries(scanLog).map<{ key: string; item: ScanTargetListItem }>(([orderId, entry]) => ({
          key: `order:${orderId}`,
          item: {
            key: `order:${orderId}`,
            title: orderTitle(entry.order),
            subtitle: entry.status === "failed" ? t("detailPage.scanReceive.failedShort") : orderSubtitle(entry.order),
            tone: entry.status === "failed" ? "danger" : "success",
          },
        }))
      : orders
          .filter((order) => selectedIds.has(order.id))
          .map<{ key: string; item: ScanTargetListItem }>((order) => ({
            key: `order:${order.id}`,
            item: {
              key: `order:${order.id}`,
              title: orderTitle(order),
              subtitle: orderSubtitle(order),
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
    return orderByRecent([...orderItems, ...rejectedItems], (entry) => entry.key, recentScanKeys).map(
      (entry) => entry.item,
    );
  }, [deselectOne, isScanReceive, language, orders, recentScanKeys, rejectedCodes, scanLog, selectedIds, t]);
  const cameraContext = [
    postId ? t("mailNumberWithId", { id: postMeta?.id ?? postId }) : null,
    regionLabel,
  ]
    .filter(Boolean)
    .join(" · ");
  useOrderQrScanner({
    orders: isScanReceive ? scanReceiveIndex : scanOrders,
    enabled: !isOldDetail && !isReadOnlyRefusedCourier,
    onMatch: (order, _rawValue, source) => {
      if (isScanReceive) receiveScannedOrder(order, source);
      else selectScannedOrder(order);
      restoreQueryAfterScan(source);
    },
    onMissing: (rawValue, source) => {
      if (isTypedSearchInField(rawValue, source)) {
        searchEditsRef.current = [];
        return;
      }
      restoreQueryAfterScan(source);
      if (isScanReceive) void handleMissingScanReceive(rawValue, source);
      else void handleMissingScannedOrder(rawValue);
    },
    camera: cameraEnabled
      ? {
          id: `mail:${postId}:${cameraMode}`,
          title: t(`detailPage.cameraTitle.${cameraMode}`),
          context: cameraContext || undefined,
          note: {
            title: t(isScanReceive ? "detailPage.cameraNoteTitleReceive" : "detailPage.cameraNoteTitle"),
            text: t("detailPage.cameraNoteText"),
          },
          progress: isScanReceive
            ? { done: scanReceivedCount, total: scanReceiveTotal, label: t("detailPage.cameraMeterReceive") }
            : { done: selectedIds.size, total: orders.length, label: t("detailPage.cameraMeter") },
          list: cameraList,
          listTitle: t("detailPage.cameraListTitle"),
          finish: { label: t("ui:camera.action.finish"), onFinish: () => undefined },
        }
      : undefined,
  });

  /** Shu sahifada qabul qilingan / qaytarilgan buyurtmalar ro'yxatdan darhol yashiriladi. */
  const hideHandledOrders = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setSentOrderIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  // ─── Pochtani qabul qilish (kuryer, menejer, rad etilgan pochta) ─────────
  const handleReceive = useCallback(() => {
    if (selectedIds.size === 0 || !postId) return;
    const receivedIds = Array.from(selectedIds);

    if (isEffectiveRefusedDetail) {
      if (isRefusedActionBusy) return;
      // Oddiy tafsilot faqat holatsiz havolada yoqilgan: rad etilgan rejimda u bo'sh id'li o'chiq so'rov
      // (`refetch` uni baribir `post/orders/` ga yuborardi) — u yerda qatorlarni invalidatsiya yangilaydi.
      const refreshRegularDetail = () => {
        if (!isRefusedDetail) void refetchRegularDetail();
      };
      if (!isHqRefusedReceiver) {
        // Filial menejeri (kuryer pochtasi) — avvalgidek.
        apiRequest({
          request: () =>
            receiveCanceledPost.mutateAsync({
              postId,
              payload: { order_ids: receivedIds },
            }),
          successMessage: t("receiveRefusedSuccess"),
          errorMessage: t("receiveRefusedError"),
          onSuccess: () => {
            hideHandledOrders(receivedIds);
            clearSelection();
            refreshRegularDetail();
          },
        });
        return;
      }
      // HQ: faqat tanlanganlar qabul qilinadi, qolganlari shu pochtada qoladi (hech narsa o'zi qaytmaydi).
      // Pochtada buyurtma qolmasa — pochta yopildi, kelingan ro'yxatga qaytiladi. Sonlar — javobdan.
      apiRequest<CanceledPostActionResult>({
        request: () =>
          receiveCanceledPost.mutateAsync({
            postId,
            payload: { order_ids: receivedIds },
          }),
        successMessage: (result) => {
          const value = count(result.orderIds.length || receivedIds.length);
          if (result.postClosed === true) return t("receiveRefusedClosed", { value });
          if (result.postClosed === false) {
            const remaining = result.remainingOrderIds?.length ?? Math.max(0, orders.length - receivedIds.length);
            return t("receiveRefusedPartial", { value, remaining: count(remaining) });
          }
          // Eski backend (`post_closed` / `post_status` yo'q) — avvalgi matn.
          return t("receiveRefusedSuccess");
        },
        errorMessage: t("receiveRefusedError"),
        onSuccess: (result) => {
          hideHandledOrders(result.orderIds.length > 0 ? result.orderIds : receivedIds);
          clearSelection();
          refreshRegularDetail();
          if (result.postClosed === true) handleBack();
        },
      });
      return;
    }

    // Skan-qabul navbati bo'sh emas — qo'lda qabul (tanlanmaganlar qaytarishga) kutadi (tugma ham o'chiq).
    if (isScanQueueBusyRef.current) return;

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

        hideHandledOrders(acceptedIds);
        clearSelection();
        void refetchRegularDetail();
      })
      .catch((error: unknown) => {
        // anKpzwxk (#621): o'tkazmani faqat manzil filial menejeri qabul qiladi — lokal matn (backend matniga
        // tarmoqlanmaymiz), sahifa yangilanadi. `details.branch_id` o'qilmaydi.
        const rejection = readBackendRejection(error);
        if (rejection.reason === "post_receive_manager_only") {
          const text = coverageRejectionText(t, rejection, { context: "receive", fallbackTitle: t("common:error") });
          notify.error(text.title, { description: text.description });
          void refetchRegularDetail();
          return;
        }
        notify.error(t("common:error"), { description: getBackendErrorMessage(error) ?? t("receiveError") });
      });
  }, [
    selectedIds,
    postId,
    hideHandledOrders,
    isEffectiveRefusedDetail,
    isRefusedActionBusy,
    isRefusedDetail,
    isHqRefusedReceiver,
    receiveCanceledPost,
    receivePost,
    apiRequest,
    clearSelection,
    refetchRegularDetail,
    count,
    orders.length,
    handleBack,
    t,
  ]);

  // ─── HQ: tanlanganlarni jo'natgan filialga qaytarish (tasdiq bilan) ───────
  const confirm = useConfirm();
  const handleReturnToSender = useCallback(async () => {
    if (!postId || !canReturnToSender || !senderBranchName || selectedIds.size === 0 || isRefusedActionBusy) return;
    const returnIds = Array.from(selectedIds);
    const value = count(returnIds.length);
    const left = Math.max(0, orders.length - returnIds.length);
    // `confirm()` faqat `true/false` qaytaradi — javob shu yerga yoziladi (xato bo'lsa oyna ichida ko'rinadi).
    const outcome: { result?: CanceledPostActionResult } = {};
    const confirmed = await confirm({
      tone: "primary",
      icon: RotateCcw,
      title: t("detailPage.returnDialog.title"),
      description: t("detailPage.returnDialog.description", { value }),
      transfer: {
        from: { title: t("detailPage.returnDialog.from") },
        to: { title: senderBranchName, meta: t("detailPage.returnDialog.toMeta") },
      },
      consequences: [
        {
          text: t("detailPage.returnDialog.consequenceBranch", { value, branch: senderBranchName }),
          tone: "info",
          icon: RotateCcw,
        },
        left > 0
          ? { text: t("detailPage.returnDialog.consequenceRemaining", { value: count(left) }) }
          : { text: t("detailPage.returnDialog.consequenceClosed") },
      ],
      confirmLabel: t("detailPage.returnDialog.confirm"),
      confirmIcon: RotateCcw,
      loadingLabel: t("detailPage.returnDialog.loading"),
      errorMessage: (error) => getBackendErrorMessage(error) ?? t("detailPage.returnDialog.error"),
      onConfirm: async () => {
        outcome.result = await returnCanceledOrders.mutateAsync({ postId, payload: { order_ids: returnIds } });
      },
    });
    const result = outcome.result;
    if (!confirmed || !result) return;

    const returnedIds = result.orderIds.length > 0 ? result.orderIds : returnIds;
    hideHandledOrders(returnedIds);
    clearSelection();
    if (!isRefusedDetail) void refetchRegularDetail();
    const closed = result.postClosed ?? result.remainingOrderIds?.length === 0;
    notify.success(t("common:success"), {
      description: t(closed ? "detailPage.returnDialog.successClosed" : "detailPage.returnDialog.success", {
        value: count(returnedIds.length),
        branch: senderBranchName,
      }),
    });
    if (closed) handleBack();
  }, [
    postId,
    canReturnToSender,
    senderBranchName,
    selectedIds,
    isRefusedActionBusy,
    count,
    orders.length,
    confirm,
    t,
    returnCanceledOrders,
    hideHandledOrders,
    clearSelection,
    isRefusedDetail,
    refetchRegularDetail,
    handleBack,
  ]);

  // ─── Kuryer / menejer: «Bu buyurtma kelmagan» — qaytarish so'rovi (tasdiq bilan) ─
  // Maket yo'q — eng yaqini: `courier-mails-detail-receive` (qator / karta), `courier-orders-pending` (danger-soft
  // qator amali). Ega qarori 2026-11-03 (BeePost kabi); menejer — o'z filialiga o'tkazmada (2026-11-04), xuddi shu
  // so'rov va oqim. Buyurtma «yo'lda» qoladi, so'rov «Qaytarish»ga tushadi.
  const handleRequestReturn = useCallback(async (order: PostOrder) => {
    if (
      !postId ||
      !canRequestReturn ||
      requestOrderReturn.isPending ||
      receivePost.isPending ||
      isScanQueueBusyRef.current
    ) {
      return;
    }
    const orderId = order.id;
    const left = orders.filter((item) => item.id !== orderId).length;
    const place = [order.district?.name?.trim(), order.market?.name?.trim()].filter(Boolean);
    const outcome: { result?: RequestOrderReturnResult } = {};
    const confirmed = await confirm({
      tone: "primary",
      icon: RotateCcw,
      title: t("detailPage.requestReturn.title"),
      description: t(
        isOwnBranchTransferPost ? "detailPage.requestReturn.descriptionBranch" : "detailPage.requestReturn.description",
        { id: orderId },
      ),
      details: (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-0.5">
            <span className="font-semibold">
              №{orderId} · {order.customer?.name?.trim() || "—"}
            </span>
            {place.length > 0 ? <span className="text-text-muted">{place.join(" · ")}</span> : null}
          </div>
          <div className="ml-auto flex flex-col gap-0.5 text-right">
            <span className="text-xs text-text-muted">{t("detailPage.requestReturn.amount")}</span>
            <span className="whitespace-nowrap font-semibold">
              {formatMoneyLocalized(Number(order.total_price) || 0, { language })}
            </span>
          </div>
        </div>
      ),
      consequences: [
        // Menejer: so'rov HQ ro'yxatiga tushadi (filialning o'z «Qaytarish»ida ko'rinmaydi — backend HQ doirasida).
        {
          text: t(
            isOwnBranchTransferPost
              ? "detailPage.requestReturn.consequenceRequestBranch"
              : "detailPage.requestReturn.consequenceRequest",
          ),
          tone: "info",
          icon: RotateCcw,
        },
        { text: t("detailPage.requestReturn.consequenceHidden") },
        left > 0
          ? { text: t("detailPage.requestReturn.consequenceRemaining", { value: count(left) }) }
          : { text: t("detailPage.requestReturn.consequenceLast") },
      ],
      confirmLabel: t("detailPage.requestReturn.confirm"),
      confirmIcon: RotateCcw,
      loadingLabel: t("detailPage.requestReturn.loading"),
      errorMessage: (error) => getBackendErrorMessage(error) ?? t("detailPage.requestReturn.error"),
      onConfirm: async () => {
        outcome.result = await requestOrderReturn.mutateAsync({ postId, orderId });
      },
    });
    const result = outcome.result;
    if (!confirmed || !result) return;

    hideHandledOrders([orderId]);
    setReclaimedOrderIds((prev) => {
      if (!prev.has(orderId)) return prev;
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
    void refetchRegularDetail();
    // Backend `remaining_receivable` QR'i shu sahifada skanerlangan (qayta olingan) buyurtmani sanamaydi — serverda u
    // hali so'rovli. Ular ham qo'shiladi: qayta olingan buyurtma kutib turgan bo'lsa sahifa yopilmaydi.
    const reclaimedLeft = orders.filter((item) => item.id !== orderId && reclaimedOrderIds.has(item.id)).length;
    const remaining =
      result.remainingReceivable === null || result.remainingReceivable === undefined
        ? left
        : result.remainingReceivable + reclaimedLeft;
    const title = t(
      result.alreadyRequested ? "detailPage.requestReturn.alreadyRequested" : "detailPage.requestReturn.success",
      { id: orderId },
    );
    const description = remaining === 0 ? t("detailPage.requestReturn.successLast") : undefined;
    if (result.alreadyRequested) notify.info(title, { description });
    else notify.success(title, { description });
    // Skan-qabul navbati hali ketayotgan bo'lsa — sahifada qolinadi (javoblar shu yerda ko'rinadi).
    if (remaining === 0 && !isScanQueueBusyRef.current) handleBack();
  }, [
    postId,
    canRequestReturn,
    isOwnBranchTransferPost,
    requestOrderReturn,
    receivePost.isPending,
    orders,
    reclaimedOrderIds,
    confirm,
    t,
    language,
    count,
    hideHandledOrders,
    refetchRegularDetail,
    handleBack,
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
        (order) => isInPostNow(order) && !sentIds.includes(order.id),
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

  // ─── Eski pochta → «Filialga o'tkazish» ───────────────────────────────────
  // HQ pochtani adashib boshqa filialga jo'natgan, u filial hali qabul qilmagan (pochta «Jo'natilgan», kuryersiz,
  // hamma buyurtma yo'lda): superadmin/admin uni shu viloyatning boshqa filialiga o'tkazadi. Qolgan shartlarni
  // («kelmadi» belgisi, tuman qamrovi, shu orada qabul) backend tekshiradi va matn bilan rad etadi.
  const canTransferPost =
    canReassignPost &&
    isOldDetail &&
    !isEffectiveRefusedDetail &&
    String(postMeta?.status ?? "").toLowerCase() === "sent" &&
    (postCourierId === "" || postCourierId === "0") &&
    Boolean(postBranchId) &&
    // Filial qabul qila boshlagan pochta (birorta buyurtma «kutilmoqda») o'tkazilmaydi — tugma ham yo'q.
    currentOrdersFromPost.length > 0 &&
    currentOrdersFromPost.every((order: PostOrder) => order.status === "on the road");
  const [transferTarget, setTransferTarget] = useState<{ branches: Branch[]; currentName: string | null } | null>(
    null,
  );
  const [isLoadingTransfer, setIsLoadingTransfer] = useState(false);
  const handleOpenTransfer = useCallback(() => {
    if (!canTransferPost || !regionId || isLoadingTransfer) return;
    setIsLoadingTransfer(true);
    getDispatchDestinations({ region_id: String(regionId) })
      .then((response) => {
        const inRegion = (response?.data ?? []).filter(
          (branch) => String(branch.region?.id ?? "") === String(regionId) && branch.status === "active",
        );
        const branches = inRegion.filter((branch) => String(branch.id) !== postBranchId);
        if (branches.length === 0) {
          notify.error(t("common:error"), { description: t("detailPage.transferDialog.noOtherBranch") });
          return;
        }
        const currentName = inRegion.find((branch) => String(branch.id) === postBranchId)?.name ?? null;
        setTransferTarget({ branches, currentName });
      })
      .catch((error: unknown) => {
        notify.error(t("common:error"), {
          description: getBackendErrorMessage(error) ?? t("branchesLoadError"),
        });
      })
      .finally(() => setIsLoadingTransfer(false));
  }, [canTransferPost, regionId, isLoadingTransfer, postBranchId, t]);

  const selectedOrders = useMemo(
    () => orders.filter((order: PostOrder) => selectedIds.has(order.id)),
    [orders, selectedIds],
  );
  // vaICniE4: «Pochta cheki» ish rejimida faqat hozir pochtadagi qatorlardan; javob tarix (`view=all`) bo'lib qolsa
  // server jamlari sobiq a'zolarni ham qo'shgan — jami joriy qatorlardan. Eski pochta (tarix) — server javobicha
  // (pochta cheki va qayta chop etishdagi son — F3-6/F3-7 ega qarori).
  const postReceiptOrders = isOldDetail ? regularOrdersFromPost : currentOrdersFromPost;
  const postReceiptTotals = useMemo<PostTotals | null | undefined>(
    () =>
      !isOldDetail && isHistoryView(regularResponse?.data)
        ? postTotalsFromOrders(currentOrdersFromPost)
        : regularResponse?.data,
    [currentOrdersFromPost, isOldDetail, regularResponse],
  );
  // HJ5sLHiz: «Pochta cheki» (qop uchun) — pochtaning o'z ma'lumoti bor oddiy pochtada (rad etilganda emas).
  const canPrintPostReceipt = Boolean(postId) && !isEffectiveRefusedDetail && postReceiptOrders.length > 0;
  const printOptions = useMailPrintOptions({ withPostReceipt: canPrintPostReceipt });
  // «Chop etish» (tanlanganlar): hech narsa tanlanmasa ham «Pochta cheki» ishlaydi, buyurtma cheklari — o'chiq.
  const selectedPrintOptions = useMailPrintOptions({
    withPostReceipt: canPrintPostReceipt,
    ordersDisabled: selectedIds.size === 0,
  });
  const receiptPrint = useReceiptPrint();
  const runReceiptPrint = receiptPrint.run;

  // Chek (HJ5sLHiz, `features/print-receipts`): buyurtma cheklari — tanlanganlar / barchasi / bitta qator;
  // «Pochta cheki» — pochtaning o'zi (№, qayerga, buyurtmalar soni, jami, kuryer, QR).
  const handlePrintOrders = useCallback(
    (mode: PrintMode, printTargets: PostOrder[], key: string) => {
      if (mode === "post_receipt") {
        if (!postId) return;
        const source = toPostReceiptSource({
          postId,
          post: postMeta,
          orders: postReceiptOrders,
          totals: postReceiptTotals,
          regionName: regionLabel,
        });
        void runReceiptPrint({
          key,
          // Pochta tokeni yo'q — oldindan «Pochta chekida QR yo'q» (buyurtmalardagidek).
          packageWithoutQr: receiptPackageWithoutQr(source),
          print: () => printPostReceipt(source),
        });
        return;
      }
      if (printTargets.length === 0) return;
      void runReceiptPrint({
        key,
        withoutQr: countReceiptsWithoutQr(printTargets),
        print: () => printOrders(mode, printTargets),
      });
    },
    [postId, postMeta, postReceiptOrders, postReceiptTotals, regionLabel, runReceiptPrint],
  );

  const handlePrint = useCallback(
    (mode: PrintMode) => {
      handlePrintOrders(mode, selectedOrders, "selected");
    },
    [handlePrintOrders, selectedOrders],
  );

  // D16: kuryerning rad etilgan pochtasida tanlov yo'q — «Barchasini chop etish» hamma buyurtmani oladi.
  const handlePrintAll = useCallback(
    (mode: PrintMode) => {
      handlePrintOrders(mode, orders, "all");
    },
    [handlePrintOrders, orders],
  );

  const handlePrintOne = useCallback(
    (order: PostOrder, mode: OrderPrintMode) => {
      handlePrintOrders(mode, [order], `row:${order.id}`);
    },
    [handlePrintOrders],
  );
  const printingOrderId = receiptPrint.printingKey?.startsWith("row:")
    ? receiptPrint.printingKey.slice(4)
    : null;

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

  // ─── Yuklanish ────────────────────────────────────────────────────────────
  if (regularLoading || refusedLoading || regionFallbackLoading || refusedRegionFallbackLoading)
    return <MailDetailSkeleton />;

  // ─── Xato ─────────────────────────────────────────────────────────────────
  if (regularError || refusedError) {
    const loadError = regularErrorValue ?? refusedQuery.error;
    const rejection = readBackendRejection(loadError);
    // Kuryer filialga hali qabul qilinmagan o'tkazmani ochdi (#620): kulrang holat, lokal matn, «Qayta urinish»siz.
    const courierHidden =
      rejection.reason === "post_not_visible_to_courier"
        ? coverageRejectionText(t, rejection, { context: "post", fallbackTitle: t("loadError") })
        : null;
    return (
      <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
        <PageHeader
          back={handleBack}
          backLabel={t(MAIL_TAB_LABEL_KEYS[normalizeMailTab(fromTab)])}
          title={t("mailNumberWithId", { id: postId })}
        />
        <ErrorState
          framed
          error={loadError}
          title={courierHidden?.title ?? t("loadError")}
          description={courierHidden?.description}
          onRetry={() => {
            if (regularError) void refetchRegularDetail();
            if (refusedError) void refusedQuery.refetch?.();
          }}
        />
      </div>
    );
  }

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
      ? // Jo'natilgan begona o'tkazma faqat o'qish uchun, lekin «eski» emas (anKpzwxk).
        t(isForeignTransferPost ? "ordersCount" : "oldOrdersCount", { count: orders.length })
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
      disabled={
        (isEffectiveRefusedDetail && (!canReceiveRefusedPost || returnCanceledOrders.isPending)) ||
        requestOrderReturn.isPending ||
        isScanQueueBusy
      }
      isBusy={primaryIsReceive ? isReceiving : isCheckingCouriers}
      block={isCourier && isPhone}
    />
  ) : null;
  // HQ, filial jo'natgan rad etilgan pochta: ikkinchi (secondary) amal — faqat tanlanganlarni qaytarish.
  const returnButton =
    showPrimaryAction && canReturnToSender ? (
      <Button
        variant="secondary"
        leftIcon={RotateCcw}
        aria-haspopup="dialog"
        disabled={selectedCount === 0 || receiveCanceledPost.isPending}
        loading={returnCanceledOrders.isPending}
        loadingText={t("detailPage.returnDialog.loading")}
        onClick={() => void handleReturnToSender()}
        className="max-md:w-full"
      >
        {t("detailPage.returnButton", { value: selectedValue, count: selectedCount })}
      </Button>
    ) : null;

  // Chop etish: tanlanganlar (menyu; telefonda pastki varaqa). Kuryerning rad etilgan pochtasida — barchasi.
  // Hech narsa tanlanmagan: tugma «Pochta cheki» uchun faol (`allowEmpty`), buyurtma cheklari o'chiq (HJ5sLHiz).
  const nothingSelected = selectedCount === 0;
  const renderPrintSelected = (className?: string, compact = false) => (
    <PrintModeSelect
      count={selectedCount}
      allowEmpty={canPrintPostReceipt}
      onSelect={(mode) => handlePrint(mode as PrintMode)}
      buttonLabel={t("print")}
      ariaLabel={
        isCourier && !nothingSelected
          ? t("detailPage.printSelectedLabel", { value: selectedValue, count: selectedCount })
          : undefined
      }
      menuLabel={t("detailPage.printMenuLabel")}
      menuTitle={
        nothingSelected
          ? t("detailPage.printMenuTitleNone")
          : t(isCourier ? "detailPage.printMenuTitleLabels" : "detailPage.printMenuTitle", {
              value: selectedValue,
              count: selectedCount,
            })
      }
      sheetTitle={t("detailPage.printSheetTitle")}
      sheetDescription={
        nothingSelected
          ? t("detailPage.printSheetDescriptionNone")
          : t("detailPage.printSheetDescription", { value: selectedValue, count: selectedCount })
      }
      options={selectedPrintOptions}
      loading={receiptPrint.printingKey === "selected"}
      onOpen={preloadReceiptPrinting}
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
      loading={receiptPrint.printingKey === "all"}
      onOpen={preloadReceiptPrinting}
      className="w-full"
    />
  );

  // Sarlavha amallari: telefonda kuryer uchun yo'q (chop etish — kartada, qabul — pastki panelda).
  const headerActions = isOldDetail
    ? canTransferPost
      ? (
          <Button
            variant="secondary"
            leftIcon={ArrowRightLeft}
            loading={isLoadingTransfer}
            disabled={!regionId}
            onClick={handleOpenTransfer}
            className="max-md:w-full"
          >
            {t("detailPage.transferDialog.open")}
          </Button>
        )
      : null
    : isReadOnlyRefusedCourier
      ? isPhone || orders.length === 0
        ? null
        : printAll
      : isCourier && isPhone
        ? null
        : (
            <div className="flex flex-wrap items-center gap-2 max-md:w-full max-md:flex-col max-md:items-stretch">
              {renderPrintSelected("max-md:w-full")}
              {returnButton}
              {primaryButton}
            </div>
          );

  // Karta: sarlavha, skaner izohi va tanlov izohi rejimga qarab (maketlar).
  const ordersTitle =
    isCourier && !isEffectiveRefusedDetail && !isCourierHistory ? t("detailPage.onTheRoadTitle") : undefined;
  // Boshqa filialning yo'ldagi o'tkazmasi (faqat o'qish) eski pochta emas — sukut «Pochtadagi buyurtmalar».
  const ordersAria = isOldDetail && !isForeignTransferPost
    ? t("detailPage.oldOrdersAria")
    : isEffectiveRefusedDetail
      ? t("detailPage.refusedOrdersAria")
      : undefined;
  const scanHint =
    scannerEnabled && !isEffectiveRefusedDetail
      ? t(
          isScanReceive
            ? "detailPage.scanHintReceive"
            : isCourier
              ? "detailPage.scanHintCourier"
              : isManager
                ? "detailPage.scanHintManager"
                : "detailPage.scanHintStaff",
        )
      : undefined;
  // HQ rad etilgan pochtasi: tanlanmaganlar pochtada qoladi (qaytarish tugmasi bo'lsa — u ham faqat tanlanganlarga).
  const refusedSelectionHintKey = !isHqRefusedFlow
    ? "detailPage.selectionHintRefused"
    : canReturnToSender
      ? "detailPage.selectionHintRefusedHqReturn"
      : "detailPage.selectionHintRefusedHq";
  const refusedAlertTextKey = !isHqRefusedFlow
    ? "detailPage.refusedAlertText"
    : canReturnToSender
      ? "detailPage.refusedAlertTextHqReturn"
      : "detailPage.refusedAlertTextHq";
  const selectionHint = isEffectiveRefusedDetail
    ? t(refusedSelectionHintKey)
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
          {t(refusedAlertTextKey)}
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
        leadCard={
          isScanReceive
            ? "received"
            : isCourier
              ? isOldDetail
                ? "total"
                : isReadOnlyRefusedCourier
                  ? "refused"
                  : "selected"
              : undefined
        }
        selectedSum={selectedSum}
        totalSum={totalSum}
        receivedCount={scanReceivedCount}
        receiveTotal={scanReceiveTotal}
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
        printingOrderId={printingOrderId}
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
        scannerReadyTitle={isScanReceive ? t("detailPage.scannerReadyTitleReceive") : undefined}
        selectionHint={selectionHint}
        columns={tableColumns}
        tabletHidden={tabletHidden}
        orderHref={isCourier ? null : undefined}
        sortable={isCourier}
        cardVariant={isCourier ? "courier" : "default"}
        notice={
          isForeignTransferPost ? (
            <>
              <Info aria-hidden="true" size={16} className="shrink-0 text-text-subtle" />
              <span className="min-w-0" data-testid="mail-receive-destination-only">
                {t("detailPage.receiveDestinationOnly")}
              </span>
            </>
          ) : isReadOnlyRefusedCourier ? (
            <>
              <Info aria-hidden="true" size={16} className="shrink-0 text-text-subtle" />
              <span className="min-w-0">{t("detailPage.courierRefusedNote")}</span>
            </>
          ) : requestedOrders.length > 0 ? (
            <>
              <RotateCcw aria-hidden="true" size={16} className="shrink-0 text-text-subtle" />
              <span className="min-w-0" data-testid="mail-requested-notice">
                {t(isOwnBranchTransferPost ? "detailPage.requestReturn.noticeBranch" : "detailPage.requestReturn.notice", {
                  value: count(requestedOrders.length),
                  ids: requestedOrders.map((order) => `№${order.id}`).join(", "),
                })}
              </span>
            </>
          ) : undefined
        }
        onRequestReturn={canRequestReturn ? (order) => void handleRequestReturn(order) : undefined}
        requestingOrderId={requestOrderReturn.isPending ? (requestOrderReturn.variables?.orderId ?? null) : null}
        requestReturnDisabled={receivePost.isPending || requestOrderReturn.isPending || isScanQueueBusy}
        phoneHeaderAction={isReadOnlyRefusedCourier && isPhone && orders.length > 0 ? printAll : undefined}
        phoneSelectionAction={isCourier && isPhone ? renderPrintSelected("shrink-0", true) : undefined}
        printLabel={isCourier ? (order) => t("detailPage.printRowLabel", { id: order.id }) : undefined}
        search={
          searchMode && orders.length > 0
            ? {
                value: queryDraft,
                query: appliedQuery,
                onValueChange: handleQueryChange,
                active: searchResult.active,
                visible: searchResult.visible,
                byMarket: searchResult.byMarket,
                onSelectRows: setManySelected,
              }
            : undefined
        }
        searchInputRef={searchInputRef}
        alert={
          duplicatesMode && duplicateGroups.length > 0 ? (
            <DuplicatePhonesAlert
              groups={duplicateGroups}
              mode={duplicatesMode}
              activeKey={activeDuplicateKey}
              onToggle={toggleDuplicatePhone}
            />
          ) : undefined
        }
        duplicateNote={duplicatesMode && duplicateGroups.length > 0 ? duplicateNote : undefined}
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

      {/* Eski pochta → boshqa filialga o'tkazish (faqat ochilganda — hook shu yerda chaqiriladi) */}
      {transferTarget && canTransferPost ? (
        <TransferPostBranchModal
          postId={postId ?? ""}
          currentBranchName={transferTarget.currentName}
          branches={transferTarget.branches}
          orderCount={currentOrdersFromPost.length}
          onClose={() => setTransferTarget(null)}
          onSuccess={() => {
            setTransferTarget(null);
            void refetchRegularDetail();
          }}
        />
      ) : null}

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
