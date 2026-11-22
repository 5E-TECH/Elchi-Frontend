// dizayn-v2: superadmin-neworders-cancelled-handover, superadmin-neworders-cancelled-handover-done, superadmin-neworders-cancelled-manual-dialog, superadmin-neworders-cancelled-scanner-dialog, superadmin-neworders-cancelled-pin-dialog, admin-neworders-cancelled-detail, admin-neworders-cancelled-manual-dialog, admin-neworders-cancelled-scanner-dialog, registrator-new-orders-cancelled-detail, registrator-new-orders-cancelled-manual-dialog, registrator-new-orders-cancelled-scanner-dialog, market-new-orders-cancelled, market-new-orders-cancelled-qr-dialog, market-new-orders-cancelled-transit, market-new-orders-cancelled-received
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { Trans, useTranslation } from "react-i18next";
import { CircleCheck, QrCode, RotateCcw, ScanLine } from "lucide-react";
import { useOrders } from "../../../entities/orders";
import type { CancelHandoverInfo } from "../../../entities/order";
import {
  CANCELLED_MANUAL_REASONS,
  DEFAULT_CANCELLED_MANUAL_REASON,
  extractCancelledOrders,
  toCancelledManualReason,
} from "./utils";
import { useOrderQrScanner } from "../../../shared/lib/useOrderQrScanner";
import { isScannerCameraMounted } from "../../../shared/lib/scanner/scannerHost";
import { scanNotify } from "../../../shared/lib/scanner/scanSession";
import type { ScanTargetListItem } from "../../../shared/lib/scanner/scanTargets";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { playScanFeedback } from "../../../shared/lib/scanner/feedback";
import { fetchScanDetail, getBackendErrorMessage } from "../../scan/lib/scanResource";
import { extractScannerToken, normalizeScannerCandidates } from "../../../shared/lib/scanToken";
import type { RootState } from "../../../app/config/store";
import type { OrderListItem } from "../../../entities/order/types/order";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  QueryBoundary,
  Skeleton,
  type DataTableSort,
} from "../../../shared/ui/primitives";
import {
  DEFAULT_MARKET_ORDERS_SORT,
  readMarketName,
  sortMarketOrders,
  sumTotalPrice,
  type MarketOrder,
} from "../components/marketOrders/marketOrdersModel";
import { useHasNewOrdersTabs } from "../model/useNewOrdersTabs";
import NewOrdersTabs from "../ui/NewOrdersTabs";
import {
  extractMarketCancelledQrToken,
  formatCountdown,
  getDecodedScannerText,
  isHandoverPinComplete,
  normalizeCancelledAuthorization,
  normalizeCancelledMarketQr,
  readHandoverPinError,
  resolveHandoverQrStage,
  scannerContainsMarketCancelledQr,
  toOrderCardData,
  type CancelledMarketQr,
  type HandoverAuthMethod,
} from "./cancelledModel";
import { CancelledOrdersTable } from "./ui/CancelledOrdersTable";
import { MarketReturnsChips, MarketReturnsPanel } from "./ui/MarketReturns";
import {
  MARKET_RETURNS_VIEW_KEY,
  parseMarketReturnsView,
  useMarketReturns,
  type MarketReturnsRange,
  type MarketReturnsView,
} from "./useMarketReturns";
import { getThisMonthRange } from "../../../shared/lib/dateRange";
import { HandedOverCard, type HandedOverOrder } from "./ui/HandedOverCard";
import { HandoverStatusAlert } from "./ui/HandoverStatusAlert";
import { ManualConfirmDialog } from "./ui/ManualConfirmDialog";
import { MarketPinDialog } from "./ui/MarketPinDialog";
import { MarketQrDialog } from "./ui/MarketQrDialog";

/** Ochiq topshirish sahifasida bekorlar ro'yxatini yangilash oralig'i (skan auditi #94). */
const CANCELLED_LIST_POLL_MS = 20_000;

/** Topshirish javobidagi `already_handed_order_ids` (backend idempotent topshirish, 2026-11-23). */
const readAlreadyHandedIds = (body: unknown): Set<string> => {
  const data = body && typeof body === "object" ? (body as { data?: unknown }).data : undefined;
  const ids =
    data && typeof data === "object" ? (data as { already_handed_order_ids?: unknown }).already_handed_order_ids : undefined;
  return new Set(Array.isArray(ids) ? ids.map(String) : []);
};

type ScannedOrderLight = {
  id: string;
  status?: string | null;
  market_id?: string | number | null;
  market?: { id?: string | number | null } | null;
};

/** QR qidiruvi javobidagi buyurtma (`{ data: order }` o'ramlari bilan) — id bo'lmasa `null`. */
const unwrapScannedOrder = (payload: unknown): ScannedOrderLight | null => {
  let current: unknown = payload;
  for (let depth = 0; depth < 3; depth += 1) {
    if (!current || typeof current !== "object") return null;
    const record = current as Record<string, unknown>;
    if (record.id !== undefined && record.id !== null && (record.status !== undefined || record.market_id !== undefined)) {
      return { ...(record as ScannedOrderLight), id: String(record.id) };
    }
    current = record.order ?? record.data;
  }
  return null;
};

/**
 * BEKOR QILINGANLARNI MARKETGA TOPSHIRISH — `/new-orders/cancelled/:marketId`, dizayn v2.
 *
 *  - Xodim (superadmin/admin/HQ registratori; qobiq `bare`): «← Bekor qilinganlar» · market nomi ·
 *    «6 ta bekor qilingan buyurtma · jami …». Ostida market QR holati (`HandoverStatusAlert`: kerak / skanerlandi +
 *    taymer / talab qilinmaydi), so'ng karta «Bekor qilingan buyurtmalarni topshirish»: «USB skaner tayyor» va
 *    hali topshirilmaganlar jadvali; pastda «Topshirildi (N)» (`HandedOverCard`).
 *  - KAMERA (Trello v1eLN2tV 2-bosqich; maketlar `*-neworders-cancelled-scanner-dialog`,
 *    `superadmin-neworders-cancelled-handover-camera`, `admin-neworders-cancelled-detail-camera`): oqim ichida kamera
 *    tugmasi yo'q (ega qarori, tizim-scanner §09). Faqat markaziy «Skaner» (desktopda «Skanerlash») shu sahifaning
 *    skan maqsadini ochadi; kamera skani USB bilan aynan bir yo'l (`useOrderQrScanner`: buyurtma QR → topshirish,
 *    `MCR-` → market QR tekshiruvi). Matn holatga qarab: avval «Market QR skanerlash», QR'dan keyin «Marketga
 *    topshirish · QR 04:12 amal qiladi» — kamera yopilmaydi, ro'yxatida topshirilganlar.
 *  - KOD (zkRab9M2, BG6; maket `superadmin-neworders-cancelled-pin-dialog`): «Market QR kerak» holatida «PIN kodni
 *    kiritish» → `MarketPinDialog` — market QR oynasidagi 6 xonali kod `POST scan/market-cancelled { market_id, pin }`
 *    ga; muvaffaqiyat QR skani bilan AYNAN bir xil (`applyAuthorization`: token va taymer), topshirilganlarda usul
 *    «Parol orqali» (`pin`). Oyna ochiq paytda sahifa skaneri to'xtatiladi — 6 raqam + Enter buyurtma skani deb
 *    olinmasin; maydonga skaner yozgan market QR'i esa kod deb yuborilmaydi — QR skani bo'ladi (`scanInPinDialog`),
 *    boshqa skan — maydon ostida xato (urinish yeyilmaydi).
 *  - Market (qobiq `hosted`): karta «Yangi buyurtmalar / Bekor qilinganlar» tablari bilan; «Bekor qilingan
 *    buyurtmalarni pochtaga topshirish» bloki («Qabul qilish» → QR oynasi) va o'z ro'yxati.
 *
 * ⚠️ BIZNES QOIDA (o'zgarmaydi): bekor qilingan buyurtma marketga FAQAT market QR skanerlangach (yoki uning
 * 6 xonali kodi kiritilgach) qaytadi — topshirish tokeni olinadi.
 * ⚠️ SKAN = TOPSHIRISH (ega qarori 2026-11-15, BeePost «Marketga topshirish» naqshi): market QR / kodi hech narsani
 * avtomatik tanlamaydi va «tanlash → Marketga jo'natish» bosqichi YO'Q. Ruxsat (5 daqiqa) ichida har buyurtma QR
 * skani o'sha zahoti bitta so'rov bilan topshiriladi (`complete([id])`, backend ruxsatni ko'p marta qabul qiladi
 * va hammasini bitta «Topshirilgan» partiyasiga yozadi) — qator ro'yxatdan chiqib «Topshirildi» ga o'tadi, xato
 * bo'lsa ro'yxatda qoladi. Ruxsatsiz (QR kerak, hali skanerlanmagan) buyurtma skani — «Avval market QR'ini
 * skanerlang», hech narsa yuborilmaydi. Topshirilganni qayta skanerlash — «Allaqachon topshirilgan». Buyurtma QR
 * buzilgan bo'lsa — ruxsat ichida «QR buzilganini tasdiqlash» oynasi → «Qo'lda topshirish» (sabab — backend enum
 * kodi). Marketda QR o'chirilgan bo'lsa (`cancelled_handover_qr_required === false`) — skan tokensiz topshiradi.
 */
const CancelledMarketDetail = () => {
  const { t, i18n } = useTranslation(["newOrders", "orders", "common"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const role = useSelector((state: RootState) => state.role.role);
  const user = useSelector((state: RootState) => state.user.user);
  const { marketId = "" } = useParams();
  const {
    useCancelledMarkets,
    useCancelledOrdersByMarket,
    generateCancelledMarketQr,
    scanMarketCancelledQr,
    verifyMarketCancelledPin,
    handoverCancelledOrders,
  } = useOrders();
  // Ochiq topshirish sahifasida ro'yxat o'zi yangilanib turadi (skan auditi #94): sahifa ochilgandan keyin HQ'ga
  // qaytgan posilka ham skan qilinganda ro'yxatda bo'ladi. Market roli — kerak emas.
  const query = useCancelledOrdersByMarket(
    marketId,
    role === "market" ? undefined : { refetchInterval: CANCELLED_LIST_POLL_MS },
  );
  const hasTabs = useHasNewOrdersTabs();
  const hintId = useId();
  const cardTitleId = useId();
  const [manualConfirmOrder, setManualConfirmOrder] = useState<MarketOrder | null>(null);
  const [manualReason, setManualReason] = useState("");
  // Topshirilganlar (ro'yxatdan chiqadi) va hozir so'rovi ketayotganlar — skan callback'lari uchun sinxron nusxa
  // ham (`ref`): tez ketma-ket skanda bir buyurtma ikki marta yuborilmasin.
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const sentRef = useRef<Set<string>>(new Set());
  const [handingIds, setHandingIds] = useState<Set<string>>(new Set());
  const handingRef = useRef<Set<string>>(new Set());
  // «Topshirildi (N)» — shu sahifada (sessiya ichida) topshirilganlar; sahifa yangilansa tozalanadi.
  const [handedOver, setHandedOver] = useState<HandedOverOrder[]>([]);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [handoverQr, setHandoverQr] = useState<CancelledMarketQr | null>(null);
  const [isHandoverQrScanned, setIsHandoverQrScanned] = useState(false);
  const [authorizationToken, setAuthorizationToken] = useState("");
  const [authorizationExpiresAt, setAuthorizationExpiresAt] = useState<number | null>(null);
  const [authorizationRemainingSeconds, setAuthorizationRemainingSeconds] = useState(0);
  // zkRab9M2: ruxsat qanday olingan (QR skani yoki 6 xonali kod) — sarlavha va «Topshirildi» usuli uchun.
  const [authorizationMethod, setAuthorizationMethod] = useState<HandoverAuthMethod>("qr");
  const [isPinOpen, setIsPinOpen] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  // Market QR ruxsati hozir amaldami (token + skanerlandi) va uning tokeni — skan callback'lari uchun sinxron nusxa:
  // kamera QR'dan keyin ochiq qoladi, shu market QR yana o'qilsa ikkinchi so'rov yuborilmaydi (backend «QR allaqachon
  // ishlatilgan» deydi va xato tirik ruxsatni o'chirib yubormasin); ruxsat olingan zahoti keyingi skan topshiradi.
  const authorizationLiveRef = useRef(false);
  const authorizationTokenRef = useRef("");
  useEffect(() => {
    authorizationLiveRef.current = Boolean(authorizationToken) && isHandoverQrScanned;
    authorizationTokenRef.current = authorizationToken;
  }, [authorizationToken, isHandoverQrScanned]);
  const [marketSort, setMarketSort] = useState<DataTableSort | null>(DEFAULT_MARKET_ORDERS_SORT);
  const rawOrders = useMemo(() => extractCancelledOrders(query.data), [query.data]);
  const orders = useMemo(
    () => rawOrders.filter((order) => !sentIds.has(String(order.id))),
    [rawOrders, sentIds],
  );
  // Skaner ro'yxati: qolganlar + shu sahifada topshirilganlar — topshirilganni qayta skanerlash «Bu ro'yxatda yo'q»
  // emas, «Allaqachon topshirilgan» bo'lsin (ro'yxat yangilangach u serverdan kelmaydi).
  //
  // Skan auditi #39: indeks — shu sahifada KO'RILGAN barcha buyurtmalar (ro'yxat ∪ topshirilganlar ∪ so'rovi
  // ketayotganlar). Ilgari 5 s dagi qayta so'rov javobi kelmagan (server allaqachon topshirgan) buyurtmani ro'yxatdan
  // olib tashlardi — qayta skan «QR topilmadi», keyin «Allaqachon topshirilgan» derdi. Endi qaror `handOver` da
  // (topshirilmoqda / topshirilgan / server javobi).
  const knownOrdersRef = useRef(new Map<string, OrderListItem>());
  const scanOrders = useMemo(() => {
    const known = knownOrdersRef.current;
    for (const item of rawOrders) known.set(String(item.id), item);
    for (const row of handedOver) known.set(String(row.order.id), row.order);
    return [...known.values()];
  }, [handedOver, rawOrders]);
  const isMarketRole = role === "market";
  // vOczoOUE 2-bosqich (BG3): market — «Olib ketishga tayyor · Yo'lda · Olganlarim» (`?view=`); «Olganlarim» sukut
  // bo'yicha shu oy (topshirish vaqti).
  const [searchParams, setSearchParams] = useSearchParams();
  const returnsView = parseMarketReturnsView(searchParams.get(MARKET_RETURNS_VIEW_KEY));
  const [receivedRange, setReceivedRange] = useState<MarketReturnsRange>(() => getThisMonthRange());
  const returns = useMarketReturns(marketId, { enabled: isMarketRole, range: receivedRange });
  const handleReturnsViewChange = useCallback(
    (view: MarketReturnsView) =>
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (view === "ready") next.delete(MARKET_RETURNS_VIEW_KEY);
          else next.set(MARKET_RETURNS_VIEW_KEY, view);
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );
  // Sarlavhadagi nom: buyurtmadan; ro'yxat bo'sh bo'lsa (hammasi jo'natilgan) — marketlar ro'yxatidan
  // (kalit «Bekor qilinganlar» sahifasi va tab soni bilan umumiy — kesh bitta).
  const nameFromOrders = rawOrders[0]?.market?.name?.trim() || null;
  const marketsQuery = useCancelledMarkets(undefined, {
    enabled: !isMarketRole && query.isSuccess && !nameFromOrders,
  });
  const marketName = nameFromOrders ?? readMarketName([], marketsQuery.data, marketId);
  const isCancelledHandoverQrRequired = isMarketRole
    ? user?.cancelled_handover_qr_required !== false
    : rawOrders[0]?.market?.cancelled_handover_qr_required !== false;
  const canManualSelectDamagedQr =
    role === "superadmin" ||
    role === "admin" ||
    role === "manager" ||
    role === "registrator";
  // Qiymat — backend enum kodi, yorliq — tarjima (fix3 FE-RET-05).
  const manualReasonOptions = useMemo(
    () =>
      CANCELLED_MANUAL_REASONS.map((reason) => ({
        value: reason.value,
        label: t(reason.labelKey),
      })),
    [t],
  );
  const getManualReasonLabel = useCallback(
    (value: string) =>
      manualReasonOptions.find((option) => option.value === value)?.label ?? value,
    [manualReasonOptions],
  );

  /** Ruxsat tugadi (taymer yoki backend 403) — sahifa «Market QR kerak» holatiga qaytadi. */
  const clearAuthorization = useCallback(() => {
    authorizationLiveRef.current = false;
    authorizationTokenRef.current = "";
    setAuthorizationToken("");
    setAuthorizationExpiresAt(null);
    setIsHandoverQrScanned(false);
  }, []);

  useEffect(() => {
    if (!authorizationToken || !authorizationExpiresAt) {
      setAuthorizationRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      const remainingSeconds = Math.max(0, Math.ceil((authorizationExpiresAt - Date.now()) / 1000));
      setAuthorizationRemainingSeconds(remainingSeconds);

      if (remainingSeconds > 0) return;

      clearAuthorization();
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);

    return () => window.clearInterval(timer);
  }, [authorizationExpiresAt, authorizationToken, clearAuthorization]);

  /**
   * Bitta buyurtmani DARHOL marketga topshirish (skan yoki «Qo'lda topshirish»). Har chaqiriq — alohida so'rov
   * (`mutateAsync`: tez ketma-ket skanlarda har biri o'z javobini oladi; `mutate` callback'lari faqat oxirgisiga
   * keladi). Muvaffaqiyat — qator «Topshirildi» ga; xato — qator ro'yxatda qoladi, ruxsat 403 bo'lsa (muddati
   * tugagan / boshqa xodim) — ruxsat tozalanadi va sahifa «Market QR kerak» ni ko'rsatadi.
   */
  const handOver = useCallback(
    async (order: OrderListItem, options: { manualReason?: string } = {}) => {
      const orderId = String(order.id);
      const manualReasonCode = options.manualReason;
      const isManual = manualReasonCode !== undefined;
      if (!marketId) return;

      if (sentRef.current.has(orderId)) {
        const message = t("cancelled.camera.alreadyHanded", { id: orderId });
        void playScanFeedback("duplicate", message);
        if (!isManual) scanNotify.warning(message, { duration: 2000 });
        return;
      }
      // So'rov hali ketmoqda — «topshirilgan» deb aytilmaydi (409/403 bilan qaytishi mumkin); yakuniy natijani
      // ketayotgan so'rovning o'zi bitta ovoz bilan aytadi. Ikkinchi so'rov yuborilmaydi.
      if (handingRef.current.has(orderId)) {
        const message = t("cancelled.camera.handing", { id: orderId });
        // Kamera ochiq bo'lsa toast jim (`scanNotify`) — xabar kamera qatorida, ovozsiz (natija ovozi keyin keladi).
        if (isScannerCameraMounted()) {
          void playScanFeedback("duplicate", message, undefined, { silent: true, step: true });
        } else if (!isManual) {
          scanNotify.info(message, { duration: 1500 });
        }
        return;
      }

      const token = authorizationTokenRef.current;
      if (isCancelledHandoverQrRequired && (!authorizationLiveRef.current || !token)) {
        void playScanFeedback("error", t("cancelled.camera.qrFirst"));
        scanNotify.warning(t("cancelled.notify.qrFirst"), {
          description: t("cancelled.notify.qrFirstDescription"),
          duration: 3000,
        });
        return;
      }

      const handover: CancelHandoverInfo = isManual
        ? { method: "manual", reason: manualReasonCode }
        : { method: isCancelledHandoverQrRequired ? authorizationMethod : "no_qr", reason: null };

      handingRef.current.add(orderId);
      setHandingIds(new Set(handingRef.current));
      try {
        const result = await handoverCancelledOrders.mutateAsync({
          marketId,
          orderIds: [orderId],
          authorizationToken: isCancelledHandoverQrRequired ? token : undefined,
          // Faqat enum kodi — tarjima yoki "QR buzilgan" fallback'i EMAS (FE-RET-05).
          manualOverrides: isManual ? [{ order_id: orderId, reason: manualReasonCode }] : [],
        });
        sentRef.current.add(orderId);
        setSentIds(new Set(sentRef.current));
        setHandedOver((previous) => [
          { order, at: Date.now(), handover },
          ...previous.filter((row) => String(row.order.id) !== orderId),
        ]);
        // Skan auditi #38: server «allaqachon topshirilgan» dedi (oldingi urinish javobi yo'qolgan/kechikkan, yoki
        // boshqa xodim topshirgan) — posilka marketda, xato emas.
        if (readAlreadyHandedIds(result).has(orderId)) {
          const message = t("cancelled.camera.alreadyHanded", { id: orderId });
          void playScanFeedback("duplicate", message);
          if (isManual) notify.warning(message, { duration: 3000 });
          else scanNotify.warning(message, { duration: 2000 });
        } else if (isManual) {
          notify.success(t("cancelled.manual.success"), {
            description: `#${orderId} · ${getManualReasonLabel(manualReasonCode)}`,
            duration: 3000,
          });
        } else {
          void playScanFeedback("success", t("cancelled.camera.handed", { id: orderId }));
        }
      } catch (error: unknown) {
        const title = t("cancelled.notify.handError", { id: orderId });
        const message = getBackendErrorMessage(error) ?? title;
        // Faqat SHU so'rovning tokeni hali joriy bo'lsa: eski (muddati o'tgan) tokenning kechikkan 403 javobi
        // keyin skanerlangan yangi market QR / PIN ruxsatini o'chirmasin (market QR bir martalik).
        if (
          isCancelledHandoverQrRequired &&
          getErrorStatus(error) === 403 &&
          authorizationTokenRef.current === token
        ) {
          clearAuthorization();
        }
        if (isManual) {
          notify.error(title, { description: message });
        } else {
          void playScanFeedback("error", message);
          scanNotify.error(title, { description: message, duration: 4000 });
        }
      } finally {
        handingRef.current.delete(orderId);
        setHandingIds(new Set(handingRef.current));
      }
    },
    [
      authorizationMethod,
      clearAuthorization,
      getManualReasonLabel,
      handoverCancelledOrders,
      isCancelledHandoverQrRequired,
      marketId,
      t,
    ],
  );

  const handleOrderScan = useCallback((order: OrderListItem) => {
    void handOver(order);
  }, [handOver]);

  const isGeneratedQrMatch = useCallback((rawValue: string) => {
    if (!handoverQr) return false;

    const expectedValues = [handoverQr.token, handoverQr.payload]
      .map((value) => value?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value));

    if (expectedValues.length === 0) return false;

    return getDecodedScannerText(rawValue)
      .map((value) => value.toLowerCase())
      .some((value) => expectedValues.includes(value));
  }, [handoverQr]);

  /**
   * Market ruxsati olindi (QR skani yoki 6 xonali kod — javob bir xil): token va taymer. Hech narsa avtomatik
   * tanlanmaydi va yuborilmaydi — ega qarori 2026-11-15 (BeePost naqshi): ilgari shu yerda marketning BARCHA bekorlari
   * tanlanardi va xodim qo'lidagi posilkalarni skanerlamasdan hammasini «topshirilgan» deb yuborardi. Endi faqat
   * jismonan skanerlangani (yoki «QR buzilgan» bilan qo'lda topshirilgani) marketga o'tadi. Token yo'q javob — xato
   * (`normalizeCancelledAuthorization` tashlaydi), holat o'zgarmaydi.
   */
  const applyAuthorization = useCallback((response: unknown, method: HandoverAuthMethod) => {
    const authorization = normalizeCancelledAuthorization(response);

    authorizationLiveRef.current = Boolean(authorization.authorizationToken);
    authorizationTokenRef.current = authorization.authorizationToken;
    setAuthorizationToken(authorization.authorizationToken);
    setAuthorizationExpiresAt(authorization.expiresAt);
    setAuthorizationMethod(method);
    setIsHandoverQrScanned(true);

    const title = method === "pin" ? t("cancelled.notify.pinAccepted") : t("cancelled.notify.qrAccepted");
    const options = { description: t("cancelled.notify.qrAcceptedDescription"), duration: 3000 };
    if (method === "pin") {
      // Kod oynada yozildi — kamera yo'q, oddiy xabar.
      notify.success(title, options);
      return;
    }
    // Oraliq qadam: «Uzluksiz skanerlash» o'chiq bo'lsa ham kamera yopilmaydi — buyurtmalar shu kamerada.
    void playScanFeedback("success", title, undefined, { step: true, voice: "received" });
    scanNotify.success(title, options);
  }, [t]);

  const verifyHandoverQr = useCallback(async (rawValue: string) => {
    if (!marketId) return false;

    const isValid =
      isGeneratedQrMatch(rawValue) ||
      scannerContainsMarketCancelledQr(rawValue, marketId);

    if (!isValid) return false;

    const qrToken = extractMarketCancelledQrToken(rawValue) || handoverQr?.token || handoverQr?.payload || "";
    if (!qrToken) return false;

    // Ruxsat tirik — takror skan: so'rov yo'q, holat o'zgarmaydi.
    if (authorizationLiveRef.current) {
      void playScanFeedback("duplicate", t("cancelled.camera.qrAlreadyAccepted"));
      return true;
    }

    try {
      const response = await scanMarketCancelledQr.mutateAsync(qrToken);
      applyAuthorization(response, "qr");
      return true;
    } catch (error: unknown) {
      const message = getBackendErrorMessage(error) ?? t("cancelled.notify.scanMissing");
      // Shu orada (parallel skan) ruxsat olingan bo'lsa — u o'chirilmaydi.
      if (!authorizationLiveRef.current) clearAuthorization();
      // Market QR o'qildi, lekin server rad etdi (muddati tugagan, ishlatilgan, boshqa market) — bu «Bu ro'yxatda
      // yo'q» EMAS (2026-11-15: xodim «1-skanda ro'yxatda yo'q deydi» deb ko'rdi), xato ovozi va server matni.
      void playScanFeedback("error", message);
      // Skaner oqimi: xato qisqa turadi (v1 dagidek 4 s) — keyingi skanerlashda ekran to'silib qolmasin. Sarlavha —
      // «Market QR rad etildi» (skan auditi #40): QR o'qildi, server rad etdi — «QR topilmadi» emas.
      scanNotify.error(t("cancelled.notify.qrRejected"), { description: message, duration: 4000 });
      return true;
    }
  }, [
    applyAuthorization,
    clearAuthorization,
    handoverQr?.payload,
    handoverQr?.token,
    isGeneratedQrMatch,
    marketId,
    scanMarketCancelledQr,
    t,
  ]);

  const openPinDialog = useCallback(() => {
    setPinValue("");
    setPinError(null);
    setIsPinOpen(true);
  }, []);

  const closePinDialog = useCallback(() => {
    if (verifyMarketCancelledPin.isPending) return;
    setIsPinOpen(false);
  }, [verifyMarketCancelledPin.isPending]);

  const changePin = useCallback((value: string) => {
    setPinValue(value);
    setPinError(null);
  }, []);

  /** Kod → QR skani bilan bir xil ruxsat; xato — maydon ostida (qolgan urinishlar, blok, muddat). */
  const submitPin = useCallback(async () => {
    if (!marketId || verifyMarketCancelledPin.isPending) return;
    if (!isHandoverPinComplete(pinValue)) {
      setPinError(t("cancelled.pin.incomplete"));
      return;
    }

    let response: unknown;
    try {
      response = await verifyMarketCancelledPin.mutateAsync({ marketId, pin: pinValue });
    } catch (error: unknown) {
      const { kind, remainingAttempts } = readHandoverPinError(error);
      setPinError(
        kind === "invalid"
          ? remainingAttempts === null
            ? t("cancelled.pin.invalidPlain")
            : t("cancelled.pin.invalid", {
                count: remainingAttempts,
                value: formatNumberLocalized(remainingAttempts, { language }),
              })
          : kind === "unknown"
            ? (getBackendErrorMessage(error) ?? t("cancelled.pin.error"))
            : t(`cancelled.pin.${kind}`),
      );
      return;
    }

    try {
      applyAuthorization(response, "pin");
    } catch {
      setPinError(t("cancelled.pin.error"));
      return;
    }
    setIsPinOpen(false);
    setPinValue("");
    setPinError(null);
  }, [applyAuthorization, language, marketId, pinValue, t, verifyMarketCancelledPin]);

  /**
   * Kod oynasi ochiq paytda maydonga USB skaner PIN bo'lmagan matn yozdi (`MarketPinDialog`): market QR'i bo'lsa —
   * oyna yopiladi va QR skani bilan aynan bir yo'l (urinish yeyilmaydi); boshqa kod — maydon ostida xato.
   */
  const scanInPinDialog = useCallback((rawValue: string) => {
    if (verifyMarketCancelledPin.isPending) return;
    setPinValue("");
    if (extractMarketCancelledQrToken(rawValue)) {
      setPinError(null);
      setIsPinOpen(false);
      void verifyHandoverQr(rawValue);
      return;
    }
    setPinError(t("cancelled.pin.scanned"));
  }, [t, verifyHandoverQr, verifyMarketCancelledPin.isPending]);

  const showScanMissing = useCallback(() => {
    const message = t("cancelled.notify.scanMissing");
    void playScanFeedback("missing", t("cancelled.camera.missing"));
    scanNotify.warning(t("cancelled.notify.qrNotFound"), { description: message, duration: 3000 });
  }, [t]);

  /** Ro'yxat bir vaqtda bir marta qayta so'raladi (ketma-ket topilmagan skanlar bitta so'rovni kutadi). */
  const missRefetchRef = useRef<Promise<unknown> | null>(null);
  const missLookupKeysRef = useRef(new Set<string>());
  const refetchList = query.refetch;

  /**
   * Ro'yxatda yo'q kod (skan auditi #37/#94): ilgari darhol «QR topilmadi» edi — sahifa ochilgandan keyin
   * topshirishga tayyor bo'lgan (HQ'ga qaytgan) posilka ham. Endi:
   *   1) ro'yxat bir marta yangilanadi va kod qayta moslanadi — topilsa odatdagidek topshiriladi;
   *   2) aks holda server aytadi: allaqachon topshirilgan / boshqa market / hali tayyor emas / bekor emas;
   *   3) 404 — «QR topilmadi»; tarmoq/5xx — «Tekshirib bo'lmadi» (hisobga «yo'q» deb yozilmaydi).
   */
  const handleMissingOrder = useCallback(async (rawValue?: string) => {
    if (rawValue && extractMarketCancelledQrToken(rawValue)) {
      void verifyHandoverQr(rawValue);
      return;
    }
    const raw = rawValue ?? "";
    const code = extractScannerToken(raw) ?? raw.trim();
    const lookupKey = code.toLowerCase();
    if (!code) {
      showScanMissing();
      return;
    }
    if (missLookupKeysRef.current.has(lookupKey)) return;
    missLookupKeysRef.current.add(lookupKey);
    try {
      missRefetchRef.current ??= Promise.resolve(refetchList?.()).finally(() => {
        missRefetchRef.current = null;
      });
      const refetched = (await missRefetchRef.current) as { data?: unknown } | undefined;
      const candidates = new Set(normalizeScannerCandidates(raw, window.location.origin));
      const fresh = extractCancelledOrders(refetched?.data).find(
        (item) =>
          candidates.has(String(item.id).toLowerCase()) ||
          candidates.has(String(item.qr_code_token ?? "").trim().toLowerCase()),
      );
      if (fresh) {
        knownOrdersRef.current.set(String(fresh.id), fresh);
        void handOver(fresh);
        return;
      }

      const detail = await fetchScanDetail(code, { light: true, orderOnly: true });
      const scanned = detail.type === "order" ? unwrapScannedOrder(detail.data) : null;
      if (!scanned) {
        showScanMissing();
        return;
      }
      const scannedId = String(scanned.id);
      const scannedMarketId = String(scanned.market_id ?? scanned.market?.id ?? "").trim();
      const status = String(scanned.status ?? "").trim().toLowerCase();
      if (scannedMarketId && scannedMarketId !== String(marketId)) {
        const message = t("cancelled.notify.otherMarket", { id: scannedId });
        void playScanFeedback("error", message);
        scanNotify.error(message, { duration: 3000 });
        return;
      }
      if (status === "returned_to_market") {
        const message = t("cancelled.camera.alreadyHanded", { id: scannedId });
        void playScanFeedback("duplicate", message);
        scanNotify.warning(message, { duration: 2000 });
        return;
      }
      const message = status === "cancelled"
        ? t("cancelled.notify.notReady", { id: scannedId })
        : t("cancelled.notify.notCancelled", { id: scannedId });
      void playScanFeedback("error", message);
      scanNotify.warning(message, {
        description: status === "cancelled" ? t("cancelled.notify.notReadyDescription") : undefined,
        duration: 4000,
      });
    } catch (error) {
      if (getErrorStatus(error) === 404) {
        showScanMissing();
        return;
      }
      const message = t("cancelled.notify.checkFailed");
      void playScanFeedback("error", message);
      scanNotify.error(message, { description: code, duration: 3000 });
    } finally {
      missLookupKeysRef.current.delete(lookupKey);
    }
  }, [handOver, marketId, refetchList, showScanMissing, t, verifyHandoverQr]);

  // Market QR / kod tekshirilayotganda kelgan skan — jim yo'qolmaydi (skan auditi #42).
  const handlePausedScan = useCallback(() => {
    const message = t("cancelled.notify.waitAuth");
    void playScanFeedback("error", message);
    scanNotify.warning(message, { duration: 2500 });
  }, [t]);

  /** «Qo'lda topshirish»: oyna yopiladi va buyurtma sabab bilan darhol topshiriladi (qator «Topshirilmoqda…»). */
  const confirmManualHandover = useCallback(() => {
    if (!manualConfirmOrder || !canManualSelectDamagedQr) return;
    const orderId = String(manualConfirmOrder.id);
    const order = rawOrders.find((item) => String(item.id) === orderId);
    const reasonCode = toCancelledManualReason(manualReason);
    setManualConfirmOrder(null);
    setManualReason("");
    if (order) void handOver(order, { manualReason: reasonCode });
  }, [canManualSelectDamagedQr, handOver, manualConfirmOrder, manualReason, rawOrders]);

  const openManualSelectModal = useCallback((order: MarketOrder) => {
    const orderId = String(order.id);
    if (!canManualSelectDamagedQr || sentRef.current.has(orderId) || handingRef.current.has(orderId)) return;
    setManualConfirmOrder(order);
    setManualReason(DEFAULT_CANCELLED_MANUAL_REASON);
  }, [canManualSelectDamagedQr]);

  const closeManualSelectModal = useCallback(() => {
    setManualConfirmOrder(null);
    setManualReason("");
  }, []);

  const handleGenerateQr = useCallback(() => {
    if (!marketId || generateCancelledMarketQr.isPending) return;

    generateCancelledMarketQr.mutate(marketId, {
      onSuccess: (response) => {
        setHandoverQr(normalizeCancelledMarketQr(response));
        setIsQrOpen(true);
      },
      onError: (error: unknown) => {
        notify.error(t("cancelled.notify.qrGenerateError"), {
          description: getBackendErrorMessage(error) ?? t("cancelled.notify.qrGenerateError"),
        });
      },
    });
  }, [generateCancelledMarketQr, marketId, t]);

  // ─── Ko'rinish ───────────────────────────────────────────────────────────────
  const rows = useMemo<MarketOrder[]>(() => orders.map(toOrderCardData), [orders]);
  const marketRows = useMemo(() => sortMarketOrders(rows, marketSort), [marketSort, rows]);
  const totalSum = sumTotalPrice(rows);
  const isLoaded = query.data !== undefined;
  const number = (value: number) => formatNumberLocalized(value, { language });
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const ordersCountLabel = t("cancelled.ordersCount", { count: orders.length, value: number(orders.length) });
  const titleText = marketName ?? t("cancelled.titleFallback");

  const listQuery = { ...query, data: isLoaded ? rows : undefined };

  const stage = resolveHandoverQrStage({
    qrRequired: isCancelledHandoverQrRequired,
    qrScanned: isHandoverQrScanned,
    authorizationToken,
  });
  const cameraMarket = marketName ?? t("cancelled.titleFallback");
  const cameraCount = number(orders.length);
  // Kamera ro'yxati — shu sahifada topshirilganlar (yangisi tepada); «Bekor qilish» yo'q: topshirish server amali.
  const cameraList = useMemo<ScanTargetListItem[]>(
    () =>
      handedOver.map(({ order, handover }) => {
        const card = toOrderCardData(order);
        const isManual = handover.method === "manual";
        return {
          key: String(order.id),
          title: [`№${order.id}`, card.customer?.name?.trim()].filter(Boolean).join(" · "),
          subtitle: isManual
            ? t("cancelled.camera.manualRow")
            : [card.district?.name?.trim() || card.region?.name?.trim(), formatMoneyLocalized(card.total_price, { language })]
                .filter(Boolean)
                .join(" · "),
          tone: isManual ? "warning" : "success",
        };
      }),
    [handedOver, language, t],
  );
  const qrTime = formatCountdown(authorizationRemainingSeconds);
  // Kamera maqsadi holatga qarab: market QR kutilmoqda → «Market QR skanerlash»; QR skanerlangan yoki talab
  // qilinmaydi → «Marketga topshirish» (hisoblagich, topshirilganlar, «Tugatish»). Kamera bir maqsadda qoladi (id bir xil).
  const waitingForMarketQr = stage === "required";
  const scannerEnabled = !isMarketRole && !scanMarketCancelledQr.isPending;
  useOrderQrScanner({
    orders: scanOrders,
    enabled: !isMarketRole,
    // Market QR / kod tekshirilayotganda skan e'tiborsiz (ochiq kamera yopilmaydi). Kod oynasi ochiq paytda ham —
    // 6 raqam + Enter buyurtma skani deb olinmasin (oyna o'zi ham `data-scanner-ignore`). Topshirish so'rovi
    // ketayotganda esa TO'XTAMAYDI — skan = topshirish, xodim ketma-ket skanerlayveradi.
    paused: scanMarketCancelledQr.isPending || verifyMarketCancelledPin.isPending || isPinOpen,
    onPausedScan: handlePausedScan,
    // Ro'yxat bo'sh yoki yuklanayotganda ham USB tinglaydi — kod serverdan tekshiriladi (skan auditi #42).
    keyboardWhenEmpty: true,
    onMatch: handleOrderScan,
    onMissing: (rawValue: string) => {
      void handleMissingOrder(rawValue);
    },
    camera: waitingForMarketQr
      ? {
          id: `cancelled-handover:${marketId}`,
          title: t("cancelled.camera.qrTitle"),
          context: t("cancelled.camera.qrContext", { market: cameraMarket, value: cameraCount }),
          hint: t("cancelled.camera.qrHint"),
          note: { title: t("cancelled.camera.qrNoteTitle", { market: cameraMarket }), text: t("cancelled.camera.qrNoteText") },
          icon: QrCode,
        }
      : {
          id: `cancelled-handover:${marketId}`,
          title: t("cancelled.camera.selectTitle"),
          context: t("cancelled.camera.selectContext", { market: cameraMarket, value: cameraCount }),
          hint: stage === "scanned" ? t("cancelled.camera.selectHintQr", { time: qrTime }) : undefined,
          note: {
            title: t("cancelled.camera.selectNoteTitle"),
            text:
              stage === "scanned"
                ? t("cancelled.camera.selectNoteTextQr", { market: cameraMarket, time: qrTime })
                : t("cancelled.camera.selectNoteText", { market: cameraMarket }),
          },
          progress: {
            done: handedOver.length,
            total: handedOver.length + orders.length,
            label: t("cancelled.camera.meter"),
          },
          list: cameraList,
          listTitle: t("cancelled.camera.listTitle"),
          finish: { label: t("ui:camera.action.finish"), onFinish: () => undefined },
        },
  });

  // Market — sarlavha va sahifa ildizi qobiqda (`hosted`); karta tablar bilan boshlanadi.
  if (isMarketRole) {
    const regionTitleId = `${cardTitleId}-handover`;
    return (
      <>
        <Card
          as="section"
          padding="none"
          aria-label={hasTabs ? t("cancelled.market.cardLabel") : undefined}
          title={hasTabs ? undefined : t("cancelled.market.headTitle")}
        >
          <NewOrdersTabs />
          <MarketReturnsChips
            value={returnsView}
            counts={{
              ready: isLoaded ? orders.length : null,
              transit: returns.transit.total,
              received: returns.received.total,
            }}
            onChange={handleReturnsViewChange}
          />
          {returnsView === "transit" ? (
            <MarketReturnsPanel
              view="transit"
              query={returns.transit.query}
              rows={returns.transit.rows}
              truncated={returns.transit.truncated}
            />
          ) : returnsView === "received" ? (
            <MarketReturnsPanel
              view="received"
              query={returns.received.query}
              rows={returns.received.rows}
              truncated={returns.received.truncated}
              range={receivedRange}
              onRangeChange={setReceivedRange}
            />
          ) : (
            <>
              <div className="px-4 pt-4 pb-3">
                <div
                  role="region"
                  aria-labelledby={regionTitleId}
                  className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-xl bg-sunken p-4"
                >
                  <div className="flex min-w-0 flex-[1_1_380px] items-start gap-3.5">
                    <span
                      aria-hidden="true"
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-muted"
                    >
                      <ScanLine size={20} />
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <h2 id={regionTitleId} className="text-base font-bold text-text">
                        {isCancelledHandoverQrRequired
                          ? t("cancelled.market.handoverTitle")
                          : t("cancelled.market.notRequiredTitle")}
                      </h2>
                      <p className="text-[13px] text-text-muted">
                        {isCancelledHandoverQrRequired
                          ? t("cancelled.market.handoverHint")
                          : t("cancelled.market.notRequiredHint")}
                      </p>
                    </div>
                  </div>
                  {isCancelledHandoverQrRequired ? (
                    <div className="flex flex-[0_1_auto] flex-wrap items-center gap-x-4 gap-y-3 max-md:w-full">
                      <Badge tone="success" dot role="status">
                        {t("cancelled.market.qrReady")}
                      </Badge>
                      {/* Bekor buyurtma bo'lmasa ham yoqiq: shu QR qaytarilgan buyurtmani «Marketga topshirildi» (CidJqG5a) uchun ham kerak. */}
                      <Button
                        variant="secondary"
                        leftIcon={QrCode}
                        aria-haspopup="dialog"
                        loading={generateCancelledMarketQr.isPending}
                        onClick={handleGenerateQr}
                        className="flex-[1_0_auto] max-md:w-full"
                      >
                        {t("cancelled.market.receive")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 pt-1 pb-4 max-md:px-4">
                <h3 className="text-sm font-semibold text-text">{t("cancelled.market.listTitle")}</h3>
                {isLoaded && orders.length > 0 ? (
                  <p className="text-[13px] text-text-muted">
                    <span className="whitespace-nowrap">
                      <Trans
                        t={t}
                        i18nKey="cancelled.market.summary"
                        count={orders.length}
                        values={{ value: number(orders.length) }}
                        components={{ strong: <strong className="font-semibold text-text" /> }}
                      />
                    </span>
                    {" · "}
                    <span className="whitespace-nowrap">
                      <Trans
                        t={t}
                        i18nKey="cancelled.market.summaryTotal"
                        values={{ sum: money(totalSum) }}
                        components={{ strong: <strong className="font-semibold text-text" /> }}
                      />
                    </span>
                  </p>
                ) : null}
              </div>
              <QueryBoundary
                query={listQuery}
                skeleton="table"
                loadingLabel={t("cancelled.table.loading")}
                empty={
                  <EmptyState
                    icon={RotateCcw}
                    title={t("cancelled.table.emptyTitle")}
                    description={t("cancelled.table.marketEmptyDescription")}
                  />
                }
                className="border-t border-border"
              >
                {(_list, { isRefetching }) => (
                  <CancelledOrdersTable
                    variant="market"
                    rows={marketRows}
                    label={t("cancelled.table.label")}
                    sort={marketSort}
                    onSortChange={setMarketSort}
                    busy={isRefetching}
                  />
                )}
              </QueryBoundary>
            </>
          )}
        </Card>
        <MarketQrDialog open={isQrOpen} qr={handoverQr} onClose={() => setIsQrOpen(false)} />
      </>
    );
  }

  const hasOrders = isLoaded && orders.length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        back="/new-orders/cancelled"
        backLabel={t("cancelledTab")}
        title={marketName ?? (query.isLoading ? <Skeleton width={224} height={32} /> : titleText)}
        description={
          isLoaded ? (
            <>
              <span className="whitespace-nowrap">{ordersCountLabel}</span> ·{" "}
              <span className="whitespace-nowrap">{t("cancelled.total", { sum: money(totalSum) })}</span>
            </>
          ) : null
        }
      />

      {hasOrders ? (
        <HandoverStatusAlert
          stage={stage}
          remainingSeconds={authorizationRemainingSeconds}
          hintId={hintId}
          method={authorizationMethod}
          onPinClick={openPinDialog}
        />
      ) : null}

      <Card as="section" padding="none" aria-labelledby={cardTitleId}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 max-md:px-4">
          <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-0.5">
            <h2 id={cardTitleId} className="text-base font-bold text-text">
              {t("cancelled.card.title")}
            </h2>
            <p className="text-[13px] leading-[18px] text-text-muted">
              {canManualSelectDamagedQr ? t("cancelled.card.hint") : t("cancelled.card.hintScanOnly")}
            </p>
          </div>
          {scannerEnabled ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 max-md:hidden">
              <Badge
                tone="success"
                dot
                role="status"
                title={stage === "required" ? t("cancelled.card.scannerMarketTitle") : t("cancelled.card.scannerOrderTitle")}
              >
                {t("cancelled.card.scannerReady")}
              </Badge>
            </div>
          ) : null}
        </div>

        <QueryBoundary
          query={listQuery}
          skeleton="table"
          loadingLabel={t("cancelled.table.loading")}
          empty={
            handedOver.length > 0 ? (
              <EmptyState
                icon={CircleCheck}
                title={t("cancelled.table.allHandedTitle")}
                description={t("cancelled.table.allHandedDescription", {
                  count: handedOver.length,
                  value: number(handedOver.length),
                })}
              />
            ) : (
              <EmptyState
                icon={RotateCcw}
                title={t("cancelled.table.emptyTitle")}
                description={t("cancelled.table.emptyDescription")}
              />
            )
          }
          className="border-t border-border"
        >
          {(list, { isRefetching }) => (
            <CancelledOrdersTable
              variant="handover"
              rows={list}
              label={t("cancelled.table.label")}
              isHanding={(order) => handingIds.has(String(order.id))}
              canManualSelect={canManualSelectDamagedQr}
              // Qo'lda topshirish ham market ruxsati bilan (backend token so'raydi) — QR kutilayotganda o'chiq.
              manualDisabled={stage === "required"}
              manualDisabledHint={t("cancelled.notify.qrFirst")}
              onManualSelect={openManualSelectModal}
              busy={isRefetching}
            />
          )}
        </QueryBoundary>
      </Card>

      {handedOver.length > 0 ? <HandedOverCard rows={handedOver} /> : null}

      <ManualConfirmDialog
        order={manualConfirmOrder}
        reason={manualReason}
        onReasonChange={setManualReason}
        onCancel={closeManualSelectModal}
        onConfirm={confirmManualHandover}
      />

      <MarketPinDialog
        open={isPinOpen}
        marketName={titleText}
        value={pinValue}
        onValueChange={changePin}
        error={pinError}
        pending={verifyMarketCancelledPin.isPending}
        onSubmit={() => void submitPin()}
        onScan={scanInPinDialog}
        onClose={closePinDialog}
      />
    </div>
  );
};

export default memo(CancelledMarketDetail);
