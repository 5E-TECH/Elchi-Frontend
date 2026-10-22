// dizayn-v2: superadmin-neworders-cancelled-handover, superadmin-neworders-cancelled-handover-done, superadmin-neworders-cancelled-manual-dialog, superadmin-neworders-cancelled-scanner-dialog, admin-neworders-cancelled-detail, admin-neworders-cancelled-manual-dialog, admin-neworders-cancelled-scanner-dialog, registrator-new-orders-cancelled-detail, registrator-new-orders-cancelled-manual-dialog, registrator-new-orders-cancelled-scanner-dialog, market-new-orders-cancelled, market-new-orders-cancelled-qr-dialog
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { Trans, useTranslation } from "react-i18next";
import { QrCode, RotateCcw, ScanLine, Send } from "lucide-react";
import { useOrders } from "../../../entities/orders";
import {
  CANCELLED_MANUAL_REASONS,
  DEFAULT_CANCELLED_MANUAL_REASON,
  extractCancelledOrders,
  toCancelledManualReason,
} from "./utils";
import { useOrderQrScanner } from "../../../shared/lib/useOrderQrScanner";
import { scanNotify } from "../../../shared/lib/scanner/scanSession";
import type { ScanTargetListItem } from "../../../shared/lib/scanner/scanTargets";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { playScanFeedback } from "../../../shared/lib/scanner/feedback";
import { getBackendErrorMessage } from "../../scan/lib/scanResource";
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
import { SelectionRegion } from "../../../shared/ui/SelectionRegion";
import {
  canSendHandover,
  extractMarketCancelledQrToken,
  formatCountdown,
  getDecodedScannerText,
  normalizeCancelledAuthorization,
  normalizeCancelledMarketQr,
  resolveHandoverQrStage,
  scannerContainsMarketCancelledQr,
  toOrderCardData,
  type CancelledMarketQr,
} from "./cancelledModel";
import { CancelledOrdersTable } from "./ui/CancelledOrdersTable";
import { HandedOverCard, type HandedOverOrder } from "./ui/HandedOverCard";
import { HandoverStatusAlert } from "./ui/HandoverStatusAlert";
import { ManualConfirmDialog } from "./ui/ManualConfirmDialog";
import { MarketQrDialog } from "./ui/MarketQrDialog";

/**
 * BEKOR QILINGANLARNI MARKETGA TOPSHIRISH — `/new-orders/cancelled/:marketId`, dizayn v2.
 *
 *  - Xodim (superadmin/admin/HQ registratori; qobiq `bare`): «← Bekor qilinganlar» · market nomi ·
 *    «6 ta bekor qilingan buyurtma · jami …», asosiy amal «Marketga jo'natish — N ta». Ostida market QR
 *    holati (`HandoverStatusAlert`: kerak / skanerlandi + taymer / talab qilinmaydi), so'ng karta
 *    «Bekor qilingan buyurtmalarni tayyorlash»: «USB skaner tayyor», tanlov qatori, jadval.
 *  - KAMERA (Trello v1eLN2tV 2-bosqich; maketlar `*-neworders-cancelled-scanner-dialog`,
 *    `superadmin-neworders-cancelled-handover-camera`, `admin-neworders-cancelled-detail-camera`): v1 «Kamera»
 *    tugmalari, sarlavhadagi «Market QR skanerlash» va `ScannerCameraModal` olib tashlandi (ega qarori — oqim
 *    ichida kamera tugmasi yo'q, tizim-scanner §09). Faqat markaziy «Skaner» (desktopda «Skanerlash») shu
 *    sahifaning skan maqsadini ochadi; kamera skani USB bilan aynan bir yo'l (`useOrderQrScanner`: buyurtma QR → tanlov, `MCR-` → market QR
 *    tekshiruvi). Matn holatga qarab: avval «Market QR skanerlash», QR'dan keyin «Buyurtmalarni tanlash · QR 04:12
 *    amal qiladi» — kamera yopilmaydi.
 *  - Market (qobiq `hosted`): karta «Yangi buyurtmalar / Bekor qilinganlar» tablari bilan; «Bekor qilingan
 *    buyurtmalarni pochtaga topshirish» bloki («Qabul qilish» → QR oynasi) va o'z ro'yxati.
 *
 * ⚠️ BIZNES QOIDA (o'zgarmaydi): bekor qilingan buyurtma marketga FAQAT market QR skanerlangach qaytadi
 * (skanerlansa marketning barcha bekorlari tanlanadi va topshirish tokeni olinadi). Buyurtma QR buzilgan
 * bo'lsa — sessiya ichida «QR buzilganini tasdiqlash» oynasi (sabab — backend enum kodi). Marketda QR
 * o'chirilgan bo'lsa (`cancelled_handover_qr_required === false`) — skaner bilan birma-bir tanlanadi.
 * Skaner, ovoz, xabarlar, so'rovlar va yuk (payload) — dizayn v2 gacha bo'lgani AYNAN.
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
    handoverCancelledOrders,
  } = useOrders();
  const query = useCancelledOrdersByMarket(marketId);
  const hasTabs = useHasNewOrdersTabs();
  const hintId = useId();
  const cardTitleId = useId();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [manualSelectedIds, setManualSelectedIds] = useState<Set<string>>(new Set());
  const [manualOverrideReasons, setManualOverrideReasons] = useState<Record<string, string>>({});
  const [manualConfirmOrder, setManualConfirmOrder] = useState<MarketOrder | null>(null);
  const [manualReason, setManualReason] = useState("");
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  // «Topshirildi (N)» — shu sahifada (sessiya ichida) topshirilganlar; sahifa yangilansa tozalanadi.
  const [handedOver, setHandedOver] = useState<HandedOverOrder[]>([]);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [handoverQr, setHandoverQr] = useState<CancelledMarketQr | null>(null);
  const [isHandoverQrScanned, setIsHandoverQrScanned] = useState(false);
  const [authorizationToken, setAuthorizationToken] = useState("");
  const [authorizationExpiresAt, setAuthorizationExpiresAt] = useState<number | null>(null);
  const [authorizationRemainingSeconds, setAuthorizationRemainingSeconds] = useState(0);
  // Market QR ruxsati hozir amaldami (token + skanerlandi) — skan callback'lari uchun sinxron nusxa: kamera QR'dan
  // keyin ochiq qoladi, shu market QR yana o'qilsa ikkinchi so'rov yuborilmaydi (backend «QR allaqachon
  // ishlatilgan» deydi va xato tirik ruxsatni o'chirib yubormasin).
  const authorizationLiveRef = useRef(false);
  useEffect(() => {
    authorizationLiveRef.current = Boolean(authorizationToken) && isHandoverQrScanned;
  }, [authorizationToken, isHandoverQrScanned]);
  const [marketSort, setMarketSort] = useState<DataTableSort | null>(DEFAULT_MARKET_ORDERS_SORT);
  const rawOrders = useMemo(() => extractCancelledOrders(query.data), [query.data]);
  const orders = useMemo(
    () => rawOrders.filter((order) => !sentIds.has(order.id)),
    [rawOrders, sentIds],
  );
  const selectableOrders = useMemo(
    () => orders,
    [orders],
  );
  const isMarketRole = role === "market";
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
  useEffect(() => {
    if (!authorizationToken || !authorizationExpiresAt) {
      setAuthorizationRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      const remainingSeconds = Math.max(0, Math.ceil((authorizationExpiresAt - Date.now()) / 1000));
      setAuthorizationRemainingSeconds(remainingSeconds);

      if (remainingSeconds > 0) return;

      setAuthorizationToken("");
      setAuthorizationExpiresAt(null);
      setIsHandoverQrScanned(false);
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);

    return () => window.clearInterval(timer);
  }, [authorizationExpiresAt, authorizationToken]);

  const selectOrder = useCallback((order: OrderListItem) => {
    if (selectedIds.has(order.id)) {
      void playScanFeedback("duplicate", t("common:scannerFeedbackDuplicate"));
      scanNotify.warning(t("common:scannerFeedbackDuplicate"), { description: `#${order.id}`, duration: 2000 });
      return;
    }

    setSelectedIds((previous) => {
      const next = new Set(previous);
      next.add(order.id);
      return next;
    });
    void playScanFeedback("success", t("cancelled.camera.selected", { id: order.id }));
  }, [selectedIds, t]);

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
      const authorization = normalizeCancelledAuthorization(response);

      authorizationLiveRef.current = Boolean(authorization.authorizationToken);
      setAuthorizationToken(authorization.authorizationToken);
      setAuthorizationExpiresAt(authorization.expiresAt);
      setSelectedIds(new Set(selectableOrders.map((order) => order.id)));
      setIsHandoverQrScanned(true);
      // Oraliq qadam: «Uzluksiz skanerlash» o'chiq bo'lsa ham kamera yopilmaydi — buyurtmalar shu kamerada.
      void playScanFeedback("success", t("cancelled.notify.qrAccepted"), undefined, { step: true });
      scanNotify.success(t("cancelled.notify.qrAccepted"), {
        description: t("cancelled.notify.qrAcceptedDescription", {
          count: selectableOrders.length,
          value: formatNumberLocalized(selectableOrders.length, { language }),
        }),
        duration: 3000,
      });

      return true;
    } catch (error: unknown) {
      const message = getBackendErrorMessage(error) ?? t("cancelled.notify.scanMissing");
      // Shu orada (parallel skan) ruxsat olingan bo'lsa — u o'chirilmaydi.
      if (!authorizationLiveRef.current) {
        setAuthorizationToken("");
        setAuthorizationExpiresAt(null);
        setIsHandoverQrScanned(false);
      }
      void playScanFeedback("missing", message);
      // Skaner oqimi: xato qisqa turadi (v1 dagidek 4 s) — keyingi skanerlashda ekran to'silib qolmasin.
      scanNotify.error(t("cancelled.notify.qrNotFound"), { description: message, duration: 4000 });
      return true;
    }
  }, [
    handoverQr?.payload,
    handoverQr?.token,
    isGeneratedQrMatch,
    language,
    marketId,
    scanMarketCancelledQr,
    selectableOrders,
    t,
  ]);

  const handleMissingOrder = useCallback((rawValue?: string) => {
    if (rawValue && extractMarketCancelledQrToken(rawValue)) {
      void verifyHandoverQr(rawValue);
      return;
    }

    const message = t("cancelled.notify.scanMissing");
    void playScanFeedback("missing", t("cancelled.camera.missing"));
    scanNotify.warning(t("cancelled.notify.qrNotFound"), { description: message, duration: 3000 });
  }, [t, verifyHandoverQr]);

  const confirmManualSelect = useCallback(() => {
    if (!manualConfirmOrder || !canManualSelectDamagedQr || selectedIds.has(manualConfirmOrder.id)) return;

    setSelectedIds((previous) => {
      const next = new Set(previous);
      next.add(manualConfirmOrder.id);
      return next;
    });
    setManualSelectedIds((previous) => {
      const next = new Set(previous);
      next.add(manualConfirmOrder.id);
      return next;
    });
    const reasonCode = toCancelledManualReason(manualReason);
    setManualOverrideReasons((previous) => ({
      ...previous,
      [manualConfirmOrder.id]: reasonCode,
    }));
    notify.warning(t("cancelled.manual.success"), {
      description: `#${manualConfirmOrder.id} · ${getManualReasonLabel(reasonCode)}`,
      duration: 3000,
    });
    setManualConfirmOrder(null);
    setManualReason("");
  }, [canManualSelectDamagedQr, getManualReasonLabel, manualConfirmOrder, manualReason, selectedIds, t]);

  const openManualSelectModal = useCallback((order: MarketOrder) => {
    if (!canManualSelectDamagedQr || selectedIds.has(order.id)) return;
    setManualConfirmOrder(order);
    setManualReason(DEFAULT_CANCELLED_MANUAL_REASON);
  }, [canManualSelectDamagedQr, selectedIds]);

  const toggleManualOrderSelection = useCallback((order: MarketOrder) => {
    if (!canManualSelectDamagedQr) return;

    if (!selectedIds.has(order.id)) {
      openManualSelectModal(order);
      return;
    }

    setSelectedIds((previous) => {
      const next = new Set(previous);
      next.delete(order.id);
      return next;
    });
    setManualSelectedIds((previous) => {
      const next = new Set(previous);
      next.delete(order.id);
      return next;
    });
    setManualOverrideReasons((previous) => {
      const { [order.id]: _removed, ...rest } = previous;
      void _removed;
      return rest;
    });
  }, [canManualSelectDamagedQr, openManualSelectModal, selectedIds]);

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

  const handleSendToMarket = useCallback(() => {
    if (
      selectedIds.size === 0 ||
      handoverCancelledOrders.isPending ||
      !marketId ||
      (isCancelledHandoverQrRequired && (!isHandoverQrScanned || !authorizationToken))
    ) return;
    const orderIds = Array.from(selectedIds);
    const manualOverrides = orderIds
      .filter((orderId) => manualSelectedIds.has(orderId))
      .map((orderId) => ({
        order_id: orderId,
        // Faqat enum kodi — tarjima yoki "QR buzilgan" fallback'i EMAS (FE-RET-05).
        reason: toCancelledManualReason(manualOverrideReasons[orderId]),
      }));

    handoverCancelledOrders.mutate({
      marketId,
      orderIds,
      authorizationToken: isCancelledHandoverQrRequired ? authorizationToken : undefined,
      manualOverrides,
    }, {
      onSuccess: () => {
        const handedAt = Date.now();
        const handedRows = orders
          .filter((order) => selectedIds.has(order.id))
          .map<HandedOverOrder>((order) => ({
            order,
            at: handedAt,
            handover: manualSelectedIds.has(order.id)
              ? { method: "manual", reason: toCancelledManualReason(manualOverrideReasons[order.id]) }
              : { method: isCancelledHandoverQrRequired ? "qr" : "no_qr", reason: null },
          }));
        setHandedOver((previous) => [
          ...handedRows,
          ...previous.filter((row) => !handedRows.some((item) => item.order.id === row.order.id)),
        ]);
        setSentIds((previous) => new Set([...previous, ...orderIds]));
        setSelectedIds(new Set());
        setManualSelectedIds(new Set());
        setManualOverrideReasons({});
        setAuthorizationToken("");
        setAuthorizationExpiresAt(null);
        setIsHandoverQrScanned(false);
        notify.success(t("cancelled.notify.sendSuccess"), {
          description: t("cancelled.notify.sendSuccessDescription", {
            count: orderIds.length,
            value: formatNumberLocalized(orderIds.length, { language }),
          }),
        });
        void query.refetch();
      },
      onError: (error: unknown) => {
        notify.error(t("cancelled.notify.sendError"), {
          description: getBackendErrorMessage(error) ?? t("cancelled.notify.sendError"),
        });
      },
    });
  }, [
    authorizationToken,
    handoverCancelledOrders,
    isCancelledHandoverQrRequired,
    isHandoverQrScanned,
    language,
    marketId,
    manualOverrideReasons,
    manualSelectedIds,
    orders,
    query,
    selectedIds,
    t,
  ]);

  /** Kamera «Bekor qilish»: tanlovdan chiqariladi (jo'natish hali bo'lmagan); qo'lda tasdiq sababi ham olinadi. */
  const deselectOrder = useCallback((orderId: string) => {
    setSelectedIds((previous) => {
      if (!previous.has(orderId)) return previous;
      const next = new Set(previous);
      next.delete(orderId);
      return next;
    });
    setManualSelectedIds((previous) => {
      if (!previous.has(orderId)) return previous;
      const next = new Set(previous);
      next.delete(orderId);
      return next;
    });
    setManualOverrideReasons((previous) => {
      if (!(orderId in previous)) return previous;
      const { [orderId]: _removed, ...rest } = previous;
      void _removed;
      return rest;
    });
  }, []);

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
  const cameraList = useMemo<ScanTargetListItem[]>(
    () =>
      rows
        .filter((order) => selectedIds.has(order.id))
        .map((order) => ({
          key: order.id,
          title: [`№${order.id}`, order.customer?.name?.trim()].filter(Boolean).join(" · "),
          subtitle: manualSelectedIds.has(order.id)
            ? t("cancelled.camera.manualRow")
            : [order.district?.name?.trim() || order.region?.name?.trim(), formatMoneyLocalized(order.total_price, { language })]
                .filter(Boolean)
                .join(" · "),
          tone: manualSelectedIds.has(order.id) ? "warning" : "success",
          onUndo: () => deselectOrder(order.id),
        })),
    [deselectOrder, language, manualSelectedIds, rows, selectedIds, t],
  );
  const qrTime = formatCountdown(authorizationRemainingSeconds);
  // Kamera maqsadi holatga qarab: market QR kutilmoqda → «Market QR skanerlash»; QR skanerlangan yoki talab
  // qilinmaydi → «Buyurtmalarni tanlash» (hisoblagich, ro'yxat, «Tugatish»). Kamera bir maqsadda qoladi (id bir xil).
  const waitingForMarketQr = stage === "required";
  const scannerEnabled = !isMarketRole && !handoverCancelledOrders.isPending && !scanMarketCancelledQr.isPending;
  useOrderQrScanner({
    orders: selectableOrders,
    enabled: !isMarketRole,
    // Server amali ketayotganda skan e'tiborsiz (avvalgidek), lekin ochiq kamera yopilmaydi.
    paused: handoverCancelledOrders.isPending || scanMarketCancelledQr.isPending,
    onMatch: selectOrder,
    onMissing: handleMissingOrder,
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
          progress: { done: selectedIds.size, total: orders.length, label: t("cancelled.camera.meter") },
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
        </Card>
        <MarketQrDialog open={isQrOpen} qr={handoverQr} onClose={() => setIsQrOpen(false)} />
      </>
    );
  }

  const canSend = canSendHandover({
    selectedCount: selectedIds.size,
    pending: false,
    marketId,
    qrRequired: isCancelledHandoverQrRequired,
    qrScanned: isHandoverQrScanned,
    authorizationToken,
  });
  const hasOrders = isLoaded && orders.length > 0;
  const selectedCount = selectedIds.size;

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
        actions={
          <Button
            leftIcon={Send}
            disabled={!canSend}
            aria-describedby={stage === "required" && hasOrders ? hintId : undefined}
            loading={handoverCancelledOrders.isPending}
            loadingText={t("cancelled.sending")}
            onClick={handleSendToMarket}
          >
            {selectedCount > 0
              ? t("cancelled.send", { count: selectedCount, value: number(selectedCount) })
              : t("cancelled.sendNone")}
          </Button>
        }
      />

      {hasOrders ? (
        <HandoverStatusAlert
          stage={stage}
          readyCount={orders.length}
          remainingSeconds={authorizationRemainingSeconds}
          hintId={hintId}
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

        {hasOrders ? (
          <SelectionRegion
            inline
            idle={selectedCount === 0}
            label={t("cancelled.selection.region")}
            title={
              selectedCount > 0
                ? t("cancelled.selection.selected", { count: selectedCount, value: number(selectedCount) })
                : t("cancelled.selection.none")
            }
            hint={
              selectedCount > 0
                ? t("cancelled.selection.hint")
                : stage === "required"
                  ? t("cancelled.selection.noneHintQr")
                  : t("cancelled.selection.noneHintScan")
            }
          />
        ) : null}

        <QueryBoundary
          query={listQuery}
          skeleton="table"
          loadingLabel={t("cancelled.table.loading")}
          empty={
            <EmptyState
              icon={RotateCcw}
              title={t("cancelled.table.emptyTitle")}
              description={t("cancelled.table.emptyDescription")}
            />
          }
          className={hasOrders ? undefined : "border-t border-border"}
        >
          {(list, { isRefetching }) => (
            <CancelledOrdersTable
              variant="handover"
              rows={list}
              label={t("cancelled.table.label")}
              isSelected={(order) => selectedIds.has(order.id)}
              manualReasonOf={(order) =>
                manualSelectedIds.has(order.id)
                  ? getManualReasonLabel(toCancelledManualReason(manualOverrideReasons[order.id]))
                  : null
              }
              canManualSelect={canManualSelectDamagedQr}
              onToggle={toggleManualOrderSelection}
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
        onConfirm={confirmManualSelect}
      />

    </div>
  );
};

export default memo(CancelledMarketDetail);
