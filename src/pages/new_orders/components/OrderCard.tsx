import { memo } from "react";
import { Phone, MapPin, SquarePen, Trash2, Package, CheckSquare, Square } from "lucide-react";

export const fmt = (n: number) => n.toLocaleString("uz-UZ");

export const Checkbox = memo(({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button type="button" onClick={(e) => { e.stopPropagation(); onChange(); }} className="focus:outline-none">
        {checked
            ? <div className="bg-main rounded-md p-0.5 shadow-sm shadow-main/40"><CheckSquare size={18} className="text-white" /></div>
            : <Square size={22} className="text-gray-300 dark:text-gray-600 hover:text-main transition-colors" />}
    </button>
));

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ApiOrder {
    id: string;
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
const statusConfig: Record<string, { label: string; cls: string; dot: string }> = {
    new: { label: "Yangi", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
    processing: { label: "Jarayonda", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
    completed: { label: "Tayyor", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
};

const deliverLabel: Record<string, string> = { center: "📦 Markazga", home: "🏠 Uyga", address: "📍 Manzilga" };

// ─── StatusBadge ──────────────────────────────────────────────────────────────
const StatusBadge = memo(({ status }: { status: string }) => {
    const c = statusConfig[status] ?? statusConfig.new;
    return (
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5 ${c.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot} animate-pulse`} />
            {c.label}
        </span>
    );
});

// ─── OrderCard ────────────────────────────────────────────────────────────────
export const OrderCard = memo(({ order, isSelected, onToggle, onEdit, onDelete }: {
    order: ApiOrder; isSelected: boolean;
    onToggle: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void;
}) => {
    const location = order.customer?.district?.name
        ? `${order.customer?.region?.name ?? ""} • ${order.customer.district.name}`
        : order.address ?? "—";

    const date = new Date(order.createdAt).toLocaleString("uz-UZ", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

    return (
        <div onClick={onToggle}
            className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer ${isSelected
                ? "border-emerald-500 shadow-xl shadow-emerald-500/25 bg-white dark:bg-maindark"
                : "border-gray-100 dark:border-white/5 bg-white dark:bg-maindark hover:border-main/20 hover:shadow-md shadow-sm"}`}>

            {isSelected && <div className="absolute inset-0 bg-linear-to-br from-emerald-500/8 via-emerald-500/4 to-transparent pointer-events-none" />}
            <div className={`h-0.5 w-full transition-all ${isSelected ? "bg-linear-to-r from-emerald-500 to-emerald-300/40" : "bg-transparent"}`} />

            <div className="p-5 flex gap-4 relative">
                {/* Chap: checkbox + ID */}
                <div className="flex flex-col items-center gap-2 pt-0.5 min-w-fit">
                    <Checkbox checked={isSelected} onChange={onToggle} />
                    <div className="flex-1 w-px bg-gray-100 dark:bg-white/5" />
                    <span className="text-[9px] font-black text-gray-300 dark:text-gray-700 uppercase [writing-mode:vertical-lr] rotate-180 tracking-widest">#{order.id}</span>
                </div>

                {/* O'rta: info */}
                <div className="flex-1 space-y-3 min-w-0">
                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={order.status} />
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/10">
                            {deliverLabel[order.where_deliver] ?? order.where_deliver}
                        </span>
                        <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{date}</span>
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
                <div className="flex flex-col items-end justify-between gap-3 pl-4 border-l border-gray-100 dark:border-white/6 shrink-0">
                    <div className="text-right">
                        <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest mb-1">Jami</p>
                        <p className="text-lg font-black text-gray-900 dark:text-white tabular-nums leading-tight">{fmt(order.total_price)}</p>
                        <p className="text-[10px] text-main font-bold">UZS</p>
                        {order.paid_amount > 0 && (
                            <p className="text-[10px] text-emerald-500 font-semibold mt-1">✓ {fmt(order.paid_amount)} to'langan</p>
                        )}
                    </div>
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
                        <button onClick={(e) => { e.stopPropagation(); onEdit(order.id); }}
                            className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-main transition-all active:scale-90">
                            <SquarePen size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(order.id); }}
                            className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-red-500 transition-all active:scale-90">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});
