import { memo, useMemo, useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, MapPin } from "lucide-react";
import { useMailDetail, useMails } from "../../../entities/mails";
import HeaderName from "../../../shared/components/headerName";

// ─── UI komponentlar ──────────────────────────────────────────────────────────
import MailStatCards from "./ui/MailStatCards";
import OrdersTable from "./ui/OrdersTable";
import SendButton from "./ui/SendButton";
import SendPostModal from "./ui/SendPostModal";

// ─── Model ────────────────────────────────────────────────────────────────────
import { useMailDetailState } from "./model/useMailDetailState";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";

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
  const { postId } = useParams<{ postId: string }>();
  const {role} = useSelector((state: RootState) => state.role);
  const isCourier = role === "courier";
  const { getTodayMailsCourier} = useMails();
  const { data: response, isLoading, isError } = isCourier ? getTodayMailsCourier(postId ?? "") : useMailDetail(postId ?? "");
  const navigate = useNavigate();

  const orders = response?.data?.allOrdersByPostId ?? [];
  const homeStats = response?.data?.homeOrders;
  const centerStats = response?.data?.centerOrders;

  // ─── Checkbox state ────────────────────────────────────────────────────────
  const { selectedIds, allSelected, someSelected, toggleAll, toggleOne, clearSelection } =
    useMailDetailState(orders);

  // ─── Modal state ───────────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ─── Region nomi ──────────────────────────────────────────────────────────
  const regionName = useMemo(
    () => orders[0]?.district?.region?.name ?? `Pochta #${postId}`,
    [orders, postId],
  );

  // ─── Region ID (courier fetch uchun) ─────────────────────────────────────
  const regionId = useMemo(() => orders[0]?.region_id ?? "", [orders]);

  // ─── Modal ochish ─────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    if (selectedIds.size === 0) return;
    setIsModalOpen(true);
  }, [selectedIds]);

  // ─── Muvaffaqiyatli yuborilgandan keyin ───────────────────────────────────
  const handleSendSuccess = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (isLoading)
    return (
      <div className="p-6 rounded-2xl bg-sidebar dark:bg-maindark">
        <MailDetailSkeleton />
      </div>
    );

  // ─── Error ────────────────────────────────────────────────────────────────
  if (isError)
    return (
      <div className="p-6 rounded-2xl bg-sidebar dark:bg-maindark">
        <ErrorState />
      </div>
    );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 rounded-2xl bg-sidebar dark:bg-maindark flex flex-col gap-5">
      {/* Sarlavha */}
      <div className="max-w-100" onClick={() => navigate(-1)}>
        <HeaderName
          name={`${regionName} Buyurtmalari`}
          description={`${orders.length} ta buyurtma mavjud`}
          icon={<MapPin size={20} className="text-white" />}
        />
      </div>

      {/* Stat kartalar */}
      <MailStatCards
        totalOrders={orders.length}
        selectedCount={selectedIds.size}
        homeStats={homeStats}
        centerStats={centerStats}
      />

      {/* Jadval */}
      <OrdersTable
        orders={orders}
        selectedIds={selectedIds}
        allSelected={allSelected}
        someSelected={someSelected}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
      />

      {/* Pochta jo'natish tugmasi */}
      {orders.length > 0 && (
        <SendButton selectedCount={selectedIds.size} onSend={handleSend} />
      )}

      {/* Pochta jo'natish modali */}
      <SendPostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        postId={postId ?? ""}
        regionId={regionId}
        selectedIds={selectedIds}
        onSuccess={handleSendSuccess}
      />
    </div>
  );
};

export default memo(MailDetailPage);
