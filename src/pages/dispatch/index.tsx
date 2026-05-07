import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  LockKeyhole,
  PackagePlus,
  QrCode,
  Trash2,
  Truck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import HeaderName from "../../shared/components/headerName";
import SearchableSelect from "../../shared/ui/SearchableSelect";
import QrScanner from "../../shared/lib/qrScanner";
import { useKeyboardScanner } from "../../shared/lib/useKeyboardScanner";
import { useScannerGate } from "../../shared/lib/useScannerGate";
import { extractScannerToken } from "../../shared/lib/scanToken";
import { fetchScanDetail, getScanResourceType, getBackendErrorMessage } from "../scan/lib/scanResource";
import { playScanFeedback } from "../scan/lib/scanShared";
import { useAppNotification } from "../../app/providers/notification/NotificationProvider";
import { useOrders } from "../../entities/order/api/orderApi";
import EmptyState from "../../shared/ui/EmptyState";
import { useUser } from "../../entities/user/api/userApi";

type PendingOrder = {
  id: string;
  token: string;
  market: string;
  amount: number;
};

type BackendOrderError = {
  order_id?: string | number;
  orderId?: string | number;
  id?: string | number;
  token?: string;
  message?: string;
  error?: string;
};

const safe = (value: unknown, fallback = "—") => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
};

const formatMoney = (value: number) => `${value.toLocaleString("uz-UZ")} so'm`;

const extractList = (payload: unknown): any[] => {
  const source = payload as Record<string, any>;
  if (Array.isArray(source)) return source;
  if (Array.isArray(source?.data?.data)) return source.data.data;
  if (Array.isArray(source?.data)) return source.data;
  if (Array.isArray(source?.data?.items)) return source.data.items;
  if (Array.isArray(source?.data?.couriers)) return source.data.couriers;
  if (Array.isArray(source?.data?.rows)) return source.data.rows;
  if (Array.isArray(source?.data?.results)) return source.data.results;
  if (Array.isArray(source?.items)) return source.items;
  if (Array.isArray(source?.couriers)) return source.couriers;
  if (Array.isArray(source?.rows)) return source.rows;
  if (Array.isArray(source?.results)) return source.results;
  return [];
};

const normalizeCourierOption = (value: unknown) => {
  const item = value as Record<string, any>;
  const user = (
    item.user ??
    item.employee ??
    item.courier ??
    item.identity_user ??
    item.identityUser ??
    item.profile ??
    item
  ) as Record<string, any>;
  const id = safe(user.id ?? item.user_id ?? item.userId ?? item.courier_id ?? item.courierId ?? item.id, "");
  const label = safe(
    user.fullName ??
      user.full_name ??
      user.name ??
      user.username ??
      item.fullName ??
      item.full_name ??
      item.name ??
      item.username ??
      item.phone_number ??
      item.phone,
    "",
  );

  if (!id || !label) return null;

  return {
    value: id,
    label,
  };
};

const normalizeOrder = (payload: unknown, token: string, t: (key: string) => string): PendingOrder => {
  const source = payload as Record<string, any>;
  const responseData = source?.data ?? source;
  const order = responseData?.data ?? responseData?.order ?? responseData;

  return {
    id: safe(order?.id),
    token,
    market: safe(order?.market?.name ?? order?.sender?.name, t("marketFallback")),
    amount: Number(order?.total_price ?? 0) || 0,
  };
};

const getDispatchErrorMessage = (error: unknown, fallback: string) => {
  const responseData = (error as { response?: { data?: any } } | null)?.response?.data;
  const errors = responseData?.errors ?? responseData?.failed ?? responseData?.items;

  if (Array.isArray(errors) && errors.length) {
    return errors
      .map((item: BackendOrderError) => {
        const orderLabel = item.order_id ?? item.orderId ?? item.id ?? item.token ?? "order";
        const message = item.message ?? item.error ?? fallback;
        return `${orderLabel}: ${message}`;
      })
      .join("; ");
  }

  return getBackendErrorMessage(error) ?? fallback;
};

const DispatchPage = () => {
  const { t } = useTranslation("dispatch");
  const { api: notificationApi } = useAppNotification();
  const { assignCourier } = useOrders();
  const { getCouriers } = useUser();
  const courierParams = useMemo(
    () => ({
      page: 1,
      limit: 200,
    }),
    [],
  );
  const {
    data: couriersResponse,
    isLoading: isCouriersLoading,
    isError: isCouriersError,
    refetch: refetchCouriers,
  } = getCouriers(courierParams);

  const couriers = useMemo(
    () =>
      extractList(couriersResponse)
        .map(normalizeCourierOption)
        .filter((courier): courier is { value: string; label: string } => Boolean(courier)),
    [couriersResponse],
  );

  const courierMap = useMemo(
    () => new Map(couriers.map((courier) => [courier.value, courier.label])),
    [couriers],
  );

  const [selectedCourierId, setSelectedCourierId] = useState("");
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [scanError, setScanError] = useState("");
  const [isLookingUpOrder, setIsLookingUpOrder] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const pendingTokensRef = useRef<Set<string>>(new Set());
  const lookupTokensRef = useRef<Set<string>>(new Set());
  const { canAcceptScan, blockScans, resetScannerGate } = useScannerGate({
    cooldownMs: 1000,
    duplicateCooldownMs: 2600,
  });

  const selectedCourierName = selectedCourierId ? (courierMap.get(selectedCourierId) ?? "#") : "";

  useEffect(() => {
    if (selectedCourierId && !isCouriersLoading && !courierMap.has(selectedCourierId)) {
      setSelectedCourierId("");
      setPendingOrders([]);
    }
  }, [courierMap, isCouriersLoading, selectedCourierId]);

  useEffect(() => {
    pendingTokensRef.current = new Set(
      pendingOrders.map((order) => order.token.trim().toLowerCase()),
    );
  }, [pendingOrders]);

  const handleRemoveOrder = useCallback((orderId: string) => {
    setPendingOrders((prev) => prev.filter((order) => order.id !== orderId));
  }, []);

  const handleScanValue = useCallback(async (rawValue: string) => {
    if (!canAcceptScan(rawValue)) return true;

    const normalizedToken = extractScannerToken(rawValue, window.location.origin) ?? rawValue.trim();

    if (!selectedCourierId) {
      setScanError(t("selectCourierFirst"));
      void playScanFeedback("error");
      return true;
    }

    if (!normalizedToken) {
      return false;
    }

    const tokenKey = normalizedToken.toLowerCase();

    if (getScanResourceType(normalizedToken) !== "order") {
      setScanError(t("wrongType"));
      void playScanFeedback("error");
      return true;
    }

    if (pendingTokensRef.current.has(tokenKey) || lookupTokensRef.current.has(tokenKey)) {
      setScanError(t("duplicateOrder"));
      blockScans(1800);
      return true;
    }

    lookupTokensRef.current.add(tokenKey);
    setIsLookingUpOrder(true);
    setScanError("");

    try {
      const detail = await fetchScanDetail(normalizedToken);
      if (detail.type !== "order") {
        throw new Error(t("wrongType"));
      }

      const nextOrder = normalizeOrder(detail.data, normalizedToken, t);
      setPendingOrders((prev) => {
        if (prev.some((order) => order.id === nextOrder.id || order.token.toLowerCase() === tokenKey)) {
          return prev;
        }

        return [...prev, nextOrder];
      });
      void playScanFeedback("success");
      blockScans(1400);
      return true;
    } catch (error) {
      setScanError(getBackendErrorMessage(error) ?? t("orderLookupError"));
      void playScanFeedback("error");
      blockScans(1800);
      return true;
    } finally {
      lookupTokensRef.current.delete(tokenKey);
      setIsLookingUpOrder(false);
    }
  }, [blockScans, canAcceptScan, selectedCourierId, t]);

  useKeyboardScanner({
    enabled: Boolean(selectedCourierId),
    captureEditableTargets: true,
    onScan: (value) => {
      void handleScanValue(value);
      return true;
    },
  });

  useEffect(() => {
    let cancelled = false;

    const stopScanner = () => {
      const activeScanner = scannerRef.current;
      const video = videoRef.current;
      void activeScanner?.pause(true);
      activeScanner?.stop();
      activeScanner?.destroy();
      scannerRef.current = null;
      if (video) {
        video.pause();
        video.srcObject = null;
        video.load();
      }
      setHasTorch(false);
      setTorchEnabled(false);
    };

    const startScanner = async () => {
      try {
        if (!selectedCourierId || !videoRef.current) return;

        const supportError = await QrScanner.getSupportError();
        if (supportError) {
          setScanError(supportError);
          return;
        }

        const scanner = new QrScanner(
          videoRef.current,
          (result: string | { data: string }) => {
            const value = typeof result === "string" ? result : result.data;
            void handleScanValue(value);
          },
          {
            preferredCamera: "environment",
            returnDetailedScanResult: true,
            highlightScanRegion: false,
            highlightCodeOutline: false,
            onDecodeError: () => undefined,
          },
        );

        scannerRef.current = scanner;
        await scanner.start();

        if (cancelled) {
          scanner.destroy();
          return;
        }

        setHasTorch(await scanner.hasFlash().catch(() => false));
      } catch (error) {
        setScanError(getBackendErrorMessage(error) ?? t("invalidQr"));
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [handleScanValue, selectedCourierId, t]);

  const handleToggleTorch = async () => {
    const scanner = scannerRef.current;
    if (!scanner || !hasTorch) return;

    try {
      await scanner.toggleFlash();
      setTorchEnabled(scanner.isFlashOn());
    } catch {
      setScanError(t("invalidQr"));
    }
  };

  const handleComplete = async () => {
    if (!selectedCourierId || pendingOrders.length === 0 || assignCourier.isPending) return;

    try {
      await assignCourier.mutateAsync({
        courier_id: selectedCourierId,
        order_ids: pendingOrders.map((order) => order.id),
      });

      notificationApi.success({
        message: t("success"),
        description: t("assignSuccess", {
          count: pendingOrders.length,
          courier: selectedCourierName,
        }),
        placement: "topRight",
        duration: 3,
      });

      setPendingOrders([]);
      setSelectedCourierId("");
      setScanError("");
      lookupTokensRef.current.clear();
      resetScannerGate();
    } catch (error) {
      notificationApi.error({
        message: t("error"),
        description: getDispatchErrorMessage(error, t("orderLookupError")),
        placement: "topRight",
        duration: 5,
      });
    }
  };

  return (
    <div className="min-h-full rounded-2xl p-4 md:p-6">
      <style>{`
        @keyframes dispatch-scan-line-y {
          0% {
            top: 14%;
            opacity: 0.45;
          }
          50% {
            top: 50%;
            opacity: 1;
          }
          100% {
            top: 86%;
            opacity: 0.45;
          }
        }
      `}</style>

      <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-4 shadow-sm dark:bg-primarydark">
        <HeaderName
          name={t("title")}
          description={t("subtitle")}
          icon={<PackagePlus />}
        />
      </div>

      <div className="mt-6 rounded-[28px] border border-[color:var(--color-border-soft)] bg-primary p-5 shadow-sm dark:bg-primarydark">
        <div className="max-w-md">
          <SearchableSelect
            label={t("courierLabel")}
            name="dispatch-courier"
            value={selectedCourierId}
            onChange={(value) => {
              setSelectedCourierId(value);
              setPendingOrders([]);
              setScanError("");
            }}
            options={couriers}
            placeholder={t("courierPlaceholder")}
            icon={Truck}
            loading={isCouriersLoading}
            disabled={isCouriersLoading || isCouriersError || couriers.length === 0}
          />
          <p className="m-0 mt-3 text-sm font-semibold text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
            {t("pagePurpose")}
          </p>
        </div>
      </div>

      {isCouriersError ? (
        <div className="mt-6">
          <EmptyState
            icon="❌"
            title="Courierlarni yuklab bo'lmadi"
            description="Server javobini tekshirib, qayta urinib ko'ring."
            action={
              <button
                type="button"
                onClick={() => void refetchCouriers()}
                className="rounded-2xl bg-main px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-main/90"
              >
                Qayta urinib ko'rish
              </button>
            }
          />
        </div>
      ) : null}

      {!isCouriersLoading && !isCouriersError && couriers.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="🚚"
            title={t("couriersEmptyTitle")}
            description={t("couriersEmptyDescription")}
          />
        </div>
      ) : null}

      {selectedCourierId ? (
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="overflow-hidden rounded-[28px] border border-[color:var(--color-border-soft)] bg-primary shadow-sm dark:bg-primarydark">
          <div className="flex items-center justify-between border-b border-[color:var(--color-border-soft)] px-5 py-4">
            <div>
              <h3 className="m-0 text-xl font-extrabold text-maindark dark:text-white">
                {t("scannerTitle")}
              </h3>
              <p className="m-0 mt-1 text-sm text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                {t("scannerSubtitle")}
              </p>
            </div>
            {hasTorch ? (
              <button
                type="button"
                onClick={() => void handleToggleTorch()}
                className="cursor-pointer rounded-2xl border border-[color:var(--color-border-soft)] px-4 py-2 text-sm font-semibold text-maindark transition hover:border-main/40 hover:text-main dark:text-white"
              >
                {torchEnabled ? "Torch off" : "Torch on"}
              </button>
            ) : null}
          </div>

          <div className="p-5">
            <div className="relative overflow-hidden rounded-[28px] border border-[color:var(--color-border-soft)] bg-maindark">
              <div className="relative aspect-[16/10]">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover opacity-95"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative h-[58%] w-[68%] max-w-[340px] rounded-[34px] border border-white/10 bg-white/[0.04] shadow-[0_0_0_9999px_rgba(7,10,24,0.34)]">
                    <div className="absolute left-0 top-0 h-12 w-12 rounded-tl-[30px] border-l-4 border-t-4 border-[#7c8cff]" />
                    <div className="absolute right-0 top-0 h-12 w-12 rounded-tr-[30px] border-r-4 border-t-4 border-[#7c8cff]" />
                    <div className="absolute bottom-0 left-0 h-12 w-12 rounded-bl-[30px] border-b-4 border-l-4 border-[#7c8cff]" />
                    <div className="absolute bottom-0 right-0 h-12 w-12 rounded-br-[30px] border-b-4 border-r-4 border-[#7c8cff]" />
                    <div
                      className="absolute left-[8%] right-[8%] h-[2px] -translate-y-1/2 bg-[linear-gradient(90deg,transparent,rgba(124,140,255,0.98),transparent)] shadow-[0_0_24px_rgba(124,140,255,0.78)]"
                      style={{ animation: "dispatch-scan-line-y 2.2s ease-in-out infinite alternate" }}
                    />
                    <div
                      className="absolute left-[14%] right-[14%] h-10 -translate-y-1/2 bg-[radial-gradient(circle,rgba(124,140,255,0.18),transparent_72%)] blur-md"
                      style={{ animation: "dispatch-scan-line-y 2.2s ease-in-out infinite alternate" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[color:var(--color-border-soft)] bg-white/70 px-4 py-4 text-sm font-semibold text-[color:var(--color-text-muted)] dark:border-white/10 dark:bg-white/[0.04] dark:text-[color:var(--color-text-muted-dark)]">
              {selectedCourierId ? t("scannerWaiting") : t("selectCourierFirst")}
            </div>

            {isLookingUpOrder ? (
              <div className="mt-4 rounded-2xl border border-main/20 bg-main/10 px-4 py-3 text-sm font-semibold text-main dark:text-white">
                {t("loading")}
              </div>
            ) : null}

            {scanError ? (
              <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-100">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{scanError}</span>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-[color:var(--color-border-soft)] bg-primary shadow-sm dark:bg-primarydark">
          <div className="flex items-center justify-between border-b border-[color:var(--color-border-soft)] px-5 py-4">
            <div>
              <h3 className="m-0 text-xl font-extrabold text-maindark dark:text-white">
                {t("pendingTitle")}
              </h3>
              <p className="m-0 mt-1 text-sm text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                {t("pendingHint")}
              </p>
            </div>
            <div className="rounded-2xl bg-main/10 px-4 py-2 text-sm font-bold text-main dark:text-white">
              {pendingOrders.length}
            </div>
          </div>

          <div className="p-5">
            {pendingOrders.length === 0 ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-dashed border-[color:var(--color-border-soft)] text-sm font-semibold text-[color:var(--color-text-muted)] dark:border-white/10 dark:text-[color:var(--color-text-muted-dark)]">
                {t("pendingEmpty")}
              </div>
            ) : (
              <div className="space-y-3">
                {pendingOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-[24px] border border-[color:var(--color-border-soft)] bg-white/75 px-4 py-4 dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-maindark dark:text-white">
                          <QrCode size={16} />
                          <p className="m-0 truncate text-sm font-extrabold">{order.token}</p>
                        </div>
                        <p className="m-0 mt-2 text-sm font-semibold text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                          {order.market}
                        </p>
                        <p className="m-0 mt-1 text-base font-extrabold text-maindark dark:text-white">
                          {formatMoney(order.amount)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveOrder(order.id)}
                        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border border-red-300/20 bg-red-500/10 text-red-500 transition hover:bg-red-500/15 dark:text-red-200"
                        aria-label={t("remove")}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleComplete()}
              disabled={!selectedCourierId || pendingOrders.length === 0 || assignCourier.isPending}
              className="mt-5 flex w-full cursor-pointer items-center justify-center gap-3 rounded-[28px] bg-emerald-500 px-6 py-5 text-base font-extrabold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {assignCourier.isPending ? (
                <>
                  <CheckCircle2 size={18} className="animate-pulse" />
                  {t("assignLoading")}
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  {t("assignButton", {
                    count: pendingOrders.length,
                    courier: selectedCourierName,
                  })}
                </>
              )}
            </button>
          </div>
        </section>
      </div>
      ) : couriers.length > 0 ? (
        <div className="mt-6 rounded-[28px] border border-dashed border-[color:var(--color-border-soft)] bg-primary p-10 text-center shadow-sm dark:border-white/10 dark:bg-primarydark">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-main/10 text-main dark:text-white">
            <LockKeyhole size={26} />
          </div>
          <h3 className="m-0 mt-5 text-xl font-black text-maindark dark:text-white">
            {t("lockedTitle")}
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
            {t("lockedHint")}
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default memo(DispatchPage);
