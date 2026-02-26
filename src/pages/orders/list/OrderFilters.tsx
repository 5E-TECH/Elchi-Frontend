import { memo, useCallback } from "react";
import { Filter, X, Search, Store, Tag, Calendar } from "lucide-react";
import { useUser } from "../../../entities/user/api/userApi";
import type { OrderListParams, OrderStatus } from "../../../entities/order/types/order";

interface Props {
    params: OrderListParams;
    onChange: (p: OrderListParams) => void;
}

const ALL_STATUSES: { value: OrderStatus | ""; label: string }[] = [
    { value: "", label: "Barcha holat" },
    { value: "new", label: "Yangi" },
    { value: "created", label: "Qabul qilingan" },
    { value: "received", label: "Qabul qilindi" },
    { value: "on the road", label: "Yo'lda" },
    { value: "waiting", label: "Kutilmoqda" },
    { value: "sold", label: "Sotilgan" },
    { value: "paid", label: "To'langan" },
    { value: "partly_paid", label: "Qisman to'landi" },
    { value: "cancelled", label: "Bekor qilingan" },
    { value: "closed", label: "Yopildi" },
];

const selectCls = `
    w-full px-3.5 py-2.5 rounded-xl text-sm appearance-none cursor-pointer
    bg-white dark:bg-primarydark
    border border-gray-200 dark:border-white/10
    text-maindark dark:text-primary placeholder:text-gray-400
    focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main
    transition-all duration-200 pr-9
`;

const inputCls = `
    w-full px-3.5 py-2.5 rounded-xl text-sm
    bg-white dark:bg-primarydark
    border border-gray-200 dark:border-white/10
    text-maindark dark:text-primary placeholder:text-gray-400
    focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main
    transition-all duration-200
`;

const ChevronDown = () => (
    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
);

const OrderFilters = ({ params, onChange }: Props) => {
    const { getUser } = useUser();
    const { data: marketsData } = getUser({ role: "market", limit: 100 });

    // market list
    const markets: { id: string; name: string }[] =
        marketsData?.data?.items?.map((m: any) => ({ id: String(m.id), name: m.name })) ?? [];

    const hasFilter = !!(
        params.status ||
        params.market_id ||
        params.customer_id
    );

    const update = useCallback(
        (key: keyof OrderListParams, value: string | number | undefined) =>
            onChange({ ...params, [key]: value || undefined, page: 1 }),
        [params, onChange]
    );

    const clearAll = () => onChange({ page: 1, limit: params.limit });

    return (
        <div className="flex flex-col gap-3">

            {/* ── Header row ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <Filter size={13} className="text-main" />
                    Saralash
                </div>
                {hasFilter && (
                    <button
                        onClick={clearAll}
                        className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-500 transition-colors"
                    >
                        <X size={13} />
                        Tozalash
                    </button>
                )}
            </div>

            {/* ── Filter grid ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

                {/* MARKET — select */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                        <Store size={11} className="text-main/70" />
                        Market
                    </label>
                    <div className="relative">
                        <select
                            value={params.market_id ?? ""}
                            onChange={(e) => update("market_id", e.target.value)}
                            className={selectCls}
                        >
                            <option value="">Marketni tanlang</option>
                            {markets.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.name}
                                </option>
                            ))}
                        </select>
                        <ChevronDown />
                    </div>
                </div>

                {/* CUSTOMER ID */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                        <Search size={11} className="text-main/70" />
                        Mijoz ID
                    </label>
                    <input
                        type="text"
                        placeholder="Mijoz ID kiriting..."
                        value={params.customer_id ?? ""}
                        onChange={(e) => update("customer_id", e.target.value)}
                        className={inputCls}
                    />
                </div>

                {/* HOLAT — select */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                        <Tag size={11} className="text-main/70" />
                        Holat
                    </label>
                    <div className="relative">
                        <select
                            value={params.status ?? ""}
                            onChange={(e) => update("status", e.target.value as OrderStatus)}
                            className={selectCls}
                        >
                            {ALL_STATUSES.map((s) => (
                                <option key={s.value} value={s.value}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                        <ChevronDown />
                    </div>
                </div>

                {/* LIMIT */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                        <Calendar size={11} className="text-main/70" />
                        Sahifadagi miqdor
                    </label>
                    <div className="relative">
                        <select
                            value={params.limit ?? 15}
                            onChange={(e) =>
                                onChange({ ...params, limit: Number(e.target.value), page: 1 })
                            }
                            className={selectCls}
                        >
                            {[10, 15, 25, 50].map((n) => (
                                <option key={n} value={n}>
                                    {n} ta
                                </option>
                            ))}
                        </select>
                        <ChevronDown />
                    </div>
                </div>
            </div>

            {/* ── Active filter chips ── */}
            {hasFilter && (
                <div className="flex flex-wrap gap-2 pt-0.5">
                    {params.market_id && (
                        <FilterChip
                            label={`Market: ${markets.find((m) => m.id === params.market_id)?.name ?? `#${params.market_id}`}`}
                            onRemove={() => update("market_id", undefined)}
                        />
                    )}
                    {params.customer_id && (
                        <FilterChip
                            label={`Mijoz: #${params.customer_id}`}
                            onRemove={() => update("customer_id", undefined)}
                        />
                    )}
                    {params.status && (
                        <FilterChip
                            label={`Holat: ${ALL_STATUSES.find((s) => s.value === params.status)?.label}`}
                            onRemove={() => update("status", undefined)}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

const FilterChip = ({ label, onRemove }: { label?: string; onRemove: () => void }) => (
    <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-[11px] font-semibold bg-main/10 text-main border border-main/20">
        {label}
        <button
            onClick={onRemove}
            className="w-4 h-4 rounded-full hover:bg-main/20 flex items-center justify-center transition-colors"
        >
            <X size={10} />
        </button>
    </span>
);

export default memo(OrderFilters);
