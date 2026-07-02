import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import {
  Building2,
  CheckCircle2,
  Home,
  Loader2,
  QrCode,
  Trash2,
  Truck,
  UserRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";
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
import type { OrderStatus } from "../../entities/order/types/order";
import { useUser } from "../../entities/user/api/userApi";
import PageContainer from "../../shared/ui/PageContainer";
import OrderStatusBadge from "../orders/list/OrderStatusBadge";
import type { RootState } from "../../app/config/store";

type PendingOrder = {
  id: string;
  token: string;
  market: string;
  name: string;
  phone: string;
  district: string;
  region: string;
  address: string;
  amount: number;
  deliveryType: string;
  createdAt: string;
  status: string;
  fields: Array<{
    key: string;
    label: string;
    value: string;
  }>;
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

const getProfileRegionId = (profile: unknown): string => {
  const user = asRecord(profile);
  const branch = asRecord(user.branch);
  const nestedBranch = asRecord(branch.branch);
  const region = asRecord(user.region);
  const branchRegion = asRecord(branch.region);
  const nestedBranchRegion = asRecord(nestedBranch.region);
  const id =
    user.region_id ??
    region.id ??
    branch.region_id ??
    branch.regionId ??
    branchRegion.id ??
    nestedBranch.region_id ??
    nestedBranch.regionId ??
    nestedBranchRegion.id;

  return id == null ? "" : String(id);
};

const safe = (value: unknown, fallback = "—") => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return fallback;
};

const formatMoney = (value: number, currencyLabel: string) =>
  `${value.toLocaleString("uz-UZ")} ${currencyLabel}`;

const formatDate = (value: unknown) => {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const getDeliveryLabel = (value: unknown, t: (key: string) => string) => {
  if (value === "center") return t("orders:deliveryToCenter");
  if (value === "address" || value === "home") return t("orders:deliveryToHome");
  return safe(value);
};

const unwrapOrderPayload = (payload: unknown) => {
  const source = asRecord(payload);
  const responseData = asRecord(source.data ?? source);
  const responsePayload = asRecord(responseData.data ?? responseData);
  return asRecord(responsePayload.order ?? responseData.order ?? responsePayload);
};

const ORDER_STATUS_KEYS = new Set([
  "created",
  "new",
  "received",
  "on the road",
  "waiting",
  "sold",
  "cancelled",
  "cancelled (sent)",
  "paid",
  "partly_paid",
  "closed",
]);

const isOrderStatus = (value: string): value is OrderStatus => ORDER_STATUS_KEYS.has(value);

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

const normalizeOrder = (payload: unknown, token: string, t: (key: string) => string): PendingOrder | null => {
  const order = unwrapOrderPayload(payload);
  const id = safe(order.id, "");
  if (!id) return null;

  const market = asRecord(order.market);
  const sender = asRecord(order.sender);
  const customer = asRecord(order.customer);
  const customerDistrict = asRecord(customer.district);
  const district = asRecord(order.district ?? customerDistrict);
  const region = asRecord(order.region ?? district.region ?? customer.region);
  const status = safe(order.status, "");
  const customerName = safe(
    customer.fullName ??
      customer.full_name ??
      customer.name ??
      order.customer_name ??
      order.name,
    "",
  );
  const phone = safe(customer.phone_number ?? customer.phone ?? order.phone_number ?? order.phone);
  const marketName = safe(market.name ?? sender.name);
  const districtName = safe(district.name ?? order.district_name);
  const deliveryType = getDeliveryLabel(order.where_deliver ?? order.delivery_type ?? order.deliveryType, t);
  const amount = Number(order?.total_price ?? 0) || 0;
  const createdAt = formatDate(order.createdAt ?? order.created_at ?? order.updatedAt ?? order.updated_at);

  return {
    id,
    token,
    market: marketName,
    name: customerName,
    phone,
    district: districtName,
    region: safe(region.name ?? order.region_name),
    address: safe(order.address ?? customer.address, ""),
    amount,
    deliveryType,
    createdAt,
    status: status || "—",
    fields: [
      { key: "name", label: t("tableName"), value: customerName || "—" },
      { key: "phone", label: t("tablePhone"), value: phone },
      { key: "district", label: t("tableDistrict"), value: districtName },
      { key: "market", label: t("tableMarket"), value: marketName },
      { key: "amount", label: t("tablePrice"), value: formatMoney(amount) },
      { key: "deliveryType", label: t("tableDeliveryType"), value: deliveryType },
      { key: "createdAt", label: t("tableDate"), value: createdAt },
      { key: "status", label: t("tableStatus"), value: status || "—" },
    ],
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
  const { t } = useTranslation(["dispatch", "orders"]);
  const currencyLabel = t("currency", { ns: "orders" });
  const { api: notificationApi } = useAppNotification();
  const { assignCourier } = useOrders();
  const { useGetCouriers } = useUser();
  const role = useSelector((state: RootState) => state.role.role);
  const profile = useSelector((state: RootState) => state.user.user);
  const managerRegionId = useMemo(
    () => role === "manager" ? getProfileRegionId(profile) : "",
    [profile, role],
  );
  const courierParams = useMemo(
    () => ({
      page: 1,
      limit: 100,
      ...(managerRegionId ? { region_id: managerRegionId } : {}),
    }),
    [managerRegionId],
  );
  const canLoadCouriers = role !== "manager" || Boolean(managerRegionId);
  const {
    data: couriersResponse,
    isLoading: isCouriersLoading,
    isError: isCouriersError,
    refetch: refetchCouriers,
  } = useGetCouriers(courierParams, canLoadCouriers);

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
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
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
    setSelectedOrderIds((prev) => {
      const availableIds = new Set(pendingOrders.map((order) => order.id));
      const next = new Set<string>();

      prev.forEach((id) => {
        if (availableIds.has(id)) next.add(id);
      });

      return next;
    });
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
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
  }, []);

  const selectedOrders = useMemo(
    () => pendingOrders.filter((order) => selectedOrderIds.has(order.id)),
    [pendingOrders, selectedOrderIds],
  );

  const tableColumns = useMemo(() => {
    const columns = new Map<string, string>();

    pendingOrders.forEach((order) => {
      order.fields.forEach((field) => {
        if (!columns.has(field.key)) {
          columns.set(field.key, field.label);
        }
      });
    });

    return Array.from(columns, ([key, label]) => ({ key, label }));
  }, [pendingOrders]);

  const allOrdersSelected = pendingOrders.length > 0 && selectedOrderIds.size === pendingOrders.length;

  const homeOrders = useMemo(
    () => pendingOrders.filter((order) => order.deliveryType === t("orders:deliveryToHome")),
    [pendingOrders, t],
  );

  const centerOrders = useMemo(
    () => pendingOrders.filter((order) => order.deliveryType === t("orders:deliveryToCenter")),
    [pendingOrders, t],
  );

  const homeTotal = useMemo(
    () => homeOrders.reduce((sum, order) => sum + order.amount, 0),
    [homeOrders],
  );

  const centerTotal = useMemo(
    () => centerOrders.reduce((sum, order) => sum + order.amount, 0),
    [centerOrders],
  );

  const toggleSelectAll = () => {
    setSelectedOrderIds((prev) => {
      if (pendingOrders.length > 0 && prev.size === pendingOrders.length) return new Set();
      return new Set(pendingOrders.map((order) => order.id));
    });
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

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
      if (!nextOrder) {
        throw new Error(t("orderLookupError"));
      }

      setPendingOrders((prev) => {
        if (prev.some((order) => order.id === nextOrder.id || order.token.toLowerCase() === tokenKey)) {
          return prev;
        }

        return [...prev, nextOrder];
      });
      setSelectedOrderIds((selectedIds) => {
        const next = new Set(selectedIds);
        next.add(nextOrder.id);
        return next;
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
    if (!courierId || selectedOrders.length === 0 || assignCourier.isPending) return;
    const assignedOrderIds = new Set(selectedOrders.map((order) => order.id));
    const assignedCount = selectedOrders.length;

    try {
      await assignCourier.mutateAsync({
        courier_id: courierId,
        order_ids: Array.from(assignedOrderIds),
      });

      notificationApi.success({
        message: t("success"),
        description: t("assignSuccess", {
          count: assignedCount,
          courier: courierName,
        }),
        placement: "topRight",
        duration: 3,
      });

      setPendingOrders((prev) => prev.filter((order) => !assignedOrderIds.has(order.id)));
      setSelectedOrderIds((prev) => {
        const next = new Set(prev);
        assignedOrderIds.forEach((id) => next.delete(id));
        return next;
      });
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

      <section className="overflow-hidden rounded-[28px] border border-(--color-border-soft) bg-primary p-4 shadow-sm dark:border-white/8 dark:bg-primarydark/95 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-(--color-text-muted) shadow-sm dark:bg-white/8 dark:text-white/75">
              <QrCode size={22} />
            </span>
            <div className="min-w-0">
              <h2 className="m-0 text-xl font-black text-maindark dark:text-white">
                {t("oldUiTitle", { count: pendingOrders.length })}
              </h2>
              <p className="m-0 mt-1 text-sm font-semibold text-(--color-text-muted) dark:text-text-muted-dark">
                {t("oldUiSubtitle", { count: pendingOrders.length })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ScannerActionButton
              onClick={handleToggleCameraScanner}
              label={t("openScanner")}
              showLabel
              className="!h-10 !rounded-2xl !border !border-main/25 !bg-main/10 !text-main hover:!bg-main/15 dark:!border-white/10 dark:!bg-white/8 dark:!text-white"
            />
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl bg-rose-500 px-4 py-4 text-white shadow-lg shadow-rose-500/20">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <QrCode size={18} />
              </span>
              <div>
                <p className="m-0 text-xs font-bold opacity-85">{t("statSelected")}</p>
                <p className="m-0 text-lg font-black">{selectedOrders.length} / {pendingOrders.length}</p>
                <p className="m-0 text-xs font-semibold opacity-85">{t("selectedCount", { count: selectedOrders.length })}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-main/20 bg-main/15 px-4 py-4 text-maindark shadow-sm dark:border-white/8 dark:bg-white/8 dark:text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/35 text-main dark:bg-white/10 dark:text-white">
                <Home size={18} />
              </span>
              <div>
                <p className="m-0 text-xs font-bold text-(--color-text-muted) dark:text-text-muted-dark">{t("statHome")}</p>
                <p className="m-0 text-lg font-black">{homeOrders.length} {t("piece")}</p>
                <p className="m-0 text-xs font-semibold text-(--color-text-muted) dark:text-text-muted-dark">
                  {formatMoney(homeTotal, currencyLabel)}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-main/20 bg-main/15 px-4 py-4 text-maindark shadow-sm dark:border-white/8 dark:bg-white/8 dark:text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/35 text-main dark:bg-white/10 dark:text-white">
                <Building2 size={18} />
              </span>
              <div>
                <p className="m-0 text-xs font-bold text-(--color-text-muted) dark:text-text-muted-dark">{t("statCenter")}</p>
                <p className="m-0 text-lg font-black">{centerOrders.length} {t("piece")}</p>
                <p className="m-0 text-xs font-semibold text-(--color-text-muted) dark:text-text-muted-dark">
                  {formatMoney(centerTotal, currencyLabel)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {isLookingUpOrder ? (
          <div
            role="status"
            className="mt-4 flex items-center gap-3 rounded-2xl border border-main/20 bg-main/10 px-4 py-3 text-main dark:text-white"
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
            className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-100"
          >
            {scanError}
          </div>
        ) : null}

        <div className="mt-4 rounded-2xl border border-(--color-border-soft) bg-white/55 dark:border-white/8 dark:bg-white/4">
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={pendingOrders.length === 0}
            className="flex h-10 w-full cursor-pointer items-center justify-between gap-3 px-4 text-left text-sm font-extrabold text-maindark transition hover:bg-main/5 disabled:cursor-not-allowed disabled:opacity-55 dark:text-white dark:hover:bg-white/6"
          >
            <span className="inline-flex items-center gap-2">
              <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${allOrdersSelected ? "border-main bg-main text-white" : "border-main/35 bg-main/10 text-transparent dark:border-white/20"}`}>
                <CheckCircle2 size={13} />
              </span>
              {allOrdersSelected ? t("deselectAll") : t("selectAll")}
            </span>
            <span className="text-xs font-bold text-(--color-text-muted) dark:text-text-muted-dark">
              {t("selectedCount", { count: selectedOrders.length })}
            </span>
          </button>
        </div>

        {pendingOrders.length === 0 ? (
          <div className="mt-4 flex min-h-88 flex-col items-center justify-center rounded-2xl border border-dashed border-(--color-border-soft) px-6 text-center dark:border-white/10">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-main/10 text-main dark:bg-white/10 dark:text-white">
              <QrCode size={28} />
            </div>
            <h4 className="m-0 mt-4 text-lg font-black text-maindark dark:text-white">
              {t("scanOrdersTitle")}
            </h4>
            <p className="m-0 mt-2 max-w-md text-sm font-semibold leading-6 text-(--color-text-muted) dark:text-text-muted-dark">
              {t("scanOrdersHint")}
            </p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto custom-scrollbar">
            <table className="min-w-max w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-[11px] font-black uppercase text-(--color-text-muted) dark:text-text-muted-dark">
                  <th className="sticky left-0 z-10 bg-primary px-4 py-2 dark:bg-primarydark">
                    {t("selectAll")}
                  </th>
                  {tableColumns.map((column) => (
                    <th key={column.key} className="whitespace-nowrap px-4 py-2">
                      {column.label}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-right">{t("tableAction")}</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map((order) => {
                  const selected = selectedOrderIds.has(order.id);
                  const fieldMap = new Map(order.fields.map((field) => [field.key, field.value]));

                  return (
                    <tr
                      key={order.id}
                      onClick={() => toggleOrderSelection(order.id)}
                      className={`cursor-pointer text-sm font-semibold text-maindark transition dark:text-white ${selected ? "bg-main/10 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.38)]" : "bg-white/45 dark:bg-white/4"} hover:bg-main/12 dark:hover:bg-white/8`}
                    >
                      <td className="sticky left-0 z-10 rounded-l-xl bg-inherit px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-main text-white" : "bg-white/70 text-(--color-text-muted) dark:bg-white/8 dark:text-white/70"}`}>
                            <UserRound size={13} />
                          </span>
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected ? "border-main bg-main text-white" : "border-main/35 bg-main/10 text-transparent dark:border-white/20"}`}>
                            <CheckCircle2 size={13} />
                          </span>
                        </div>
                      </td>
                      {tableColumns.map((column) => {
                        const value = fieldMap.get(column.key) ?? "—";
                        const normalizedKey = column.key.toLowerCase();

                        return (
                          <td key={column.key} className="max-w-64 px-4 py-3">
                            {normalizedKey.endsWith("status") && isOrderStatus(value) ? (
                              <OrderStatusBadge status={value} />
                            ) : (
                              <span className="block truncate" title={value}>
                                {value}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="rounded-r-xl px-4 py-3">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRemoveOrder(order.id);
                            }}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-red-300/20 bg-red-500/10 text-red-500 transition hover:bg-red-500/15 dark:text-red-200"
                            aria-label={t("remove")}
                            title={t("remove")}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <button
          type="button"
          onClick={handleAssignCourier}
          disabled={selectedOrders.length === 0 || isLookingUpOrder || assignCourier.isPending || isCouriersLoading || isCouriersError || couriers.length === 0}
          className="mt-5 flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-6 py-4 text-sm font-black text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {assignCourier.isPending ? (
            <>
              <CheckCircle2 size={18} className="animate-pulse" />
              {t("assignLoading")}
            </>
          ) : (
            <>
              <CheckCircle2 size={18} />
              {t("oldUiAction", { count: selectedOrders.length })}
            </>
          )}
        </button>
      </section>

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
        description={t("courierPopupDescription", { count: selectedOrders.length })}
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
