import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  MapPin,
  PackagePlus,
  Phone,
  QrCode,
  Trash2,
  Truck,
  UserRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import HeaderName from "../../shared/components/headerName";
import PopupSelect from "../../shared/components/popupSelect";
import ScannerActionButton from "../../shared/components/ScannerActionButton";
import ScannerCameraModal from "../../shared/components/ScannerCameraModal";
import { useKeyboardScanner } from "../../shared/lib/useKeyboardScanner";
import { useScannerGate } from "../../shared/lib/useScannerGate";
import { extractScannerToken } from "../../shared/lib/scanToken";
import { fetchScanDetail, getScanResourceType, getBackendErrorMessage } from "../scan/lib/scanResource";
import { playScanFeedback } from "../scan/lib/scanShared";
import { useAppNotification } from "../../app/providers/notification/NotificationProvider";
import { useOrders } from "../../entities/order/api/orderApi";
import { useUser } from "../../entities/user/api/userApi";
import PageContainer from "../../shared/ui/PageContainer";

type PendingOrder = {
  id: string;
  token: string;
  market: string;
  customer: string;
  phone: string;
  district: string;
  region: string;
  address: string;
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

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" ? value as UnknownRecord : {};

const safe = (value: unknown, fallback = "—") => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
};

const formatMoney = (value: number) => `${value.toLocaleString("uz-UZ")} so'm`;

const extractList = (payload: unknown): unknown[] => {
  const source = asRecord(payload);
  const data = asRecord(source.data);

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(source.data)) return source.data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.couriers)) return data.couriers;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(source.items)) return source.items;
  if (Array.isArray(source.couriers)) return source.couriers;
  if (Array.isArray(source.rows)) return source.rows;
  if (Array.isArray(source.results)) return source.results;
  return [];
};

const normalizeCourierOption = (value: unknown) => {
  const item = asRecord(value);
  const user = asRecord(
    item.user ??
    item.employee ??
    item.courier ??
    item.identity_user ??
    item.identityUser ??
    item.profile ??
    item,
  );
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
  const source = asRecord(payload);
  const responseData = asRecord(source.data ?? source);
  const order = asRecord(responseData.data ?? responseData.order ?? responseData);
  const market = asRecord(order.market);
  const sender = asRecord(order.sender);
  const customer = asRecord(order.customer);
  const customerDistrict = asRecord(customer.district);
  const district = asRecord(order.district ?? customerDistrict);
  const districtRegion = asRecord(district.region);
  const customerRegion = asRecord(customer.region);
  const region = asRecord(
    order.region ??
      district.region ??
      customer.region ??
      districtRegion ??
      customerRegion,
  );

  return {
    id: safe(order?.id),
    token,
    market: safe(market.name ?? sender.name, t("marketFallback")),
    customer: safe(customer.name ?? order.customer_name),
    phone: safe(customer.phone_number ?? customer.phone ?? order.phone_number ?? order.phone),
    district: safe(district.name ?? order.district_name),
    region: safe(region.name ?? order.region_name),
    address: safe(order.address ?? customer.address, ""),
    amount: Number(order?.total_price ?? 0) || 0,
  };
};

const getDispatchErrorMessage = (error: unknown, fallback: string) => {
  const responseData = asRecord((error as { response?: { data?: unknown } } | null)?.response?.data);
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
      limit: 100,
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

  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [scanError, setScanError] = useState("");
  const [activeLookupCount, setActiveLookupCount] = useState(0);
  const [isLookupSlow, setIsLookupSlow] = useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [isCourierPopupOpen, setIsCourierPopupOpen] = useState(false);
  const isLookingUpOrder = activeLookupCount > 0;

  const isCameraScannerOpenRef = useRef(false);
  const pendingTokensRef = useRef<Set<string>>(new Set());
  const lookupTokensRef = useRef<Set<string>>(new Set());
  const { canAcceptScan, blockScans, resetScannerGate } = useScannerGate({
    cooldownMs: 150,
    duplicateCooldownMs: 2600,
  });

  useEffect(() => {
    isCameraScannerOpenRef.current = isCameraScannerOpen;
  }, [isCameraScannerOpen]);

  useEffect(() => {
    pendingTokensRef.current = new Set(
      pendingOrders.map((order) => order.token.trim().toLowerCase()),
    );
  }, [pendingOrders]);

  useEffect(() => {
    if (!isLookingUpOrder) {
      setIsLookupSlow(false);
      return;
    }

    const timeout = window.setTimeout(() => setIsLookupSlow(true), 1200);
    return () => window.clearTimeout(timeout);
  }, [isLookingUpOrder]);

  const handleRemoveOrder = useCallback((orderId: string) => {
    setPendingOrders((prev) => prev.filter((order) => order.id !== orderId));
  }, []);

  const handleScanValue = useCallback(async (rawValue: string) => {
    if (!canAcceptScan(rawValue)) return true;

    const normalizedToken = extractScannerToken(rawValue, window.location.origin) ?? rawValue.trim();

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
      blockScans(250);
      return true;
    }

    lookupTokensRef.current.add(tokenKey);
    setActiveLookupCount((count) => count + 1);
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
      if (isCameraScannerOpenRef.current) {
        setIsCameraScannerOpen(false);
      }
      blockScans(250);
      return true;
    } catch (error) {
      setScanError(getBackendErrorMessage(error) ?? t("orderLookupError"));
      void playScanFeedback("error");
      blockScans(600);
      return true;
    } finally {
      lookupTokensRef.current.delete(tokenKey);
      setActiveLookupCount((count) => Math.max(0, count - 1));
    }
  }, [blockScans, canAcceptScan, t]);

  useKeyboardScanner({
    enabled: true,
    captureEditableTargets: true,
    onScan: (value) => {
      void handleScanValue(value);
      return true;
    },
  });

  const handleToggleCameraScanner = () => {
    setScanError("");
    setIsCameraScannerOpen((prev) => !prev);
  };

  const handleCloseCameraScanner = () => {
    setIsCameraScannerOpen(false);
  };

  const handleComplete = async (courierId: string, courierName: string) => {
    if (!courierId || pendingOrders.length === 0 || assignCourier.isPending) return;

    try {
      await assignCourier.mutateAsync({
        courier_id: courierId,
        order_ids: pendingOrders.map((order) => order.id),
      });

      notificationApi.success({
        message: t("success"),
        description: t("assignSuccess", {
          count: pendingOrders.length,
          courier: courierName,
        }),
        placement: "topRight",
        duration: 3,
      });

      setPendingOrders([]);
      setIsCourierPopupOpen(false);
      setScanError("");
      setIsCameraScannerOpen(false);
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

  const handleAssignCourier = () => {
    const onlyCourier = couriers.length === 1 ? couriers[0] : null;

    if (onlyCourier) {
      void handleComplete(onlyCourier.value, onlyCourier.label);
      return;
    }

    setIsCourierPopupOpen(true);
  };

  return (
    <PageContainer>
      <div className="rounded-2xl border border-(--color-border-soft) bg-primary p-4 shadow-sm dark:bg-primarydark">
        <HeaderName
          name={t("title")}
          description={t("subtitle")}
          icon={<PackagePlus />}
        />
      </div>

      {isCouriersError ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-100">
          <span>{t("couriersLoadError")}</span>
          <button
            type="button"
            onClick={() => void refetchCouriers()}
            className="rounded-xl bg-red-500 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-red-400"
          >
            {t("retry")}
          </button>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--color-border-soft) bg-primary px-5 py-4 shadow-sm dark:bg-primarydark">
        <p className="m-0 text-sm font-semibold text-(--color-text-muted) dark:text-text-muted-dark">
          {t("keyboardScannerHint")}
        </p>
        <ScannerActionButton
          onClick={handleToggleCameraScanner}
          label={t("openScanner")}
          showLabel
          className="bg-main! text-white! shadow-lg! shadow-main/20! hover:bg-main/90! dark:text-white!"
        />
      </div>

      <div className="mt-6">
        <section className="overflow-hidden rounded-[28px] border border-(--color-border-soft) bg-primary shadow-sm dark:bg-primarydark">
          <div className="flex items-center justify-between border-b border-(--color-border-soft) px-5 py-4">
            <div>
              <h3 className="m-0 text-xl font-extrabold text-maindark dark:text-white">
                {t("pendingTitle")}
              </h3>
              <p className="m-0 mt-1 text-sm text-(--color-text-muted) dark:text-text-muted-dark">
                {t("pendingHint")}
              </p>
            </div>
            <div className="rounded-2xl bg-main/10 px-4 py-2 text-sm font-bold text-main dark:text-white">
              {pendingOrders.length}
            </div>
          </div>

          <div className="p-5">
            {isLookingUpOrder ? (
              <div
                role="status"
                className="mb-4 flex items-center gap-3 rounded-2xl border border-main/20 bg-main/10 px-4 py-3 text-main dark:text-white"
              >
                <Loader2 size={20} className="shrink-0 animate-spin" />
                <div>
                  <p className="m-0 text-sm font-extrabold">
                    {t("loadingCount", { count: activeLookupCount })}
                  </p>
                  {isLookupSlow ? (
                    <p className="m-0 mt-1 text-xs font-semibold opacity-75">
                      {t("slowLoading")}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {scanError && !isCameraScannerOpen ? (
              <div
                role="alert"
                className="mb-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-100"
              >
                {scanError}
              </div>
            ) : null}

            {pendingOrders.length === 0 ? (
              <div className="flex min-h-105 flex-col items-center justify-center rounded-3xl border border-dashed border-(--color-border-soft) px-6 text-center dark:border-white/10">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-main/10 text-main dark:bg-white/10 dark:text-white">
                  <QrCode size={28} />
                </div>
                <h4 className="m-0 mt-4 text-lg font-black text-maindark dark:text-white">
                  {t("scanOrdersTitle")}
                </h4>
                <p className="m-0 mt-2 max-w-md text-sm font-semibold leading-6 text-(--color-text-muted) dark:text-text-muted-dark">
                  {t("scanOrdersHint")}
                </p>
                <ScannerActionButton
                  onClick={handleToggleCameraScanner}
                  label={t("openScanner")}
                  showLabel
                  className="mt-5 bg-main! text-white! shadow-lg! shadow-main/20! hover:bg-main/90! dark:text-white!"
                />
              </div>
            ) : (
              <div className="max-h-130 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                {pendingOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-3xl border border-(--color-border-soft) bg-white/75 px-4 py-4 transition hover:border-main/30 dark:border-white/10 dark:bg-white/4"
                  >
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="min-w-0 space-y-2">
                        <div className="flex min-w-0 items-center gap-2 text-maindark dark:text-white">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-main/10 text-main dark:bg-white/10 dark:text-white">
                            <QrCode size={16} />
                          </span>
                          <div className="min-w-0">
                            <p className="m-0 truncate text-sm font-extrabold">ORD-{order.id}</p>
                            <p className="m-0 truncate text-xs font-semibold text-(--color-text-muted) dark:text-text-muted-dark">
                              {order.token}
                            </p>
                          </div>
                        </div>
                        <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                          <p className="m-0 truncate font-semibold text-(--color-text-muted) dark:text-text-muted-dark">
                            {t("market")}: <span className="text-maindark dark:text-white">{order.market}</span>
                          </p>
                          <p className="m-0 flex min-w-0 items-center gap-1.5 font-semibold text-(--color-text-muted) dark:text-text-muted-dark">
                            <UserRound size={14} className="shrink-0 text-main" />
                            <span className="truncate text-maindark dark:text-white">{order.customer}</span>
                          </p>
                          <p className="m-0 flex min-w-0 items-center gap-1.5 font-semibold text-(--color-text-muted) dark:text-text-muted-dark">
                            <Phone size={14} className="shrink-0 text-main" />
                            <span className="truncate text-maindark dark:text-white">{order.phone}</span>
                          </p>
                          <p className="m-0 flex min-w-0 items-center gap-1.5 font-semibold text-(--color-text-muted) dark:text-text-muted-dark">
                            <MapPin size={14} className="shrink-0 text-main" />
                            <span className="truncate text-maindark dark:text-white">
                              {[order.region, order.district].filter((value) => value !== "—").join(", ") || "—"}
                            </span>
                          </p>
                          {order.address ? (
                            <p className="m-0 flex min-w-0 items-center gap-1.5 font-semibold text-(--color-text-muted) dark:text-text-muted-dark sm:col-span-2 xl:col-span-3">
                              <MapPin size={14} className="shrink-0 text-main" />
                              <span className="truncate">
                                {t("address")}: <span className="text-maindark dark:text-white">{order.address}</span>
                              </span>
                            </p>
                          ) : null}
                          <p className="m-0 font-extrabold text-maindark dark:text-white xl:text-right">
                            {formatMoney(order.amount)}
                          </p>
                        </div>
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
              onClick={handleAssignCourier}
              disabled={pendingOrders.length === 0 || isLookingUpOrder || assignCourier.isPending || isCouriersLoading || isCouriersError || couriers.length === 0}
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
                  {t("openCourierAssign", { count: pendingOrders.length })}
                </>
              )}
            </button>
          </div>
        </section>
      </div>

      <ScannerCameraModal
        isOpen={isCameraScannerOpen}
        onClose={handleCloseCameraScanner}
        onDecode={(value) => void handleScanValue(value)}
        title={t("scannerTitle")}
        subtitle={t("scannerSubtitle")}
        waitingText={t("scannerWaiting")}
        closeLabel={t("closeScanner")}
        torchOnLabel={t("torchOn")}
        torchOffLabel={t("torchOff")}
        invalidQrMessage={t("invalidQr")}
        loading={isLookingUpOrder}
        loadingText={t("loading")}
        error={scanError}
      />

      <PopupSelect<{ value: string; label: string }>
        isOpen={isCourierPopupOpen}
        onClose={() => setIsCourierPopupOpen(false)}
        data={couriers}
        onSelect={(courier) => {
          void handleComplete(courier.value, courier.label);
        }}
        keyExtractor={(courier) => courier.value}
        searchKeys={["label"]}
        title={t("courierPopupTitle")}
        description={t("courierPopupDescription", { count: pendingOrders.length })}
        icon={<Truck />}
        placeholder={t("courierSearchPlaceholder")}
        selectLabel={t("assignSelectedCourier")}
        cancelLabel={t("cancel")}
        labelKey="label"
        renderItem={(courier, isSelected) => (
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isSelected ? "bg-main text-white" : "bg-main/10 text-main dark:bg-white/10 dark:text-white"}`}>
              <Truck size={18} />
            </div>
            <div className="min-w-0">
              <p className="m-0 truncate text-base font-extrabold text-maindark dark:text-white">
                {courier.label}
              </p>
              <p className="m-0 mt-0.5 text-xs font-semibold text-(--color-text-muted) dark:text-text-muted-dark">
                {t("courierOptionHint")}
              </p>
            </div>
          </div>
        )}
      />
    </PageContainer>
  );
};

export default memo(DispatchPage);
