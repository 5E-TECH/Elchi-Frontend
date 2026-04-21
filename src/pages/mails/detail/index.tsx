import { memo, useEffect, useMemo, useCallback, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Ban, FileText, Globe, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useMails,
  useMailDetail,
  type PostOrder,
  fetchCouriersByRegion,
  useReceiveCanceledPost,
  useReceivePost,
  useSendPost,
} from "../../../entities/mails";
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
  const isCourier = role === "courier";
  const isSuperAdmin = role === "superadmin";
  const navState = location.state as { fromTab?: string; type?: string; view?: string } | null;

  const search = location.search ? new URLSearchParams(location.search) : null;
  const fromTabRaw = navState?.fromTab ?? search?.get("from") ?? undefined;
  const typeRaw = navState?.type ?? search?.get("type") ?? undefined;
  const viewRaw = navState?.view ?? search?.get("view") ?? undefined;

  const isRefusedDetail = typeRaw === "refused";
  const isOldDetail = viewRaw === "old";
  const isReadOnlyRefusedCourier = isCourier && isRefusedDetail;
  const fromTab = fromTabRaw;
  const { getRefusedMailsCourierByPostId } = useMails();
  const {
    data: regularResponse,
    isLoading: regularLoading,
    isError: regularError,
    refetch: refetchRegularDetail,
  } = useMailDetail(isRefusedDetail ? "" : postId ?? "");
  const {
    data: refusedResponse,
    isLoading: refusedLoading,
    isError: refusedError,
  } = getRefusedMailsCourierByPostId(isRefusedDetail ? postId ?? "" : "");
  const { apiRequest } = useAppNotification();

  // URL ni tozalash: /mails/:id?from=... -> /mails/:id (state orqali saqlab qolamiz)
  useEffect(() => {
    if (!location.search) return;
    navigate(location.pathname, {
      replace: true,
      state: { fromTab: fromTabRaw, type: typeRaw, view: viewRaw },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orders = useMemo<PostOrder[]>(
    () =>
      isRefusedDetail
        ? refusedResponse?.data ?? []
        : regularResponse?.data?.allOrdersByPostId ?? [],
    [isRefusedDetail, refusedResponse, regularResponse],
  );
  const homeStats = useMemo(() => {
    if (!isRefusedDetail) return regularResponse?.data?.homeOrders;

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
  }, [isRefusedDetail, regularResponse, orders]);
  const centerStats = useMemo(() => {
    if (!isRefusedDetail) return regularResponse?.data?.centerOrders;

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
  }, [isRefusedDetail, regularResponse, orders]);

  // ─── Checkbox state ────────────────────────────────────────────────────────
  const { selectedIds, allSelected, someSelected, toggleAll, toggleOne, clearSelection } =
    useMailDetailState(orders);

  // ─── Modal state (faqat courier bo'lmaganlar uchun) ────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCheckingCouriers, setIsCheckingCouriers] = useState(false);

  // ─── Receive post hook (faqat courier uchun) ──────────────────────────────
  const receivePost = useReceivePost();
  const receiveCanceledPost = useReceiveCanceledPost();
  const sendPost = useSendPost();
  const { SendToPost } = useOrders();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);

  // ─── Region nomi ──────────────────────────────────────────────────────────
  const regionName = useMemo(
    () =>
      orders[0]?.district?.region?.name ??
      orders[0]?.region?.name ??
      (isRefusedDetail
        ? t("refusedMailNumber", { id: postId })
        : t("mailNumberWithId", { id: postId })),
    [orders, postId, isRefusedDetail, t],
  );

  // ─── Region ID (courier fetch uchun) ─────────────────────────────────────
  const regionId = useMemo(() => orders[0]?.region_id ?? "", [orders]);

  const handleBack = useCallback(() => {
    const tab =
      fromTab === "today" || fromTab === "refused" || fromTab === "old"
        ? fromTab
        : "today";
    navigate(`/mails?tab=${tab}`);
  }, [fromTab, navigate]);

  // ─── Pochtani qabul qilish (faqat courier uchun) ─────────────────────────
  const handleReceive = useCallback(() => {
    if (selectedIds.size === 0 || !postId) return;

    apiRequest({
      request: () =>
        (isRefusedDetail ? receiveCanceledPost : receivePost).mutateAsync({
          postId,
          payload: { order_ids: Array.from(selectedIds) },
        }),
      successMessage: isRefusedDetail
        ? t("receiveRefusedSuccess")
        : t("receiveSuccess"),
      errorMessage: isRefusedDetail
        ? t("receiveRefusedError")
        : t("receiveError"),
      onSuccess: () => {
        clearSelection();
        navigate("/mails");
      },
    });
  }, [
    selectedIds,
    postId,
    isRefusedDetail,
    receiveCanceledPost,
    receivePost,
    apiRequest,
    clearSelection,
    navigate,
  ]);

  // ─── Muvaffaqiyatli yuborilgandan keyin ───────────────────────────────────
  const handleSendSuccess = useCallback(async () => {
    clearSelection();
    const refreshed = await refetchRegularDetail();
    const remainingOrders = refreshed.data?.data?.allOrdersByPostId?.length ?? 0;

    if (remainingOrders === 0) {
      navigate("/mails?tab=today");
    }
  }, [clearSelection, refetchRegularDetail, navigate]);

  // ─── Modal ochish (Send — courier bo'lmaganlar uchun) ─────────────────────
  const handleSend = useCallback(() => {
    if (selectedIds.size === 0 || !postId || !regionId || isCheckingCouriers) return;

    setIsCheckingCouriers(true);

    fetchCouriersByRegion(regionId)
      .then((response) => {
        const couriers = response?.data?.items ?? [];

        if (couriers.length === 0) {
          apiRequest({
            request: () => Promise.reject(new Error("no_courier")),
            errorMessage: t("noActiveCourierInRegion"),
            successMessage: "",
          });
          return;
        }

        if (couriers.length === 1) {
          const courier = couriers[0];

          apiRequest({
            request: () =>
              sendPost.mutateAsync({
                postId,
                payload: { orderIds: Array.from(selectedIds), courierId: courier.id },
              }),
            successMessage: t("sendCourierSuccess", { name: courier.name }),
            errorMessage: t("sendError"),
            onSuccess: () => {
              void handleSendSuccess();
            },
          });
          return;
        }

        setIsModalOpen(true);
      })
      .catch(() => {
        apiRequest({
          request: () => Promise.reject(new Error("couriers_fetch_failed")),
          errorMessage: t("couriersLoadError"),
          successMessage: "",
        });
      })
      .finally(() => {
        setIsCheckingCouriers(false);
      });
  }, [selectedIds, postId, regionId, isCheckingCouriers, apiRequest, sendPost, handleSendSuccess]);

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
        icon: <Globe size={14} className="text-[var(--color-info)]" />,
      },
      {
        id: "pdf_100x60",
        label: t("printOptions.labelPdf.label"),
        hint: t("printOptions.labelPdf.hint"),
        icon: <FileText size={14} className="text-[var(--color-error)]" />,
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
          navigate("/mails?tab=today");
        }
      },
    });
  }, [deleteTargetIds, apiRequest, SendToPost, t, clearSelection, refetchRegularDetail, navigate]);

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (regularLoading || refusedLoading)
    return (
      <div className="p-6 rounded-2xl bg-sidebar dark:bg-maindark">
        <MailDetailSkeleton />
      </div>
    );

  // ─── Error ────────────────────────────────────────────────────────────────
  if (regularError || refusedError)
    return (
      <div className="p-6 rounded-2xl bg-sidebar dark:bg-maindark">
        <ErrorState />
      </div>
    );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 rounded-2xl bg-sidebar dark:bg-maindark flex flex-col gap-5">
      {/* Sarlavha */}
      <div className="flex items-center justify-between gap-4">
        <div className="max-w-100">
          <HeaderName
            name={t("regionOrdersTitle", { region: regionName })}
            description={
              isOldDetail
                ? t("oldOrdersCount", { count: orders.length })
                : isRefusedDetail
                ? t("refusedOrdersCount", { count: orders.length })
                : t("ordersCount", { count: orders.length })
            }
            icon={
              isRefusedDetail ? (
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
        canDelete={isSuperAdmin && !isRefusedDetail}
        variant={isOldDetail ? "history" : "default"}
        readOnly={isReadOnlyRefusedCourier}
      />

      {/* Rol asosida tugma */}
      {orders.length > 0 && !isOldDetail && !isReadOnlyRefusedCourier && (
        <div className="flex flex-col gap-3">
          <SendButton
            selectedCount={selectedIds.size}
            isCourier={isCourier}
            mode={isRefusedDetail ? "receive" : "send"}
            onSend={handleSend}
            onReceive={handleReceive}
            isBusy={!isCourier && !isRefusedDetail && isCheckingCouriers}
          />
        </div>
      )}

      {/* Pochta jo'natish modali — faqat courier bo'lmaganlar uchun */}
      {!isCourier && !isRefusedDetail && !isOldDetail && (
        <SendPostModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          postId={postId ?? ""}
          regionId={regionId}
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
    </div>
  );
};

export default memo(MailDetailPage);
