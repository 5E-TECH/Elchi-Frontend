import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useOrders } from "../../../entities/orders";
import BackButton from "../../../shared/ui/BackButton";
import HeaderName from "../../../shared/components/headerName";
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  PackageX,
  QrCode,
  ScanLine,
  Send,
  WalletCards,
  XCircle,
} from "lucide-react";
import { extractCancelledOrders } from "./utils";
import QueryErrorState from "../../../shared/ui/QueryErrorState";
import ScannerActionButton from "../../../shared/components/ScannerActionButton";
import ScannerCameraModal from "../../../shared/components/ScannerCameraModal";
import { useOrderQrScanner } from "../../../shared/lib/useOrderQrScanner";
import { normalizeScannerCandidates } from "../../../shared/lib/scanToken";
import { useScannerGate } from "../../../shared/lib/useScannerGate";
import { playMissingOrderFeedback, playScanFeedback } from "../../scan/lib/scanShared";
import { getBackendErrorMessage } from "../../scan/lib/scanResource";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import type { RootState } from "../../../app/config/store";
import type { OrderListItem } from "../../../entities/order/types/order";
import { OrderCard, type ApiOrder } from "../components/OrderCard";

const formatMoney = (value: number, currencyLabel: string) =>
  `${value.toLocaleString("uz-UZ")} ${currencyLabel}`;

type CancelledMarketQr = {
  image?: string;
  token?: string;
  payload?: string;
};

type CancelledHandoverAuthorization = {
  authorizationToken: string;
  expiresAt: number;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }

  return "";
};

const normalizeQrImage = (value: string) => {
  if (!value) return "";
  if (value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  if (value.trim().startsWith("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`;
  }

  return /^[A-Za-z0-9+/=]+$/.test(value) && value.length > 120
    ? `data:image/png;base64,${value}`
    : "";
};

const createQrImageUrl = (value: string) => {
  if (!value.trim()) return "";

  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(value)}`;
};

const normalizeCancelledMarketQr = (response: unknown): CancelledMarketQr => {
  const source = asRecord(response);
  const data = asRecord(source.data ?? source);
  const qr = asRecord(data.qr ?? data.qrCode ?? data.qr_code);
  const image = firstText(
    data.qr_image,
    data.qrImage,
    data.qr_url,
    data.qrUrl,
    data.image,
    data.url,
    qr.image,
    qr.url,
  );
  const token = firstText(
    data.token,
    data.qr_code_token,
    data.qrCodeToken,
    data.qr_token,
    qr.token,
    qr.qr_code_token,
  );
  const payload = firstText(data.payload, data.value, data.code, qr.payload, qr.value, token, image);

  return {
    image: normalizeQrImage(image),
    token,
    payload,
  };
};

const normalizeCancelledAuthorization = (
  response: unknown,
): CancelledHandoverAuthorization => {
  const source = asRecord(response);
  const data = asRecord(source.data ?? source);
  const authorizationToken = firstText(
    data.authorization_token,
    data.authorizationToken,
    data.token,
  );
  const expiresAtText = firstText(data.expires_at, data.expiresAt);
  const expiresAtFromResponse = expiresAtText ? new Date(expiresAtText).getTime() : NaN;
  const remainingSeconds = Number(data.remaining_seconds ?? data.remainingSeconds ?? 300);
  const expiresAt = Number.isFinite(expiresAtFromResponse)
    ? expiresAtFromResponse
    : Date.now() + Math.max(1, remainingSeconds) * 1000;

  if (!authorizationToken) {
    throw new Error("Authorization token is missing");
  }

  return { authorizationToken, expiresAt };
};

const getDecodedScannerText = (rawValue: string) => {
  const candidates = normalizeScannerCandidates(rawValue, window.location.origin);
  return [rawValue, ...candidates].map((item) => item.trim()).filter(Boolean);
};

const parseQrJson = (value: string) => {
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return {};
  }
};

const scannerContainsMarketCancelledQr = (rawValue: string, marketId: string) => {
  const marketKey = String(marketId).toLowerCase();

  return getDecodedScannerText(rawValue).some((candidate) => {
    const text = candidate.toLowerCase();
    if (text.startsWith("mcr-")) {
      return true;
    }

    if (text.includes("cancelled") && text.includes("market") && text.includes(marketKey)) {
      return true;
    }

    const parsed = parseQrJson(candidate);
    const parsedMarketId = firstText(parsed.market_id, parsed.marketId, asRecord(parsed.market).id);
    const parsedType = firstText(parsed.type, parsed.kind, parsed.action);

    return parsedMarketId === marketId && parsedType.toLowerCase().includes("cancel");
  });
};

const extractMarketCancelledQrToken = (rawValue: string) =>
  getDecodedScannerText(rawValue).find((candidate) =>
    candidate.trim().toUpperCase().startsWith("MCR-"),
  ) ?? "";

const toOrderCardData = (order: OrderListItem): ApiOrder => ({
  id: order.id,
  qr_code_token: order.qr_code_token,
  status: order.status,
  where_deliver: order.where_deliver,
  total_price: order.total_price,
  paid_amount: order.paid_amount,
  to_be_paid: order.to_be_paid,
  createdAt: order.createdAt,
  comment: order.comment,
  address: order.address,
  items: order.items.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    product: {
      id: item.product_id,
      name: item.product?.name ?? `#${item.product_id}`,
      image_url: item.product?.image_url ?? null,
    },
  })),
  customer: {
    id: order.customer?.id ?? order.customer_id,
    name: order.customer?.name ?? "—",
    phone_number: order.customer?.phone_number ?? "—",
    district: order.district ? { name: order.district.name } : undefined,
    region: order.district?.region ? { name: order.district.region.name } : undefined,
  },
  district: order.district ? { name: order.district.name } : undefined,
  region: order.district?.region ? { name: order.district.region.name } : undefined,
});

const formatCountdown = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const CancelledMarketDetail = () => {
  const { t } = useTranslation(["newOrders", "orders"]);
  const currencyLabel = t("currency", { ns: "orders" });
  const { api: notificationApi } = useAppNotification();
  const role = useSelector((state: RootState) => state.role.role);
  const { marketId = "" } = useParams();
  const {
    useCancelledOrdersByMarket,
    generateCancelledMarketQr,
    scanMarketCancelledQr,
    handoverCancelledOrders,
  } = useOrders();
  const query = useCancelledOrdersByMarket(marketId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [scanError, setScanError] = useState("");
  const [handoverQr, setHandoverQr] = useState<CancelledMarketQr | null>(null);
  const [isHandoverQrScanned, setIsHandoverQrScanned] = useState(false);
  const [authorizationToken, setAuthorizationToken] = useState("");
  const [authorizationExpiresAt, setAuthorizationExpiresAt] = useState<number | null>(null);
  const [authorizationRemainingSeconds, setAuthorizationRemainingSeconds] = useState(0);
  const rawOrders = useMemo(() => extractCancelledOrders(query.data), [query.data]);
  const orders = useMemo(
    () => rawOrders.filter((order) => !sentIds.has(order.id)),
    [rawOrders, sentIds],
  );
  const selectableOrders = useMemo(
    () => orders,
    [orders],
  );
  const allSelectableSelected =
    selectableOrders.length > 0 &&
    selectableOrders.every((order) => selectedIds.has(order.id));
  const totalAmount = useMemo(
    () => orders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0),
    [orders],
  );
  const scanIndex = useMemo(() => {
    const index = new Map<string, OrderListItem>();

    selectableOrders.forEach((order) => {
      index.set(String(order.id).toLowerCase(), order);
      if (order.qr_code_token?.trim()) {
        index.set(order.qr_code_token.trim().toLowerCase(), order);
      }
    });

    return index;
  }, [selectableOrders]);
  const marketName = rawOrders[0]?.market?.name ?? t("marketName");
  const isMarketRole = role === "market";
  const handoverQrValue = handoverQr?.payload || handoverQr?.token || "";
  const handoverQrImage = handoverQr?.image || createQrImageUrl(handoverQrValue);
  const { canAcceptScan } = useScannerGate({
    cooldownMs: 200,
    duplicateCooldownMs: 1800,
  });

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
    if (selectedIds.has(order.id)) return;

    setSelectedIds((previous) => {
      const next = new Set(previous);
      next.add(order.id);
      return next;
    });
    setScanError("");
    void playScanFeedback("success");
  }, [selectedIds]);

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

    try {
      const response = await scanMarketCancelledQr.mutateAsync(qrToken);
      const authorization = normalizeCancelledAuthorization(response);

      setAuthorizationToken(authorization.authorizationToken);
      setAuthorizationExpiresAt(authorization.expiresAt);
      setSelectedIds(new Set(selectableOrders.map((order) => order.id)));
      setIsHandoverQrScanned(true);
      setScanError("");
      void playScanFeedback("success");
      notificationApi.success({
        message: t("cancelledQrAccepted"),
        description: t("cancelledQrAcceptedDescription", { count: selectableOrders.length }),
        placement: "topRight",
        duration: 3,
      });

      return true;
    } catch (error: unknown) {
      const message = getBackendErrorMessage(error) ?? t("cancelledScanMissing");
      setAuthorizationToken("");
      setAuthorizationExpiresAt(null);
      setIsHandoverQrScanned(false);
      setScanError(message);
      playMissingOrderFeedback();
      notificationApi.error({
        message: t("qrNotFound"),
        description: message,
        placement: "topRight",
        duration: 4,
      });
      return true;
    }
  }, [
    handoverQr?.payload,
    handoverQr?.token,
    isGeneratedQrMatch,
    marketId,
    notificationApi,
    scanMarketCancelledQr,
    selectableOrders,
    t,
  ]);

  const handleMissingOrder = useCallback((rawValue?: string) => {
    if (rawValue && extractMarketCancelledQrToken(rawValue)) {
      void verifyHandoverQr(rawValue);
      return;
    }

    const message = t("cancelledScanMissing");
    setScanError(message);
    playMissingOrderFeedback();
    notificationApi.warning({
      message: t("qrNotFound"),
      description: message,
      placement: "topRight",
      duration: 3,
    });
  }, [notificationApi, t, verifyHandoverQr]);

  useOrderQrScanner({
    orders: selectableOrders,
    enabled: !isMarketRole && !handoverCancelledOrders.isPending && !scanMarketCancelledQr.isPending,
    onMatch: selectOrder,
    onMissing: handleMissingOrder,
  });

  const handleCameraDecode = useCallback(async (rawValue: string) => {
    if (!canAcceptScan(rawValue)) return;

    if (await verifyHandoverQr(rawValue)) {
      setIsCameraOpen(false);
      return;
    }

    const matchedOrder = normalizeScannerCandidates(rawValue, window.location.origin)
      .map((candidate) => scanIndex.get(candidate))
      .find(Boolean);

    if (!matchedOrder) {
      handleMissingOrder(rawValue);
      return;
    }

    selectOrder(matchedOrder);
  }, [canAcceptScan, handleMissingOrder, scanIndex, selectOrder, verifyHandoverQr]);

  const handleSelectChange = useCallback((id: string, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? new Set(selectableOrders.map((order) => order.id)) : new Set());
  }, [selectableOrders]);

  const handleGenerateQr = useCallback(() => {
    if (!marketId || generateCancelledMarketQr.isPending) return;

    generateCancelledMarketQr.mutate(marketId, {
      onSuccess: (response) => {
        setHandoverQr(normalizeCancelledMarketQr(response));
        setIsQrOpen(true);
      },
      onError: (error: unknown) => {
        notificationApi.error({
          message: t("cancelledQrGenerateError"),
          description: getBackendErrorMessage(error) ?? t("cancelledQrGenerateError"),
          placement: "topRight",
          duration: 5,
        });
      },
    });
  }, [generateCancelledMarketQr, marketId, notificationApi, t]);

  const handleSendToMarket = useCallback(() => {
    if (
      selectedIds.size === 0 ||
      handoverCancelledOrders.isPending ||
      !marketId ||
      !isHandoverQrScanned ||
      !authorizationToken
    ) return;
    const orderIds = Array.from(selectedIds);

    handoverCancelledOrders.mutate({ marketId, orderIds, authorizationToken }, {
      onSuccess: () => {
        setSentIds((previous) => new Set([...previous, ...orderIds]));
        setSelectedIds(new Set());
        setAuthorizationToken("");
        setAuthorizationExpiresAt(null);
        setIsHandoverQrScanned(false);
        notificationApi.success({
          message: t("cancelledSendSuccess"),
          description: t("cancelledSendSuccessDescription", { count: orderIds.length }),
          placement: "topRight",
        });
        void query.refetch();
      },
      onError: (error: unknown) => {
        notificationApi.error({
          message: t("cancelledSendError"),
          description: getBackendErrorMessage(error) ?? t("cancelledSendError"),
          placement: "topRight",
          duration: 5,
        });
      },
    });
  }, [
    authorizationToken,
    handoverCancelledOrders,
    isHandoverQrScanned,
    marketId,
    notificationApi,
    query,
    selectedIds,
    t,
  ]);

  return (
    <div className="space-y-5 pb-28 md:pb-6">
      {!isMarketRole && authorizationToken ? (
        <div className="fixed right-4 top-24 z-50 rounded-2xl border border-emerald-300/25 bg-[#172b3a]/95 px-4 py-3 text-emerald-100 shadow-2xl shadow-emerald-500/20 backdrop-blur-xl dark:bg-[#172b3a]/95 sm:right-8">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
            </span>
            <div className="min-w-0">
              <p className="m-0 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200/80">
                {t("cancelledQrActiveTime")}
              </p>
              <p className="m-0 mt-1 font-mono text-3xl font-black leading-none tracking-normal text-white">
                {formatCountdown(authorizationRemainingSeconds)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="relative overflow-hidden rounded-[28px] border border-red-300/20 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_94%,#ef4444_6%)_0%,var(--color-primary)_68%)] p-4 shadow-sm dark:border-red-300/10 dark:bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primarydark)_88%,#ef4444_12%)_0%,var(--color-primarydark)_72%)] sm:p-5">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-red-500/10 blur-3xl dark:bg-red-400/10" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <BackButton
              to="/new-orders/cancelled"
              className="shrink-0 border-red-300/20 bg-white/80 hover:border-red-400/40 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:hover:text-red-300"
              label=""
            />
            <HeaderName
              name={marketName}
              description={t("cancelledMarketDescription", { count: orders.length })}
              icon={<XCircle />}
            />
          </div>
          {isMarketRole ? (
            <button
              type="button"
              onClick={handleGenerateQr}
              disabled={generateCancelledMarketQr.isPending || orders.length === 0}
              className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 text-sm font-black text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
            >
              {generateCancelledMarketQr.isPending ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <QrCode size={17} />
              )}
              {t("cancelledReceiveQrButton")}
            </button>
          ) : (
            <ScannerActionButton
              onClick={() => {
                setScanError("");
                setIsCameraOpen(true);
              }}
              label={t("scanCancelledHandoverQr")}
              showLabel
              className="w-full border-red-300/25! bg-red-500! text-white! shadow-lg! shadow-red-500/20! hover:bg-red-600! dark:text-white! lg:w-auto"
            />
          )}
        </div>
      </section>

      {query.isError ? (
        <QueryErrorState onRetry={() => void query.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              {
                key: "total",
                icon: <PackageX size={18} />,
                label: t("cancelledOrders"),
                value: String(orders.length),
                tone: "text-red-600 dark:text-red-300 bg-red-500/10 dark:bg-red-400/15",
              },
              {
                key: "ready",
                icon: <ScanLine size={18} />,
                label: t("cancelledReadyToSend"),
                value: String(selectableOrders.length),
                tone: "text-amber-600 dark:text-amber-300 bg-amber-500/10 dark:bg-amber-400/15",
              },
              {
                key: "selected",
                icon: <ClipboardCheck size={18} />,
                label: t("cancelledSelected"),
                value: String(selectedIds.size),
                tone: selectedIds.size
                  ? "text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-400/15"
                  : "text-main bg-main/10 dark:bg-main/20 dark:text-white",
              },
              {
                key: "amount",
                icon: <WalletCards size={18} />,
                label: t("totalAmount"),
                value: formatMoney(totalAmount, currencyLabel),
                tone: "text-main bg-main/10 dark:bg-main/20 dark:text-white",
              },
            ].map((item) => (
              <div
                key={item.key}
                className="flex min-w-0 items-center gap-3 rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-3.5 shadow-sm dark:border-white/10 dark:bg-primarydark sm:p-4"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                  {item.icon}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-bold uppercase tracking-[0.13em] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                    {item.label}
                  </span>
                  <strong className="mt-0.5 block truncate text-lg font-black text-maindark dark:text-white">
                    {item.value}
                  </strong>
                </span>
              </div>
            ))}
          </div>

          <section className="overflow-hidden rounded-[28px] border border-[color:var(--color-border-soft)] bg-primary shadow-sm dark:border-white/10 dark:bg-primarydark">
            <div className="flex flex-col gap-4 border-b border-[color:var(--color-border-soft)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-main)_8%,var(--color-primary))_0%,var(--color-primary)_75%)] px-4 py-4 dark:border-white/10 dark:bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-main)_14%,var(--color-primarydark))_0%,var(--color-primarydark)_75%)] sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-main/10 text-main dark:bg-main/20 dark:text-white">
                  <ScanLine size={20} />
                </span>
                <div className="min-w-0">
                  <h3 className="m-0 text-base font-black text-maindark dark:text-white sm:text-lg">
                    {isMarketRole ? t("cancelledMarketQrTitle") : t("cancelledWorkflowTitle")}
                  </h3>
                  <p className="m-0 mt-1 text-xs font-semibold leading-5 text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)] sm:text-sm">
                    {isMarketRole ? t("cancelledMarketQrHint") : t("cancelledScanHint")}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-4 text-sm font-bold text-emerald-700 dark:border-emerald-300/15 dark:text-emerald-200">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                  {isMarketRole
                    ? t("cancelledQrReady")
                    : isHandoverQrScanned
                      ? `${t("cancelledQrScanned")} · ${formatCountdown(authorizationRemainingSeconds)}`
                      : t("cancelledQrRequired")}
                </div>
                {!isMarketRole && selectedIds.size > 0 ? (
                  <span className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-main px-4 text-sm font-black text-white shadow-lg shadow-main/20">
                    {t("cancelledSelectedCount", { count: selectedIds.size })}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="space-y-3 p-3 sm:p-4">
              {!isMarketRole ? (
                <button
                  type="button"
                  onClick={() => handleSelectAll(!allSelectableSelected)}
                  disabled={selectableOrders.length === 0 || handoverCancelledOrders.isPending}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[color:var(--color-border-soft)] bg-white px-3 py-3 text-left transition hover:border-main/30 hover:bg-main/5 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/5 dark:bg-maindark dark:hover:bg-white/5 sm:px-4"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-all ${
                      allSelectableSelected
                        ? "border-main bg-main text-white shadow-sm shadow-main/30"
                        : "border-white/10 bg-white/5 text-gray-300 dark:text-white/45"
                    }`}>
                      <CheckCircle2 size={18} />
                    </span>
                    <span className="truncate text-sm font-bold text-maindark dark:text-white">
                      {allSelectableSelected ? t("deselectAll") : t("selectAll")}
                    </span>
                  </span>
                  {selectedIds.size > 0 ? (
                    <span className="shrink-0 rounded-lg bg-main px-2.5 py-1 text-xs font-black text-white">
                      {t("cancelledSelectedCount", { count: selectedIds.size })}
                    </span>
                  ) : null}
                </button>
              ) : null}
              {query.isLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-main/20 border-t-main" />
                </div>
              ) : orders.length > 0 ? orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={toOrderCardData(order)}
                  isSelected={selectedIds.has(order.id)}
                  onToggle={() => handleSelectChange(order.id, !selectedIds.has(order.id))}
                  showCheckbox={!isMarketRole}
                />
              )) : (
                <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-[color:var(--color-border-soft)] text-sm font-bold text-[color:var(--color-text-muted)] dark:border-white/10 dark:text-[color:var(--color-text-muted-dark)]">
                  {t("noCancelledOrders")}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {!isMarketRole && selectedIds.size > 0 ? (
        <div className="sticky bottom-3 z-40 rounded-[24px] border border-red-300/25 bg-primary/95 p-3 shadow-[0_20px_55px_rgba(239,68,68,0.2)] backdrop-blur-xl dark:border-red-300/15 dark:bg-primarydark/95 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:bg-red-400/15 dark:text-red-300">
                <ClipboardCheck size={19} />
              </span>
              <div className="min-w-0">
                <p className="m-0 text-sm font-black text-maindark dark:text-white">
                  {t("cancelledSelectedCount", { count: selectedIds.size })}
                </p>
                <p className="m-0 mt-0.5 text-xs font-semibold text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                  {isHandoverQrScanned ? t("cancelledSendHint") : t("cancelledSendDisabledHint")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSendToMarket}
              disabled={handoverCancelledOrders.isPending || !isHandoverQrScanned || !authorizationToken}
              className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-red-500 to-red-600 px-5 text-sm font-black text-white shadow-lg shadow-red-500/25 transition hover:-translate-y-0.5 hover:from-red-600 hover:to-red-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:w-auto"
            >
              {handoverCancelledOrders.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {t("sendCancelledToMarket", { count: selectedIds.size })}
            </button>
          </div>
        </div>
      ) : null}

      {isQrOpen && handoverQr ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-primary shadow-2xl dark:bg-primarydark">
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--color-border-soft)] px-5 py-4 dark:border-white/10">
              <div className="min-w-0">
                <h3 className="m-0 text-lg font-black text-maindark dark:text-white">
                  {t("cancelledReceiveQrTitle")}
                </h3>
                <p className="m-0 mt-1 text-sm font-semibold text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                  {t("cancelledReceiveQrHint")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsQrOpen(false)}
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[color:var(--color-border-soft)] text-[color:var(--color-text-muted)] transition hover:border-red-300/40 hover:text-red-500 dark:border-white/10 dark:text-white/70"
                aria-label={t("closeScanner")}
              >
                <XCircle size={18} />
              </button>
            </div>
            <div className="p-5">
              <div className="flex min-h-64 items-center justify-center rounded-3xl border border-dashed border-[color:var(--color-border-soft)] bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                {handoverQrImage ? (
                  <img
                    src={handoverQrImage}
                    alt={t("cancelledReceiveQrTitle")}
                    className="h-64 w-64 max-w-full rounded-2xl bg-white object-contain p-3"
                  />
                ) : (
                  <div className="text-center">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-main/10 text-main dark:bg-white/10 dark:text-white">
                      <QrCode size={38} />
                    </div>
                    <p className="m-0 mt-4 text-sm font-bold text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                      {t("cancelledQrEmpty")}
                    </p>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsQrOpen(false)}
                className="mt-4 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-2xl bg-main px-5 text-sm font-black text-white transition hover:bg-main/90"
              >
                {t("closeScanner")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ScannerCameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onDecode={handleCameraDecode}
        title={t("scanCancelledHandoverQr")}
        subtitle={t("cancelledHandoverScannerSubtitle")}
        waitingText={t("cancelledScanHint")}
        closeLabel={t("closeScanner")}
        torchOnLabel={t("torchOn")}
        torchOffLabel={t("torchOff")}
        invalidQrMessage={t("cancelledScanMissing")}
        loading={handoverCancelledOrders.isPending || scanMarketCancelledQr.isPending}
        loadingText={t("cancelledSending")}
        error={scanError}
      />
    </div>
  );
};

export default memo(CancelledMarketDetail);
