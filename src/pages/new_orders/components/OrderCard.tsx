import { memo } from "react";
import { Phone, MapPin, SquarePen, Trash2, Package, CheckSquare, Square } from "lucide-react";
import { useTranslation } from "react-i18next";

// eslint-disable-next-line react-refresh/only-export-components
export const fmt = (n: number) => n.toLocaleString("uz-UZ");

export const Checkbox = memo(({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onChange(); }}
        aria-pressed={checked}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition-all hover:border-main/40 hover:bg-main/10 focus:outline-none focus:ring-2 focus:ring-main/35"
    >
        {checked
            ? <div className="rounded-lg bg-main p-0.5 shadow-sm shadow-main/40"><CheckSquare size={18} className="text-white" /></div>
            : <Square size={20} className="text-gray-300 transition-colors dark:text-white/35" />}
    </button>
));

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ApiOrder {
    id: string;
    qr_code_token?: string | null;
    status: string;
    where_deliver: "center" | "home" | "address";
    total_price: number;
    paid_amount: number;
    to_be_paid: number;
    createdAt: string;
    comment: string | null;
    address: string | null;
    items: { id: string; quantity: number; product: { id: string; name: string; image_url: string | null } }[];
    customer: { id: string; name: string; phone_number: string; district?: { name: string }; region?: { name: string } };
    district?: { name: string };
    region?: { name: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const statusConfig: Record<string, { labelKey: string; cls: string; dot: string }> = {
    new: { labelKey: "statusNew", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
    processing: { labelKey: "statusProcessing", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
    completed: { labelKey: "statusCompleted", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
    cancelled: { labelKey: "statusCancelled", cls: "bg-red-500/10 text-red-600 dark:text-red-400", dot: "bg-red-500" },
    "cancelled (sent)": { labelKey: "statusCancelled", cls: "bg-red-500/10 text-red-600 dark:text-red-400", dot: "bg-red-500" },
};

const deliverLabel: Record<string, string> = { center: "deliverCenter", home: "deliverHome", address: "deliverAddress" };

// ─── StatusBadge ──────────────────────────────────────────────────────────────
const StatusBadge = memo(({ status }: { status: string }) => {
    const { t } = useTranslation("newOrders");
    const c = statusConfig[status] ?? statusConfig.new;
    return (
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5 ${c.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot} animate-pulse`} />
            {t(c.labelKey)}
        </span>
    );
});

// ─── OrderCard ────────────────────────────────────────────────────────────────
export const OrderCard = memo(({ order, isSelected, onToggle, onEdit, onDelete, showCheckbox = true, showOrderId = true }: {
    order: ApiOrder; isSelected: boolean;
    onToggle?: () => void; onEdit?: (id: string) => void; onDelete?: (id: string) => void;
    showCheckbox?: boolean;
    showOrderId?: boolean;
}) => {
    const { t, i18n } = useTranslation(["newOrders", "orders"]);
    const locale = i18n.language === "ru" ? "ru-RU" : i18n.language === "en" ? "en-US" : "uz-UZ";
    const location = order.customer?.district?.name
        ? `${order.customer?.region?.name ?? ""} • ${order.customer.district.name}`
        : order.address ?? "—";

    const date = new Date(order.createdAt).toLocaleString(locale, {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const formatMoney = (value: number) => value.toLocaleString(locale);

    return (
        <div
            onClick={showCheckbox && onToggle ? onToggle : undefined}
            className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${showCheckbox ? "cursor-pointer" : "cursor-default"} ${isSelected
                ? "border-emerald-500 bg-emerald-50/65 shadow-xl shadow-emerald-500/20 ring-1 ring-emerald-400/70 dark:bg-emerald-500/8"
                : "border-gray-100 bg-white shadow-sm hover:border-main/25 hover:shadow-md dark:border-white/5 dark:bg-maindark"}`}>

            {isSelected && <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/12 via-emerald-500/5 to-transparent" />}
            <div className={`h-0.5 w-full transition-all ${isSelected ? "bg-linear-to-r from-emerald-500 to-emerald-300/40" : "bg-transparent"}`} />
            {isSelected && <div className="absolute bottom-0 left-0 top-0 w-1 bg-emerald-500" />}

            <div className="relative flex flex-col gap-3 p-3 sm:flex-row sm:gap-4 sm:p-5">
                {/* Chap: checkbox + ID */}
                <div className="flex min-w-fit items-center gap-2 sm:flex-col sm:items-center sm:pt-0.5">
                    {showCheckbox && onToggle && (
                        <Checkbox checked={isSelected} onChange={onToggle} />
                    )}
                    {showOrderId ? (
                        <>
                            <div className="hidden w-px flex-1 bg-gray-100 dark:bg-white/5 sm:block" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-gray-300 dark:text-gray-700 sm:[writing-mode:vertical-lr] sm:rotate-180">#{order.id}</span>
                        </>
                    ) : null}
                </div>

                {/* O'rta: info */}
                <div className="flex-1 space-y-3 min-w-0">
                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={order.status} />
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/10">
                            {t(deliverLabel[order.where_deliver] ?? "deliverAddress")}
                        </span>
                        <span className="w-full text-[10px] text-gray-400 tabular-nums sm:ml-auto sm:w-auto">{date}</span>
                    </div>

                    {/* Mijoz */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-linear-to-br from-main/20 to-main/5 border border-main/10 flex items-center justify-center shrink-0 font-bold text-main text-base">
                            {(order.customer?.name ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-main transition-colors truncate">
                                {order.customer?.name ?? "—"}
                            </h3>
                            <div className="flex items-center gap-4 flex-wrap mt-0.5">
                                <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 font-medium">
                                    <Phone size={12} /> {order.customer?.phone_number ?? "—"}
                                </span>
                                <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 min-w-0">
                                    <MapPin size={12} className="shrink-0" />
                                    <span className="truncate">{location}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Mahsulotlar */}
                    <div className="flex flex-wrap gap-1.5">
                        {order.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-white/4 border border-gray-100 dark:border-white/8">
                                <Package size={10} className="text-gray-400 shrink-0" />
                                <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{item.product.name}</span>
                                <span className="text-[10px] bg-main/10 text-main px-1 py-0.5 rounded font-black">×{item.quantity}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* O'ng: narx + actions */}
                <div className="flex w-full shrink-0 items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-white/6 sm:w-auto sm:flex-col sm:items-end sm:justify-between sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                    <div className="text-left sm:text-right">
                        <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest mb-1">{t("total")}</p>
                        <p className="text-lg font-black text-gray-900 dark:text-white tabular-nums leading-tight">{formatMoney(order.total_price)}</p>
                        <p className="text-[10px] text-main font-bold">{t("currency", { ns: "orders" })}</p>
                        {order.paid_amount > 0 && (
                            <p className="text-[10px] text-emerald-500 font-semibold mt-1">✓ {formatMoney(order.paid_amount)} {t("paid").toLowerCase()}</p>
                        )}
                    </div>
                    {(onEdit || onDelete) && (
                        <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/5">
                            {onEdit && (
                                <button onClick={(e) => { e.stopPropagation(); onEdit(order.id); }}
                                    className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-main transition-all active:scale-90">
                                    <SquarePen size={16} />
                                </button>
                            )}
                            {onDelete && (
                                <button onClick={(e) => { e.stopPropagation(); onDelete(order.id); }}
                                    className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-red-500 transition-all active:scale-90">
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
