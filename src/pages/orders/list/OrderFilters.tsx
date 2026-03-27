import { memo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Filter,
    X,
    Store,
    MapPin,
    Truck,
    Tag,
    Download,
    RefreshCw,
} from "lucide-react";
import { useUser } from "../../../entities/user/api/userApi";
import { useMarkets } from "../../../entities/markets";
import type { OrderStatus } from "../../../entities/order/types/order";
import { setFilterValue, resetFilters } from "../../../features/Select/model/FilterSlice";
import { useQueryParams } from "../../../shared/lib/useQueryParams";
import Select from "../../../shared/ui/Select";
import FilterSearch from "../../../shared/ui/FilterSearch";
import FilterDateRange from "../../../shared/ui/FilterDateRange";
import { setSearchValue, clearAllSearch } from "../../../features/search/model/searchSlice";
import type { RootState } from "../../../app/config/store";

// ── Holat variantlari ─────────────────────────────────────────────────────
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

// ── Redux key-lari (UserListPage patterndek) ──────────────────────────────
export const ORDER_FILTER_KEYS = {
    marketId: "orderMarketId",
    regionId: "orderRegionId",
    courierId: "orderCourierId",
    status: "orderStatus",
    dateFrom: "orderDateFrom",
    dateTo: "orderDateTo",
    search: "orderSearch",
} as const;

// ── Props ─────────────────────────────────────────────────────────────────
interface Props {
    onExport?: () => void;
}

// ── Komponent ─────────────────────────────────────────────────────────────
const OrderFilters = memo(({ onExport }: Props) => {
    const dispatch = useDispatch();
    const { setParam, removeParam, clearAllParams, getParam } = useQueryParams();
    const role = useSelector((state: RootState) => state.role.role);
    const isMarketRole = role === "market";

    // ─── URL dan joriy qiymatlarni olish ───────────────────────────────────
    const marketId = getParam(ORDER_FILTER_KEYS.marketId) ?? "";
    const regionId = getParam(ORDER_FILTER_KEYS.regionId) ?? "";
    const courierId = getParam(ORDER_FILTER_KEYS.courierId) ?? "";
    const status = getParam(ORDER_FILTER_KEYS.status) ?? "";
    const dateFrom = getParam(ORDER_FILTER_KEYS.dateFrom) ?? "";
    const dateTo = getParam(ORDER_FILTER_KEYS.dateTo) ?? "";
    const search = getParam(ORDER_FILTER_KEYS.search) ?? "";

    const hasFilter = !!(
        (!isMarketRole && marketId) ||
        regionId ||
        (!isMarketRole && courierId) ||
        status ||
        dateFrom ||
        dateTo ||
        search
    );

    // ─── API lar ───────────────────────────────────────────────────────────
    const { getRegions, getCouriers } = useUser();
    const { getMarkets } = useMarkets();

    const toItems = (value: unknown): { id: string | number; name: string }[] => {
        if (Array.isArray(value)) return value as { id: string | number; name: string }[];
        if (
            typeof value === "object" &&
            value !== null &&
            "data" in value &&
            Array.isArray((value as { data?: { items?: { id: string | number; name: string }[] } }).data?.items)
        ) {
            return (value as { data: { items: { id: string | number; name: string }[] } }).data.items;
        }
        if (
            typeof value === "object" &&
            value !== null &&
            "items" in value &&
            Array.isArray((value as { items?: { id: string | number; name: string }[] }).items)
        ) {
            return (value as { items: { id: string | number; name: string }[] }).items;
        }
        return [];
    };

    const { data: marketsData, isLoading: marketsLoading } = getMarkets(
        { status: "active", limit: 100 },
        !isMarketRole,
    );
    const markets = toItems(marketsData).map((m) => ({ value: String(m.id), label: m.name }));

    const { data: couriersData, isLoading: couriersLoading } = getCouriers({
        status: "active",
        limit: 100,
    });
    const couriers = toItems(couriersData).map((c) => ({ value: String(c.id), label: c.name }));

    const { data: regionsData, isLoading: regionsLoading } = getRegions();
    const regions = ((regionsData?.data ?? regionsData ?? []) as { id: string | number; name: string }[]).map(
        (r) => ({ value: String(r.id), label: r.name })
    );

    // ─── Update: Redux + URL ───────────────────────────────────────────────
    const update = (reduxKey: string, urlKey: string, value: string) => {
        // 1. Redux ga saqlash
        dispatch(setFilterValue({ key: reduxKey, value }));
        // 2. URL params ga saqlash
        if (value) {
            setParam(urlKey, value);
        } else {
            removeParam(urlKey);
        }
    };

    // Search uchun alohida (searchSlice)
    const updateSearch = (value: string) => {
        dispatch(setSearchValue({ key: ORDER_FILTER_KEYS.search, value }));
        if (value) {
            setParam(ORDER_FILTER_KEYS.search, value);
        } else {
            removeParam(ORDER_FILTER_KEYS.search);
        }
    };

    // ─── Barcha filterlarni tozalash ──────────────────────────────────────
    const handleReset = () => {
        dispatch(resetFilters());
        dispatch(clearAllSearch());
        // Faqat order filter key-larini tozalash
        Object.values(ORDER_FILTER_KEYS).forEach((key) => removeParam(key));
        // URLni butunlay tozalash uchun
        clearAllParams();
    };

    return (
        <div className="flex flex-col gap-4">

            {/* ── 1-qator: sarlavha | date range | search ── */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Sarlavha */}
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 dark:text-white/50 uppercase tracking-wider shrink-0">
                    <Filter size={13} className="text-main" />
                    Saralash
                </div>

                <div className="flex-1" />

                {/* Date range picker */}
                <FilterDateRange
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onChangeDateFrom={(v) =>
                        update(ORDER_FILTER_KEYS.dateFrom, ORDER_FILTER_KEYS.dateFrom, v)
                    }
                    onChangeDateTo={(v) =>
                        update(ORDER_FILTER_KEYS.dateTo, ORDER_FILTER_KEYS.dateTo, v)
                    }
                />

                {/* Search */}
                <FilterSearch
                    value={search}
                    onChange={updateSearch}
                    placeholder="Buyurtmani qidiring..."
                    className="w-56"
                />
            </div>

            {/* ── 2-qator: selectlar ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* MARKET */}
                {!isMarketRole && (
                    <Select
                        label="Market"
                        name={ORDER_FILTER_KEYS.marketId}
                        value={marketId}
                        onChange={(e) =>
                            update(ORDER_FILTER_KEYS.marketId, ORDER_FILTER_KEYS.marketId, e.target.value)
                        }
                        options={markets}
                        placeholder="Marketni tanlang"
                        icon={Store}
                        loading={marketsLoading}
                    />
                )}

                {/* VILOYAT */}
                <Select
                    label="Viloyat"
                    name={ORDER_FILTER_KEYS.regionId}
                    value={regionId}
                    onChange={(e) =>
                        update(ORDER_FILTER_KEYS.regionId, ORDER_FILTER_KEYS.regionId, e.target.value)
                    }
                    options={regions}
                    placeholder="Hududni tanlang"
                    icon={MapPin}
                    loading={regionsLoading}
                />

                {/* KURYER */}
                {!isMarketRole && (
                    <Select
                        label="Kuryer"
                        name={ORDER_FILTER_KEYS.courierId}
                        value={courierId}
                        onChange={(e) =>
                            update(ORDER_FILTER_KEYS.courierId, ORDER_FILTER_KEYS.courierId, e.target.value)
                        }
                        options={couriers}
                        placeholder="Kuryerni tanlang"
                        icon={Truck}
                        loading={couriersLoading}
                    />
                )}

                {/* HOLAT */}
                <Select
                    label="Holat"
                    name={ORDER_FILTER_KEYS.status}
                    value={status}
                    onChange={(e) =>
                        update(ORDER_FILTER_KEYS.status, ORDER_FILTER_KEYS.status, e.target.value)
                    }
                    options={ALL_STATUSES}
                    placeholder="Holatni tanlang"
                    icon={Tag}
                />
            </div>

            {/* ── 3-qator: tozalash | chiplar | export ── */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Tozalash tugmasi */}
                {hasFilter && (
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-500 transition-colors"
                    >
                        <RefreshCw size={13} />
                        Tozalash
                    </button>
                )}

                {/* Aktiv filter chip-lar */}
                {hasFilter && (
                    <div className="flex flex-wrap gap-1.5 flex-1">
                        {!isMarketRole && marketId && (
                            <FilterChip
                                label={`Market: ${markets.find((m) => m.value === marketId)?.label ?? `#${marketId}`}`}
                                onRemove={() =>
                                    update(ORDER_FILTER_KEYS.marketId, ORDER_FILTER_KEYS.marketId, "")
                                }
                            />
                        )}
                        {regionId && (
                            <FilterChip
                                label={`Viloyat: ${regions.find((r) => r.value === regionId)?.label ?? `#${regionId}`}`}
                                onRemove={() =>
                                    update(ORDER_FILTER_KEYS.regionId, ORDER_FILTER_KEYS.regionId, "")
                                }
                            />
                        )}
                        {!isMarketRole && courierId && (
                            <FilterChip
                                label={`Kuryer: ${couriers.find((c) => c.value === courierId)?.label ?? `#${courierId}`}`}
                                onRemove={() =>
                                    update(ORDER_FILTER_KEYS.courierId, ORDER_FILTER_KEYS.courierId, "")
                                }
                            />
                        )}
                        {status && (
                            <FilterChip
                                label={`Holat: ${ALL_STATUSES.find((s) => s.value === status)?.label}`}
                                onRemove={() =>
                                    update(ORDER_FILTER_KEYS.status, ORDER_FILTER_KEYS.status, "")
                                }
                            />
                        )}
                        {dateFrom && (
                            <FilterChip
                                label={`Dan: ${dateFrom}`}
                                onRemove={() =>
                                    update(ORDER_FILTER_KEYS.dateFrom, ORDER_FILTER_KEYS.dateFrom, "")
                                }
                            />
                        )}
                        {dateTo && (
                            <FilterChip
                                label={`Gacha: ${dateTo}`}
                                onRemove={() =>
                                    update(ORDER_FILTER_KEYS.dateTo, ORDER_FILTER_KEYS.dateTo, "")
                                }
                            />
                        )}
                        {search && (
                            <FilterChip
                                label={`Qidiruv: "${search}"`}
                                onRemove={() => updateSearch("")}
                            />
                        )}
                    </div>
                )}

                <div className="flex-1" />

                {/* Export Excel */}
                {onExport && (
                    <button
                        onClick={onExport}
                        className="
                            flex items-center gap-2 px-4 py-2 rounded-xl
                            bg-emerald-500 hover:bg-emerald-600
                            text-white text-xs font-semibold
                            transition-all duration-200
                            shadow-sm hover:shadow-md hover:shadow-emerald-500/25
                        "
                    >
                        <Download size={14} />
                        Export Excel
                    </button>
                )}
            </div>
        </div>
    );
});

// ── Filter chip ───────────────────────────────────────────────────────────
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

OrderFilters.displayName = "OrderFilters";

export default OrderFilters;
