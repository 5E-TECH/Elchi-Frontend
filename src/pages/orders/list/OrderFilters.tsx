import { memo, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
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
import { resetFilters, setFilterValue } from "../../../features/Select/model/FilterSlice";
import { useQueryParams } from "../../../shared/lib/useQueryParams";
import FilterSearch from "../../../shared/ui/FilterSearch";
import FilterDateRange from "../../../shared/ui/FilterDateRange";
import { clearAllSearch, setSearchValue } from "../../../features/search/model/searchSlice";
import type { RootState } from "../../../app/config/store";
import SearchableSelect from "../../../shared/ui/SearchableSelect";

// ── Holat variantlari ─────────────────────────────────────────────────────
const ALL_STATUSES: { value: OrderStatus | ""; label: string }[] = [
    { value: "new", label: "statusNew" },
    { value: "created", label: "statusCreated" },
    { value: "received", label: "statusReceived" },
    { value: "on the road", label: "statusOnTheRoad" },
    { value: "waiting", label: "statusWaiting" },
    { value: "sold", label: "statusSold" },
    { value: "paid", label: "statusPaid" },
    { value: "partly_paid", label: "statusPartlyPaid" },
    { value: "cancelled", label: "statusCancelled" },
    { value: "closed", label: "statusClosed" },
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

const parseStatusValues = (value: unknown): OrderStatus[] => {
    if (Array.isArray(value)) {
        return value.filter((item): item is OrderStatus => typeof item === "string" && item.length > 0);
    }

    if (typeof value !== "string" || !value.trim()) {
        return [];
    }

    return value
        .split(",")
        .map((item) => item.trim())
        .filter((item): item is OrderStatus => item.length > 0);
};

const getStringFilterValue = (value: unknown, fallback = "") =>
    typeof value === "string" ? value : fallback;

// ── Komponent ─────────────────────────────────────────────────────────────
const OrderFilters = memo(({ onExport }: Props) => {
    const { t } = useTranslation(["orders", "common"]);
    const dispatch = useDispatch();
    const { setParam, removeParam, getParam } = useQueryParams();
    const role = useSelector((state: RootState) => state.role.role);
    const filters = useSelector((state: RootState) => state.filter);
    const searchFilters = useSelector((state: RootState) => state.search);
    const isMarketRole = role === "market";
    const canLoadRoleDependentOptions = role !== null && !isMarketRole;

    // ─── URL dan joriy qiymatlarni olish ───────────────────────────────────
    const urlMarketId = getParam(ORDER_FILTER_KEYS.marketId) ?? "";
    const urlRegionId = getParam(ORDER_FILTER_KEYS.regionId) ?? "";
    const urlCourierId = getParam(ORDER_FILTER_KEYS.courierId) ?? "";
    const urlStatus = getParam(ORDER_FILTER_KEYS.status) ?? "";
    const urlDateFrom = getParam(ORDER_FILTER_KEYS.dateFrom) ?? "";
    const urlDateTo = getParam(ORDER_FILTER_KEYS.dateTo) ?? "";
    const urlSearch = getParam(ORDER_FILTER_KEYS.search) ?? "";

    const marketId = getStringFilterValue(filters[ORDER_FILTER_KEYS.marketId], urlMarketId);
    const regionId = getStringFilterValue(filters[ORDER_FILTER_KEYS.regionId], urlRegionId);
    const courierId = getStringFilterValue(filters[ORDER_FILTER_KEYS.courierId], urlCourierId);
    const dateFrom = getStringFilterValue(filters[ORDER_FILTER_KEYS.dateFrom], urlDateFrom);
    const dateTo = getStringFilterValue(filters[ORDER_FILTER_KEYS.dateTo], urlDateTo);
    const search = getStringFilterValue(searchFilters[ORDER_FILTER_KEYS.search], urlSearch);
    const statusValues = useMemo(
        () => parseStatusValues(filters[ORDER_FILTER_KEYS.status] ?? urlStatus),
        [filters, urlStatus],
    );

    const hasFilter = !!(
        (!isMarketRole && marketId) ||
        regionId ||
        (!isMarketRole && courierId) ||
        statusValues.length > 0 ||
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
        canLoadRoleDependentOptions,
    );
    const markets = toItems(marketsData).map((m) => ({ value: String(m.id), label: m.name }));

    const { data: couriersData, isLoading: couriersLoading } = getCouriers(
        {
            status: "active",
            limit: 100,
        },
        canLoadRoleDependentOptions,
    );
    const couriers = toItems(couriersData).map((c) => ({ value: String(c.id), label: c.name }));

    const { data: regionsData, isLoading: regionsLoading } = getRegions();
    const regions = ((regionsData?.data ?? regionsData ?? []) as { id: string | number; name: string }[]).map(
        (r) => ({ value: String(r.id), label: r.name })
    );
    const statuses = ALL_STATUSES.map((statusOption) => ({
        ...statusOption,
        label: t(statusOption.label, { ns: "orders" }),
    }));

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

    const updateStatus = (value: string) => {
        const normalizedValue = value as OrderStatus | "";
        dispatch(setFilterValue({ key: ORDER_FILTER_KEYS.status, value: normalizedValue }));

        if (normalizedValue) {
            setParam(ORDER_FILTER_KEYS.status, normalizedValue);
        } else {
            removeParam(ORDER_FILTER_KEYS.status);
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
    };

    return (
        <div className="flex flex-col gap-4">

            {/* ── 1-qator: sarlavha | date range | search ── */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Sarlavha */}
                <div className="flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-wider text-maindark/60 dark:text-primary/60">
                    <Filter size={13} className="text-main" />
                    {t("filters", { ns: "common" })}
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
                    placeholder={t("filterSearchPlaceholder")}
                    className="w-full sm:w-56"
                />
            </div>

            {/* ── 2-qator: selectlar ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* MARKET */}
                {!isMarketRole && (
                    <SearchableSelect
                        label={t("filterMarket")}
                        name={ORDER_FILTER_KEYS.marketId}
                        value={marketId}
                        onChange={(value) =>
                            update(ORDER_FILTER_KEYS.marketId, ORDER_FILTER_KEYS.marketId, value)
                        }
                        options={markets}
                        placeholder={t("filterMarketPlaceholder")}
                        icon={Store}
                        loading={marketsLoading}
                    />
                )}

                {/* VILOYAT */}
                <SearchableSelect
                    label={t("filterRegion")}
                    name={ORDER_FILTER_KEYS.regionId}
                    value={regionId}
                    onChange={(value) =>
                        update(ORDER_FILTER_KEYS.regionId, ORDER_FILTER_KEYS.regionId, value)
                    }
                    options={regions}
                    placeholder={t("filterRegionPlaceholder")}
                    icon={MapPin}
                    loading={regionsLoading}
                />

                {/* KURYER */}
                {!isMarketRole && (
                    <SearchableSelect
                        label={t("filterCourier")}
                        name={ORDER_FILTER_KEYS.courierId}
                        value={courierId}
                        onChange={(value) =>
                            update(ORDER_FILTER_KEYS.courierId, ORDER_FILTER_KEYS.courierId, value)
                        }
                        options={couriers}
                        placeholder={t("filterCourierPlaceholder")}
                        icon={Truck}
                        loading={couriersLoading}
                    />
                )}

                {/* HOLAT */}
                <SearchableSelect
                    label={t("filterStatus")}
                    name={ORDER_FILTER_KEYS.status}
                    value={statusValues[0] ?? ""}
                    onChange={updateStatus}
                    options={statuses}
                    placeholder={t("filterStatusPlaceholder")}
                    icon={Tag}
                />
            </div>

            {/* ── 3-qator: tozalash | chiplar | export ── */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                {/* Tozalash tugmasi */}
                {hasFilter && (
                    <button
                        onClick={handleReset}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-400 transition-colors hover:text-red-500 sm:w-auto sm:justify-start sm:border-0 sm:bg-transparent sm:px-0 sm:py-0"
                    >
                        <RefreshCw size={13} />
                        Tozalash
                    </button>
                )}

                {/* Aktiv filter chip-lar */}
                {hasFilter && (
                    <div className="flex w-full flex-wrap gap-1.5 sm:flex-1">
                        {!isMarketRole && marketId && (
                            <FilterChip
                                label={`${t("chipMarket")}: ${markets.find((m) => m.value === marketId)?.label ?? `#${marketId}`}`}
                                onRemove={() =>
                                    update(ORDER_FILTER_KEYS.marketId, ORDER_FILTER_KEYS.marketId, "")
                                }
                            />
                        )}
                        {regionId && (
                            <FilterChip
                                label={`${t("chipRegion")}: ${regions.find((r) => r.value === regionId)?.label ?? `#${regionId}`}`}
                                onRemove={() =>
                                    update(ORDER_FILTER_KEYS.regionId, ORDER_FILTER_KEYS.regionId, "")
                                }
                            />
                        )}
                        {!isMarketRole && courierId && (
                            <FilterChip
                                label={`${t("chipCourier")}: ${couriers.find((c) => c.value === courierId)?.label ?? `#${courierId}`}`}
                                onRemove={() =>
                                    update(ORDER_FILTER_KEYS.courierId, ORDER_FILTER_KEYS.courierId, "")
                                }
                            />
                        )}
                        {statusValues.map((status) => (
                            <FilterChip
                                key={status}
                                label={`${t("chipStatus")}: ${statuses.find((item) => item.value === status)?.label ?? status}`}
                                onRemove={() =>
                                    updateStatus("")
                                }
                            />
                        ))}
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

                <div className="hidden flex-1 sm:block" />

                {/* Export Excel */}
                {onExport && (
                    <button
                        onClick={onExport}
                        className="
                            flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 sm:ml-auto sm:w-auto
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
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-main/20 bg-main/10 py-1 pl-2.5 pr-1.5 text-[11px] font-semibold text-main">
        <span className="wrap-break-word">{label}</span>
        <button
            onClick={onRemove}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-main/20"
        >
            <X size={10} />
        </button>
    </span>
);

OrderFilters.displayName = "OrderFilters";

export default OrderFilters;
