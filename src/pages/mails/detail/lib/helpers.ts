import type { OrderStatus } from "../../../../entities/mails";

// ─── Narx formati ─────────────────────────────────────────────────────────────
export const formatPrice = (price: number): string =>
    price.toLocaleString("uz-UZ") + " so'm";

// ─── Sana formati ─────────────────────────────────────────────────────────────
export const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

// ─── Status rang ──────────────────────────────────────────────────────────────
const STATUS_STYLE_MAP: Record<string, string> = {
    new: "text-blue-400 bg-blue-500/15 border-blue-500/25",
    received: "text-emerald-400 bg-emerald-500/15 border-emerald-500/25",
    delivered: "text-purple-400 bg-purple-500/15 border-purple-500/25",
    cancelled: "text-red-400 bg-red-500/15 border-red-500/25",
};

export const getStatusStyle = (status: OrderStatus): string =>
    STATUS_STYLE_MAP[status] ?? STATUS_STYLE_MAP.new;

// ─── Status nomi ──────────────────────────────────────────────────────────────
const STATUS_LABEL_MAP: Record<string, string> = {
    new: "Yangi",
    received: "Qabul qilindi",
    delivered: "Yetkazildi",
    cancelled: "Bekor qilindi",
};

export const getStatusLabel = (status: OrderStatus): string =>
    STATUS_LABEL_MAP[status] ?? status;
