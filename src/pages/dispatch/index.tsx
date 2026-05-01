import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  PackagePlus,
  QrCode,
  Trash2,
  Truck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import HeaderName from "../../shared/components/headerName";
import { getCurrentBranchId } from "../../shared/lib/currentBranch";
import { useBranchEmployees } from "../../entities/branch";
import SearchableSelect from "../../shared/ui/SearchableSelect";
import QrScanner from "../../shared/lib/qrScanner";
import { useKeyboardScanner } from "../../shared/lib/useKeyboardScanner";
import { extractScannerToken } from "../../shared/lib/scanToken";
import { fetchScanDetail, getScanResourceType, getBackendErrorMessage } from "../scan/lib/scanResource";
import { playScanFeedback } from "../scan/lib/scanShared";
import { useAppNotification } from "../../app/providers/notification/NotificationProvider";
import { useOrders } from "../../entities/order/api/orderApi";

type PendingOrder = {
  id: string;
  token: string;
  market: string;
  amount: number;
};

const safe = (value: unknown, fallback = "—") => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
};

const formatMoney = (value: number) => `${value.toLocaleString("uz-UZ")} so'm`;

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

const DispatchPage = () => {
  const { t } = useTranslation("dispatch");
  const branchId = useSelector(getCurrentBranchId);
  const { data: employees } = useBranchEmployees(branchId || undefined);
  const { api: notificationApi } = useAppNotification();
  const { assignCourier } = useOrders();

  const couriers = useMemo(
    () =>
      (employees ?? [])
        .filter((employee) => employee.position.toLowerCase().includes("courier") || employee.position.toLowerCase().includes("kuryer"))
        .map((employee) => ({
          value: employee.user.id,
          label: employee.user.fullName,
        })),
    [employees],
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

  const selectedCourierName = selectedCourierId ? (courierMap.get(selectedCourierId) ?? "#") : "";

  const handleRemoveOrder = useCallback((orderId: string) => {
    setPendingOrders((prev) => prev.filter((order) => order.id !== orderId));
  }, []);

  const handleScanValue = useCallback(async (rawValue: string) => {
    const normalizedToken = extractScannerToken(rawValue, window.location.origin) ?? rawValue.trim();

    if (!selectedCourierId) {
      setScanError(t("selectCourierFirst"));
      void playScanFeedback("error");
      return true;
    }

    if (!normalizedToken) {
      return false;
    }

    if (getScanResourceType(normalizedToken) !== "order") {
      setScanError(t("wrongType"));
      void playScanFeedback("error");
      return true;
    }

    if (pendingOrders.some((order) => order.token.toLowerCase() === normalizedToken.toLowerCase())) {
      setScanError(t("duplicateOrder"));
      void playScanFeedback("error");
      return true;
    }

    setIsLookingUpOrder(true);
    setScanError("");

    try {
      const detail = await fetchScanDetail(normalizedToken);
      if (detail.type !== "order") {
        throw new Error(t("wrongType"));
      }

      const nextOrder = normalizeOrder(detail.data, normalizedToken, t);
      setPendingOrders((prev) => [...prev, nextOrder]);
      void playScanFeedback("success");
      return true;
    } catch (error) {
      setScanError(getBackendErrorMessage(error) ?? t("orderLookupError"));
      void playScanFeedback("error");
      return true;
    } finally {
      setIsLookingUpOrder(false);
    }
  }, [pendingOrders, selectedCourierId, t]);

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
        if (!videoRef.current) return;

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
  }, [handleScanValue, t]);

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
        description: t("assignSuccess", { count: pendingOrders.length }),
        placement: "topRight",
        duration: 3,
      });

      setPendingOrders([]);
      setSelectedCourierId("");
      setScanError("");
    } catch (error) {
      notificationApi.error({
        message: t("error"),
        description: getBackendErrorMessage(error) ?? t("orderLookupError"),
        placement: "topRight",
        duration: 5,
      });
    }
  };

  return (
    <div className="min-h-full rounded-2xl p-4 md:p-6">
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
              setScanError("");
            }}
            options={couriers}
            placeholder={t("courierPlaceholder")}
            icon={Truck}
          />
        </div>
      </div>

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
                  <div className="h-[56%] w-[66%] rounded-[32px] border-2 border-main/80 bg-white/[0.04] shadow-[0_0_0_9999px_rgba(7,10,24,0.34)]" />
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
    </div>
  );
};

export default memo(DispatchPage);
