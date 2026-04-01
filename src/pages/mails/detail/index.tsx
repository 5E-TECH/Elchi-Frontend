import { memo, useEffect, useMemo, useCallback, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Ban, MapPin } from "lucide-react";
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

// ─── UI komponentlar ──────────────────────────────────────────────────────────
import MailStatCards from "./ui/MailStatCards";
import OrdersTable from "./ui/OrdersTable";
import SendButton from "./ui/SendButton";
import SendPostModal from "./ui/SendPostModal";
import PrintModeSelect from "./ui/PrintModeSelect";
import { printOrders, type PrintMode } from "./lib/printMode";
import PrintOnlyOrders from "./ui/PrintOnlyOrders";

// ─── Model ────────────────────────────────────────────────────────────────────
import { useMailDetailState } from "./model/useMailDetailState";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";

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
const ErrorState = memo(() => (
  <div className="flex flex-col items-center justify-center py-20 gap-4">
    <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
      <AlertTriangle size={32} className="text-red-400" />
    </div>
    <div className="text-center">
      <p className="text-gray-700 dark:text-white font-semibold">
        Ma'lumotlarni yuklab bo'lmadi
      </p>
      <p className="text-gray-400 dark:text-white/60 text-sm mt-1">
        Iltimos, sahifani yangilang
      </p>
    </div>
  </div>
));
ErrorState.displayName = "ErrorState";

// ─── Asosiy Page ──────────────────────────────────────────────────────────────
const MailDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const postId = id;
  const { role } = useSelector((state: RootState) => state.role);
  const isCourier = role === "courier";
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

  // ─── Region nomi ──────────────────────────────────────────────────────────
  const regionName = useMemo(
    () =>
      orders[0]?.district?.region?.name ??
      orders[0]?.region?.name ??
      (isRefusedDetail ? `Rad etilgan pochta #${postId}` : `Pochta #${postId}`),
    [orders, postId, isRefusedDetail],
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
        ? "Rad etilgan pochta muvaffaqiyatli qabul qilindi."
        : "Pochta muvaffaqiyatli qabul qilindi.",
      errorMessage: isRefusedDetail
        ? "Rad etilgan pochtani qabul qilishda xatolik yuz berdi."
        : "Pochtani qabul qilishda xatolik yuz berdi.",
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
            errorMessage: "Bu viloyatda aktiv courier mavjud emas.",
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
            successMessage: `Pochta ${courier.name} ga muvaffaqiyatli jo'natildi.`,
            errorMessage: "Pochtani jo'natishda xatolik yuz berdi.",
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
          errorMessage: "Courierlarni yuklab bo'lmadi.",
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

  const [browserPrintOrders, setBrowserPrintOrders] = useState<PostOrder[]>([]);

  useEffect(() => {
    const onAfter = () => setBrowserPrintOrders([]);
    window.addEventListener("afterprint", onAfter);
    return () => window.removeEventListener("afterprint", onAfter);
  }, []);

  const handlePrint = useCallback(
    (mode: PrintMode) => {
      if (mode === "browser") {
        if (selectedOrders.length === 0) return;
        setBrowserPrintOrders(selectedOrders);
        // next tick: allow PrintOnlyOrders to render
        setTimeout(() => window.print(), 50);
        return;
      }

      printOrders(mode, selectedOrders);
    },
    [selectedOrders],
  );

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
            name={`${regionName} Buyurtmalari`}
            description={
              isOldDetail
                ? `${orders.length} ta eski buyurtma mavjud`
                : isRefusedDetail
                ? `${orders.length} ta rad etilgan buyurtma mavjud`
                : `${orders.length} ta buyurtma mavjud`
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
        {!isOldDetail && <PrintModeSelect count={selectedIds.size} onSelect={handlePrint} />}
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
        variant={isOldDetail ? "history" : "default"}
        readOnly={isReadOnlyRefusedCourier}
      />

      {/* Rol asosida tugma */}
      {orders.length > 0 && !isOldDetail && !isReadOnlyRefusedCourier && (
        <SendButton
          selectedCount={selectedIds.size}
          isCourier={isCourier}
          mode={isRefusedDetail ? "receive" : "send"}
          onSend={handleSend}
          onReceive={handleReceive}
          isBusy={!isCourier && !isRefusedDetail && isCheckingCouriers}
        />
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

      {browserPrintOrders.length > 0 && <PrintOnlyOrders orders={browserPrintOrders} />}
    </div>
  );
};

export default memo(MailDetailPage);
