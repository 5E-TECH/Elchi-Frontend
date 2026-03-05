import { memo, useEffect, useState } from "react";
import { X, Send, User, Phone, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import Popup from "../../../../shared/ui/Popup";
import { useAppNotification } from "../../../../app/providers/notification/NotificationProvider";
import {
    useGetCouriersByRegion,
    useSendPost,
    type CourierItem,
} from "../../../../entities/mails";

// ─── Props ────────────────────────────────────────────────────────────────────
interface SendPostModalProps {
    isOpen: boolean;
    onClose: () => void;
    postId: string;
    regionId: string;
    selectedIds: Set<string>;
    onSuccess: () => void;
}

// ─── Courier karta ────────────────────────────────────────────────────────────
const CourierCard = memo(
    ({
        courier,
        selected,
        onSelect,
    }: {
        courier: CourierItem;
        selected: boolean;
        onSelect: (id: string) => void;
    }) => (
        <button
            type="button"
            onClick={() => onSelect(courier.id)}
            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 transition-all duration-200 cursor-pointer text-left ${selected
                    ? "border-main bg-main/10 dark:bg-main/15"
                    : "border-gray-100 dark:border-white/10 bg-white dark:bg-white/4 hover:border-main/40 hover:bg-gray-50 dark:hover:bg-white/6"
                }`}
        >
            {/* Avatar */}
            <div
                className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all duration-200 ${selected
                        ? "bg-main text-white"
                        : "bg-main/10 dark:bg-main/20 text-main"
                    }`}
            >
                <User size={18} />
            </div>

            {/* Ma'lumotlar */}
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span
                    className={`text-sm font-semibold truncate ${selected ? "text-main" : "text-gray-800 dark:text-white"
                        }`}
                >
                    {courier.name}
                </span>
                <div className="flex items-center gap-1">
                    <Phone size={11} className="text-gray-400 dark:text-white/40 shrink-0" />
                    <span className="text-xs text-gray-400 dark:text-white/50 truncate">
                        {courier.phone_number}
                    </span>
                </div>
            </div>

            {/* Check icon */}
            {selected && (
                <CheckCircle2 size={20} className="text-main shrink-0" />
            )}
        </button>
    ),
);
CourierCard.displayName = "CourierCard";

// ─── Asosiy modal ─────────────────────────────────────────────────────────────
const SendPostModal = memo(
    ({
        isOpen,
        onClose,
        postId,
        regionId,
        selectedIds,
        onSuccess,
    }: SendPostModalProps) => {
        const { api: notify } = useAppNotification();
        const [selectedCourierId, setSelectedCourierId] = useState<string>("");
        const [autoHandled, setAutoHandled] = useState(false);

        // ─── API hooks ────────────────────────────────────────────────────────
        const {
            data: couriersResp,
            isLoading,
            isError,
        } = useGetCouriersByRegion(regionId, isOpen);

        const sendPost = useSendPost();

        // ─── Real courier ro'yxati (backend: data.items) ──────────────────────
        const couriers = couriersResp?.data?.items ?? [];
        const orderIds = Array.from(selectedIds);

        // ─── Auto-handle: 0 yoki 1 courier ────────────────────────────────────
        useEffect(() => {
            if (!isOpen || isLoading || isError || autoHandled) return;

            // 0 courier — notification, yop
            if (couriers.length === 0) {
                setAutoHandled(true);
                notify.warning({
                    message: "Courier topilmadi",
                    description: "Bu viloyatda aktiv courier mavjud emas.",
                    placement: "topRight",
                    duration: 4,
                });
                onClose();
                return;
            }

            // 1 courier — popup ochilmasdan darhol yuborish
            if (couriers.length === 1) {
                setAutoHandled(true);
                sendPost.mutate(
                    {
                        postId,
                        payload: { orderIds, courierId: couriers[0].id },
                    },
                    {
                        onSuccess: () => {
                            notify.success({
                                message: "Muvaffaqiyatli",
                                description: `Pochta ${couriers[0].name} ga jo'natildi.`,
                                placement: "topRight",
                                duration: 4,
                            });
                            onSuccess();
                            onClose();
                        },
                        onError: () => {
                            notify.error({
                                message: "Xatolik",
                                description: "Pochtani jo'natishda xatolik yuz berdi.",
                                placement: "topRight",
                                duration: 5,
                            });
                            onClose();
                        },
                    },
                );
                return;
            }

            // 2+ courier — popup ko'rsatiladi (alohida handle)
        }, [isOpen, isLoading, isError, couriers, autoHandled]);

        // ─── Modal yopilganda state tozalash ─────────────────────────────────
        const handleClose = () => {
            if (sendPost.isPending) return;
            setSelectedCourierId("");
            setAutoHandled(false);
            sendPost.reset();
            onClose();
        };

        // ─── 2+ courier: yuborish ─────────────────────────────────────────────
        const handleSend = () => {
            if (!selectedCourierId || sendPost.isPending) return;
            sendPost.mutate(
                {
                    postId,
                    payload: { orderIds, courierId: selectedCourierId },
                },
                {
                    onSuccess: () => {
                        notify.success({
                            message: "Muvaffaqiyatli",
                            description: "Pochta muvaffaqiyatli jo'natildi.",
                            placement: "topRight",
                            duration: 4,
                        });
                        setSelectedCourierId("");
                        setAutoHandled(false);
                        sendPost.reset();
                        onSuccess();
                        onClose();
                    },
                    onError: () => {
                        notify.error({
                            message: "Xatolik",
                            description: "Pochtani jo'natishda xatolik yuz berdi.",
                            placement: "topRight",
                            duration: 5,
                        });
                    },
                },
            );
        };

        // ─── Faqat 2+ courier da popup ko'rsatiladi ───────────────────────────
        // 0 yoki 1 courier bo'lsa useEffect da handle qilinadi, popup ochilmaydi
        const showPopup = isOpen && (isLoading || isError || couriers.length >= 2);

        return (
            <Popup isShow={showPopup} onClose={handleClose}>
                <div className="w-[90vw] max-w-md bg-white dark:bg-maindark rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-main flex items-center justify-center">
                                <Send size={16} className="text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-800 dark:text-white">
                                    Courier tanlang
                                </p>
                                <p className="text-xs text-gray-400 dark:text-white/50">
                                    {orderIds.length} ta buyurtma jo'natiladi
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={sendPost.isPending}
                            className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/8 text-gray-400 dark:text-white/50 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 disabled:opacity-40 cursor-pointer"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="px-5 py-4">
                        {/* Loading */}
                        {isLoading && (
                            <div className="flex flex-col items-center justify-center py-10 gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-main/10 flex items-center justify-center">
                                    <Loader2 size={28} className="text-main animate-spin" />
                                </div>
                                <p className="text-sm font-medium text-gray-600 dark:text-white/70">
                                    Courierlar yuklanmoqda...
                                </p>
                            </div>
                        )}

                        {/* Xato */}
                        {isError && !isLoading && (
                            <div className="flex flex-col items-center justify-center py-10 gap-3">
                                <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
                                    <AlertTriangle size={28} className="text-red-400" />
                                </div>
                                <p className="text-sm font-semibold text-gray-700 dark:text-white text-center">
                                    Courierlarni yuklab bo'lmadi
                                </p>
                                <p className="text-xs text-gray-400 dark:text-white/50 text-center">
                                    Iltimos, qayta urinib ko'ring
                                </p>
                            </div>
                        )}

                        {/* 2+ courier — tanlash ro'yxati */}
                        {!isLoading && !isError && couriers.length >= 2 && (
                            <>
                                <p className="text-xs text-gray-400 dark:text-white/50 mb-3">
                                    Quyidagi courierlardan birini tanlang:
                                </p>
                                <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                                    {couriers.map((courier) => (
                                        <CourierCard
                                            key={courier.id}
                                            courier={courier}
                                            selected={selectedCourierId === courier.id}
                                            onSelect={setSelectedCourierId}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer — faqat 2+ courier da */}
                    {!isLoading && !isError && couriers.length >= 2 && (
                        <div className="px-5 pb-5">
                            <button
                                type="button"
                                disabled={!selectedCourierId || sendPost.isPending}
                                onClick={handleSend}
                                className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed enabled:cursor-pointer enabled:bg-main enabled:text-white enabled:hover:bg-primarydark enabled:hover:shadow-lg enabled:hover:shadow-main/30 enabled:hover:scale-[1.01]"
                            >
                                {sendPost.isPending ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Jo'natilmoqda...
                                    </>
                                ) : (
                                    <>
                                        <Send size={16} />
                                        Jo'natish
                                        {selectedCourierId && (
                                            <span className="px-2 py-0.5 rounded-md bg-white/20 text-xs font-bold">
                                                {orderIds.length}
                                            </span>
                                        )}
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </Popup>
        );
    },
);
SendPostModal.displayName = "SendPostModal";

export default SendPostModal;
