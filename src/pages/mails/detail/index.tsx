import { memo, useEffect, useMemo, useCallback, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Ban, FileText, Globe, MapPin, ScanLine } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useMails,
  useMailDetail,
  type PostOrder,
  useReceiveCanceledPost,
  useReceivePost,
} from "../../../entities/mails";
import { useBatchRemainingDetail, useSendTransferBatch } from "../../../entities/batch";
import { mapBatchOrdersToPostOrders } from "../../batches/lib/batchOrderMailAdapter";
import HeaderName from "../../../shared/components/headerName";
import PrintModeSelect, { type PrintSelectOption } from "../../../shared/components/PrintModeSelect";

// ─── UI komponentlar ──────────────────────────────────────────────────────────
import MailStatCards from "./ui/MailStatCards";
import OrdersTable from "./ui/OrdersTable";
import SendButton from "./ui/SendButton";
import SendPostModal from "./ui/SendPostModal";
import { printOrders, type PrintMode } from "./lib/printMode";

// ─── Model ────────────────────────────────────────────────────────────────────
import { useMailDetailState } from "./model/useMailDetailState";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import { useOrders } from "../../../entities/orders";
import PopupConfirm from "../../../shared/components/popupConfirm";
import { useOrderQrScanner } from "../../../shared/lib/useOrderQrScanner";
import { getActiveManagerBranchIds, getBranches, type Branch } from "../../../entities/branch";
import { getUserBranchType } from "../../../widgets/Sidebar/model/menuConfig";
import {
  playMissingOrderFeedback,
  playScanFeedback,
  normalizeScannerCandidates,
} from "../../scan/lib/scanShared";
import { fetchScanDetail, getBackendErrorMessage } from "../../scan/lib/scanResource";
import { getMailTabPath, normalizeMailTab } from "../lib/navigation";
import BackButton from "../../../shared/ui/BackButton";
import PageContainer from "../../../shared/ui/PageContainer";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const MailDetailSkeleton = memo(() => (
  <div className="flex flex-col gap-5 animate-pulse">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 rounded-2xl bg-gray-200 dark:bg-white/8" />
      ))}
    </div>
    <div className="h-10 rounded-xl bg-gray-200 dark:bg-white/8" />
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="h-14 rounded-xl bg-gray-200 dark:bg-white/8" />
    ))}
  </div>
));
MailDetailSkeleton.displayName = "MailDetailSkeleton";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};

const toText = (value: unknown) => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const normalizeMatchText = (value: unknown) => toText(value).toLowerCase();

const unwrapScannedOrder = (payload: unknown) => {
  const source = asRecord(payload);
  const data = asRecord(source.data ?? source);
  const nestedData = asRecord(data.data ?? data);
  return asRecord(nestedData.order ?? data.order ?? nestedData);
};

const addOrderIdentifiers = (target: Set<string>, value: unknown) => {
  const record = asRecord(value);
  [
    "id",
    "qr_code_token",
    "qrCodeToken",
    "token",
    "order_token",
    "orderToken",
    "parent_order_id",
    "parentOrderId",
    "original_order_id",
    "originalOrderId",
    "source_order_id",
    "sourceOrderId",
    "split_from_order_id",
    "splitFromOrderId",
    "cancelled_from_order_id",
    "cancelledFromOrderId",
    "partly_sold_order_id",
    "partlySoldOrderId",
    "root_order_id",
    "rootOrderId",
    "base_order_id",
    "baseOrderId",
  ].forEach((key) => {
    const text = normalizeMatchText(record[key]);
    if (text) target.add(text);
  });

  [
    "order",
    "parent_order",
    "parentOrder",
    "original_order",
    "originalOrder",
    "source_order",
    "sourceOrder",
    "split_from_order",
    "splitFromOrder",
    "cancelled_from_order",
    "cancelledFromOrder",
  ].forEach((key) => {
    const nested = asRecord(record[key]);
    ["id", "qr_code_token", "qrCodeToken", "token"].forEach((nestedKey) => {
      const text = normalizeMatchText(nested[nestedKey]);
      if (text) target.add(text);
    });
  });
};

const getOrderIdentifiers = (value: unknown) => {
  const identifiers = new Set<string>();
  addOrderIdentifiers(identifiers, value);
  return identifiers;
};

const getComparableOrderInfo = (value: unknown) => {
  const order = asRecord(value);
  const customer = asRecord(order.customer);
  const market = asRecord(order.market);
  const district = asRecord(order.district);

  return {
    customerId: normalizeMatchText(order.customer_id ?? order.customerId ?? customer.id),
    name: normalizeMatchText(
      customer.name ??
        customer.full_name ??
        customer.fullName ??
        order.customer_name ??
        order.customerName ??
        order.name,
    ),
    phone: normalizeMatchText(
      customer.phone_number ??
        customer.phoneNumber ??
        customer.phone ??
        order.customer_phone ??
        order.customerPhone ??
        order.phone_number ??
        order.phone,
    ),
    marketId: normalizeMatchText(order.market_id ?? order.marketId ?? market.id),
    marketName: normalizeMatchText(market.name),
    districtId: normalizeMatchText(order.district_id ?? order.districtId ?? district.id),
    districtName: normalizeMatchText(district.name),
  };
};

const isSameCustomerMarketOrder = (left: unknown, right: unknown) => {
  const a = getComparableOrderInfo(left);
  const b = getComparableOrderInfo(right);
  const sameCustomer =
    Boolean(a.customerId && a.customerId === b.customerId) ||
    Boolean(a.phone && a.phone === b.phone) ||
    Boolean(a.name && a.name === b.name);
  const sameMarket = Boolean(a.marketId && a.marketId === b.marketId) || Boolean(a.marketName && a.marketName === b.marketName);
  const sameDistrict =
    !a.districtId && !a.districtName && !b.districtId && !b.districtName
      ? true
      : Boolean(a.districtId && a.districtId === b.districtId) ||
        Boolean(a.districtName && a.districtName === b.districtName);

  return sameCustomer && sameMarket && sameDistrict;
};

const extractOrderItems = (payload: unknown): PostOrder[] => {
  const response = payload as
    | PostOrder[]
    | {
      data?: PostOrder[] | { items?: PostOrder[]; data?: PostOrder[] };
      items?: PostOrder[];
    };

  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (!Array.isArray(response?.data) && Array.isArray(response?.data?.items)) return response.data.items;
  if (!Array.isArray(response?.data) && Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.items)) return response.items;

  return [];
};

const TODAY_MAIL_ORDER_STATUSES = new Set(["on the road", "new", "received", "waiting"]);

// ─── Xatolik holati ───────────────────────────────────────────────────────────
const ErrorState = memo(() => {
  const { t } = useTranslation("mails");

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
        <AlertTriangle size={32} className="text-red-400" />
      </div>
      <div className="text-center">
        <p className="text-gray-700 dark:text-white font-semibold">
          {t("loadError")}
        </p>
        <p className="text-gray-400 dark:text-white/60 text-sm mt-1">
          {t("refreshHint")}
        </p>
      </div>
    </div>
  );
});
ErrorState.displayName = "ErrorState";

// ─── Asosiy Page ──────────────────────────────────────────────────────────────
const MailDetailPage = () => {
  const { t } = useTranslation("mails");
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const postId = id;
  const { role } = useSelector((state: RootState) => state.role);
  const user = useSelector((state: RootState) => state.user.user);
  const managerBranchType = getUserBranchType(user);
  const isBranchReceiverManager =
    role === "manager" &&
    (managerBranchType === "HQ" ||
      managerBranchType === "PICKUP" ||
      managerBranchType === "REGIONAL" ||
      managerBranchType === "HYBRID");
  const isCourier = role === "courier";
  const isCourierLikeReceiver = isCourier || isBranchReceiverManager;
  const isSuperAdmin = role === "superadmin";
  const isHqRefusedReceiver =
    role === "admin" ||
    role === "superadmin" ||
    ((role === "manager" || role === "registrator") && managerBranchType === "HQ");
  const isBranchTransferRole = false;
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
  const isOldDetail = viewRaw === "old" || isAllBatchesDetail;
  const isReadOnlyRefusedCourier = isCourier && isRefusedDetail;
  const canReceiveRefusedPost = isCourierLikeReceiver || isHqRefusedReceiver;
  const fromTab = fromTabRaw;
  const { useGetRefusedMailsCourierByPostId } = useMails();
  const {
    data: regularResponse,
    isLoading: regularLoading,
    isError: regularError,
    refetch: refetchRegularDetail,
  } = useMailDetail(
    !isBranchTransferRole && !isRefusedDetail && !isAllBatchesDetail
      ? postId ?? ""
      : "",
  );
  const {
    data: refusedResponse,
    isLoading: refusedLoading,
    isError: refusedError,
  } = useGetRefusedMailsCourierByPostId(
    isRefusedDetail ? postId ?? "" : "",
  );
  const {
    data: transferBatchResponse,
    isLoading: transferBatchLoading,
    isError: transferBatchError,
    refetch: refetchTransferBatchDetail,
  } = useBatchRemainingDetail(isBranchTransferRole ? postId : undefined);
  const sendTransferBatch = useSendTransferBatch();
  const { apiRequest, api: notifApi } = useAppNotification();

  // URL ni tozalash: /mails/:id?from=... -> /mails/:id (state orqali saqlab qolamiz)
  useEffect(() => {
    if (!location.search) return;
    navigate(location.pathname, {
      replace: true,
      state: { fromTab: fromTabRaw, type: typeRaw, view: viewRaw },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [sentOrderIds, setSentOrderIds] = useState<Set<string>>(new Set());
  const isEffectiveRefusedDetail = isRefusedDetail;
  const shouldReceiveCurrentPost = isEffectiveRefusedDetail ? canReceiveRefusedPost : isCourierLikeReceiver;
  const regularOrdersFromPost = regularResponse?.data?.allOrdersByPostId ?? [];
  const fallbackRegionId = toText(navState?.fallbackRegionId);
  const fallbackRegionName = toText(navState?.fallbackRegionName);
  const shouldLoadRegionFallback =
    !isAllBatchesDetail &&
    !isBranchTransferRole &&
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
  const regionFallbackOrders = useMemo(
    () =>
      extractOrderItems(regionFallbackResponse).filter((order) =>
        TODAY_MAIL_ORDER_STATUSES.has(order.status),
      ),
    [regionFallbackResponse],
  );
  const rawOrders = useMemo<PostOrder[]>(() => {
    if (isAllBatchesDetail) {
      return [];
    }

    if (isBranchTransferRole) {
      return mapBatchOrdersToPostOrders(transferBatchResponse);
    }

    return isEffectiveRefusedDetail
      ? refusedResponse?.data ?? []
      : regularOrdersFromPost.length > 0
        ? regularOrdersFromPost
        : regionFallbackOrders;
  }, [
    isAllBatchesDetail,
    isBranchTransferRole,
    transferBatchResponse,
    isEffectiveRefusedDetail,
    refusedResponse,
    regularOrdersFromPost,
    regionFallbackOrders,
  ]);
  const orders = useMemo(
    () =>
      rawOrders.filter((order) => {
        if (sentOrderIds.has(order.id)) return false;

        if (
          shouldReceiveCurrentPost &&
          !isEffectiveRefusedDetail &&
          !isOldDetail &&
          !isBranchTransferRole &&
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
      isBranchTransferRole,
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
  const { selectedIds, allSelected, someSelected, toggleAll, toggleOne, selectOne, clearSelection } =
    useMailDetailState(orders);

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
  const { SendToPost } = useOrders();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);

  // ─── Region nomi ──────────────────────────────────────────────────────────
  const regionName = useMemo(
    () =>
      (isBranchTransferRole
        ? transferBatchResponse?.to_branch?.name
        : null) ??
      orders[0]?.district?.region?.name ??
      orders[0]?.region?.name ??
      (fallbackRegionName ||
      (isEffectiveRefusedDetail
        ? t("refusedMailNumber", { id: postId })
        : t("mailNumberWithId", { id: postId }))),
    [
      isBranchTransferRole,
      transferBatchResponse,
      orders,
      fallbackRegionName,
      postId,
      isEffectiveRefusedDetail,
      t,
    ],
  );

  // ─── Region ID (courier fetch uchun) ─────────────────────────────────────
  const regionId = useMemo(
    () => orders[0]?.region_id ?? orders[0]?.district?.region_id ?? "",
    [orders],
  );

  const selectScannedOrder = useCallback((order: PostOrder) => {
    if (selectedIds.has(order.id)) {
      void playScanFeedback("duplicate", t("common:scannerFeedbackDuplicate"));
      notifApi.warning({
        message: t("common:scannerFeedbackDuplicate"),
        description: `#${order.id}`,
        placement: "topRight",
        duration: 2,
      });
      return;
    }

    selectOne(order.id);
    void playScanFeedback("success");
    notifApi.success({
      message: t("orderSelected"),
      description: `#${order.id}`,
      placement: "topRight",
      duration: 2,
    });
  }, [notifApi, selectOne, selectedIds, t]);

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

      playMissingOrderFeedback();
      notifApi.warning({
        message: t("qrNotFound"),
        description: t("mailScanMissing"),
        placement: "topRight",
        duration: 3,
      });
    } catch (error) {
      void playScanFeedback("error");
      notifApi.error({
        message: t("qrNotFound"),
        description: getBackendErrorMessage(error) ?? t("mailScanMissing"),
        placement: "topRight",
        duration: 3,
      });
    }
  }, [notifApi, orders, selectScannedOrder, t]);

  useOrderQrScanner({
    orders,
    enabled: orders.length > 0 && !isOldDetail && !isReadOnlyRefusedCourier,
    onMatch: selectScannedOrder,
    onMissing: (rawValue) => {
      void handleMissingScannedOrder(rawValue);
    },
  });

  const handleBack = useCallback(() => {
    navigate(`${getMailTabPath(normalizeMailTab(fromTab))}${fromSearch}`);
  }, [fromSearch, fromTab, navigate]);

  // ─── Pochtani qabul qilish (faqat courier uchun) ─────────────────────────
  const handleReceive = useCallback(() => {
    if (selectedIds.size === 0 || !postId) return;
    const receivedIds = Array.from(selectedIds);

    apiRequest({
      request: () =>
        (isEffectiveRefusedDetail ? receiveCanceledPost : receivePost).mutateAsync({
          postId,
          payload: { order_ids: receivedIds },
        }),
      successMessage: isEffectiveRefusedDetail
        ? t("receiveRefusedSuccess")
        : t("receiveSuccess"),
      errorMessage: isEffectiveRefusedDetail
        ? t("receiveRefusedError")
        : t("receiveError"),
      onSuccess: () => {
        setSentOrderIds((prev) => {
          const next = new Set(prev);
          receivedIds.forEach((id) => next.add(id));
          return next;
        });
        clearSelection();
        void refetchRegularDetail();
      },
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

  // ─── Modal ochish (Send — courier bo'lmaganlar uchun) ─────────────────────
  const handleSend = useCallback(() => {
    if (isBranchTransferRole) {
      if (selectedIds.size === 0 || !postId || sendTransferBatch.isPending) return;

      apiRequest({
        request: () =>
          sendTransferBatch.mutateAsync({
            batchId: postId,
            orderIds: Array.from(selectedIds),
          }),
        successMessage: t("batchSendMainSuccess"),
        errorMessage: t("batchSendMainError"),
        onSuccess: async () => {
          clearSelection();
          await refetchTransferBatchDetail();
        },
      });
      return;
    }

    if (selectedIds.size === 0 || !postId || !regionId || isCheckingCouriers) return;

    setIsCheckingCouriers(true);

    Promise.all([
      getBranches({ page: 1, limit: 500, status: "active" }),
      getActiveManagerBranchIds(),
    ])
      .then(([response, managerBranchIds]) => {
        const branches = (response?.data ?? []).filter(
          (branch) => branch.region?.id === regionId && branch.status === "active",
        ).map((branch) => ({
          ...branch,
          has_manager: Boolean(branch.has_manager || managerBranchIds.has(branch.id)),
        }));

        if (branches.length === 0) {
          apiRequest({
            request: () => Promise.reject(new Error("no_branch")),
            errorMessage: t("noActiveBranchInRegion"),
            successMessage: "",
          });
          return;
        }

        setBranchRecipients(branches);
        setIsModalOpen(true);
      })
      .catch(() => {
        apiRequest({
          request: () => Promise.reject(new Error("branches_fetch_failed")),
          errorMessage: t("branchesLoadError"),
          successMessage: "",
        });
      })
      .finally(() => {
        setIsCheckingCouriers(false);
      });
  }, [
    isBranchTransferRole,
    selectedIds,
    postId,
    sendTransferBatch,
    apiRequest,
    clearSelection,
    refetchTransferBatchDetail,
    regionId,
    isCheckingCouriers,
    t,
  ]);

  const selectedOrders = useMemo(
    () => orders.filter((order: PostOrder) => selectedIds.has(order.id)),
    [orders, selectedIds],
  );
  const printOptions = useMemo<PrintSelectOption[]>(
    () => [
      {
        id: "browser",
        label: t("printOptions.browser.label"),
        hint: t("printOptions.browser.hint"),
        icon: <Globe size={14} className="text-info" />,
      },
      {
        id: "pdf_100x60",
        label: t("printOptions.labelPdf.label"),
        hint: t("printOptions.labelPdf.hint"),
        icon: <FileText size={14} className="text-error" />,
      },
    ],
    [t],
  );

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

  const handlePrintOne = useCallback(
    (order: PostOrder, mode: PrintMode) => {
      handlePrintOrders(mode, [order]);
    },
    [handlePrintOrders],
  );

  const handleDeleteOne = useCallback((orderId: string) => {
    setDeleteTargetIds([orderId]);
    setIsDeleteConfirmOpen(true);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (deleteTargetIds.length === 0) return;

    apiRequest({
      request: () => SendToPost.mutateAsync(deleteTargetIds),
      successMessage: t("selectedOrdersRemovedSuccess"),
      errorMessage: t("selectedOrdersRemovedError"),
      onSuccess: async () => {
        setIsDeleteConfirmOpen(false);
        setDeleteTargetIds([]);
        clearSelection();
        const refreshed = await refetchRegularDetail();
        const remainingOrders = refreshed.data?.data?.allOrdersByPostId?.length ?? 0;

        if (remainingOrders === 0) {
          navigate(getMailTabPath("today"));
        }
      },
    });
  }, [deleteTargetIds, apiRequest, SendToPost, t, clearSelection, refetchRegularDetail, navigate]);

  // ─── Loading ──────────────────────────────────────────────────────────────
  const isRefusedFallbackPending = false;

  if (regularLoading || refusedLoading || transferBatchLoading || regionFallbackLoading || isRefusedFallbackPending)
    return (
      <PageContainer>
        <MailDetailSkeleton />
      </PageContainer>
    );

  // ─── Error ────────────────────────────────────────────────────────────────
  if (regularError || refusedError || transferBatchError)
    return (
      <PageContainer>
        <ErrorState />
      </PageContainer>
    );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <PageContainer className="flex flex-col gap-5">
      {/* Sarlavha */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <BackButton onClick={handleBack} className="h-10 min-w-10 shrink-0 rounded-xl px-2" label="" />
          <HeaderName
            name={t("regionOrdersTitle", { region: regionName })}
            description={
              isOldDetail
                ? t("oldOrdersCount", { count: orders.length })
                : isEffectiveRefusedDetail
                ? t("refusedOrdersCount", { count: orders.length })
                : t("ordersCount", { count: orders.length })
            }
            icon={
              isEffectiveRefusedDetail ? (
                <Ban size={20} className="text-white" />
              ) : (
                <MapPin size={20} className="text-white" />
              )
            }
            onIconClick={handleBack}
          />
        </div>
        {!isOldDetail && (
          <PrintModeSelect
            count={selectedIds.size}
            onSelect={(mode) => handlePrint(mode as PrintMode)}
            buttonLabel={t("print")}
            menuLabel={t("printMenu")}
            options={printOptions}
          />
        )}
      </div>

      {/* Stat kartalar */}
      <MailStatCards
        totalOrders={orders.length}
        selectedCount={selectedIds.size}
        homeStats={homeStats}
        centerStats={centerStats}
        showSelectionCard={!isOldDetail}
      />

      {role === "manager" && isEffectiveRefusedDetail && !isOldDetail ? (
        <div className="flex items-center gap-3 rounded-2xl border border-main/20 bg-main/10 px-4 py-3 text-main dark:text-white">
          <ScanLine size={20} className="shrink-0" />
          <p className="m-0 text-sm font-semibold">{t("refusedScanHint")}</p>
        </div>
      ) : null}

      {/* Jadval */}
      <OrdersTable
        orders={orders}
        selectedIds={selectedIds}
        allSelected={allSelected}
        someSelected={someSelected}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
        onPrintOne={handlePrintOne}
        onDeleteOne={handleDeleteOne}
        canDelete={isSuperAdmin && !isEffectiveRefusedDetail && !isOldDetail}
        variant={isOldDetail ? "history" : "default"}
        readOnly={isOldDetail || isReadOnlyRefusedCourier}
      />

      {/* Rol asosida tugma */}
      {orders.length > 0 && !isOldDetail && !isReadOnlyRefusedCourier && (
        <div className="flex flex-col gap-3">
          <SendButton
            selectedCount={selectedIds.size}
            isCourier={shouldReceiveCurrentPost}
            mode={isEffectiveRefusedDetail ? "receive" : "send"}
            onSend={handleSend}
            onReceive={handleReceive}
            disabled={isEffectiveRefusedDetail && !canReceiveRefusedPost}
            isBusy={
              shouldReceiveCurrentPost || isEffectiveRefusedDetail
                ? isReceiving
                : isBranchTransferRole
                  ? sendTransferBatch.isPending
                  : isCheckingCouriers
            }
          />
        </div>
      )}

      {/* Pochta jo'natish modali — filial tanlash */}
      {!isCourierLikeReceiver && !isEffectiveRefusedDetail && !isOldDetail && !isBranchTransferRole && (
        <SendPostModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          postId={postId ?? ""}
          branches={branchRecipients}
          selectedIds={selectedIds}
          onSuccess={handleSendSuccess}
        />
      )}
      <PopupConfirm
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setDeleteTargetIds([]);
        }}
        onConfirm={handleDeleteSelected}
        isLoading={SendToPost.isPending}
        title={t("deleteSelectedOrdersTitle")}
        message={t("deleteSelectedOrdersMessage", { count: deleteTargetIds.length })}
        confirmLabel={t("delete")}
        variant="danger"
      />
    </PageContainer>
  );
};

export default memo(MailDetailPage);
