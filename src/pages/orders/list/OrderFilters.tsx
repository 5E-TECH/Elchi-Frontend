import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import {
    Filter,
    X,
    Store,
    Building2,
    MapPin,
    Truck,
    Tag,
    Download,
    ChevronDown,
} from "lucide-react";
import { useUser } from "../../../entities/user/api/userApi";
import { useMarkets } from "../../../entities/markets";
import { useBranches } from "../../../entities/branch";
import { useLogistics } from "../../../entities/logistics/api/logisticsApi";
import type { OrderStatus } from "../../../entities/order/types/order";
import { resetFilters, setFilterValue } from "../../../features/Select/model/FilterSlice";
import { useQueryParams } from "../../../shared/lib/useQueryParams";
import FilterSearch from "../../../shared/ui/FilterSearch";
import FilterDateRange from "../../../shared/ui/FilterDateRange";
import FilterMultiSelect from "../../../shared/ui/FilterMultiSelect";
import FilterClearButton from "../../../shared/ui/FilterClearButton";
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
    branchId: "orderBranchId",
    regionId: "orderRegionId",
    districtId: "orderDistrictId",
    courierId: "orderCourierId",
    status: "orderStatus",
    dateFrom: "startDay",
    dateTo: "endDay",
    search: "orderSearch",
} as const;

// ── Props ─────────────────────────────────────────────────────────────────
interface Props {
    onExport?: () => void;
    isExporting?: boolean;
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
const OrderFilters = memo(({ onExport, isExporting = false }: Props) => {
    const { t } = useTranslation(["orders", "common"]);
    const dispatch = useDispatch();
    const { setParam, removeParam, getParam, setMultipleParams } = useQueryParams();
    const role = useSelector((state: RootState) => state.role.role);
    const currentUser = useSelector((state: RootState) => state.user.user as Record<string, unknown> | null);
    const filters = useSelector((state: RootState) => state.filter);
    const searchFilters = useSelector((state: RootState) => state.search);
    const isMarketRole = role === "market";
    const isManagerRole = role === "manager";
    const shouldShowBranchFilter = !isMarketRole && !isManagerRole;
    const canUseBranchFilter = role === "admin" || role === "superadmin";
    const canLoadRoleDependentOptions = role !== null && !isMarketRole;
    const selectGridClassName = canUseBranchFilter
        ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
        : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4";
    const [isMobile, setIsMobile] = useState(
        typeof window !== "undefined" ? window.innerWidth < 640 : false,
    );
    const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
    const [searchResetKey, setSearchResetKey] = useState(0);
    const mobilePanelRef = useRef<HTMLDivElement | null>(null);

    // ─── URL dan joriy qiymatlarni olish ───────────────────────────────────
    const urlMarketId = getParam(ORDER_FILTER_KEYS.marketId) ?? "";
    const urlBranchId = getParam(ORDER_FILTER_KEYS.branchId) ?? "";
    const urlRegionId = getParam(ORDER_FILTER_KEYS.regionId) ?? "";
    const urlDistrictId = getParam(ORDER_FILTER_KEYS.districtId) ?? "";
    const urlCourierId = getParam(ORDER_FILTER_KEYS.courierId) ?? "";
    const urlStatus = getParam(ORDER_FILTER_KEYS.status) ?? "";
    const urlDateFrom = getParam(ORDER_FILTER_KEYS.dateFrom) ?? getParam("orderDateFrom") ?? "";
    const urlDateTo = getParam(ORDER_FILTER_KEYS.dateTo) ?? getParam("orderDateTo") ?? "";
    const urlSearch = getParam(ORDER_FILTER_KEYS.search) ?? "";

    const marketId = getStringFilterValue(filters[ORDER_FILTER_KEYS.marketId], urlMarketId);
    const branchId = getStringFilterValue(filters[ORDER_FILTER_KEYS.branchId], urlBranchId);
    const regionId = getStringFilterValue(filters[ORDER_FILTER_KEYS.regionId], urlRegionId);
    const districtId = getStringFilterValue(filters[ORDER_FILTER_KEYS.districtId], urlDistrictId);
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
        (shouldShowBranchFilter && branchId) ||
        (isManagerRole ? districtId : regionId) ||
        (canUseBranchFilter && branchId) ||
        regionId ||
        (!isMarketRole && courierId) ||
        statusValues.length > 0 ||
        dateFrom ||
        dateTo ||
        search
    );
    const activeFilterCount =
        Number(Boolean(!isMarketRole && marketId))
        + Number(Boolean(shouldShowBranchFilter && branchId))
        + Number(Boolean(isManagerRole ? districtId : regionId))
        + Number(Boolean(canUseBranchFilter && branchId))
        + Number(Boolean(regionId))
        + Number(Boolean(!isMarketRole && courierId))
        + Number(statusValues.length > 0)
        + Number(Boolean(dateFrom || dateTo))
        + Number(Boolean(search));

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 640;
            setIsMobile(mobile);
            if (!mobile) setIsMobilePanelOpen(false);
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        if (!isMobile || !isMobilePanelOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (!mobilePanelRef.current) return;
            if (!mobilePanelRef.current.contains(event.target as Node)) {
                setIsMobilePanelOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isMobile, isMobilePanelOpen]);

    // ─── API lar ───────────────────────────────────────────────────────────
    const { useGetRegions, useGetCouriers, useGetMyProfile } = useUser();
    const { useGetDistricts } = useLogistics();
    const { useGetMarkets } = useMarkets();

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

    const { data: marketsData, isLoading: marketsLoading } = useGetMarkets(
        { status: "active", limit: 100 },
        canLoadRoleDependentOptions,
    );
    const markets = toItems(marketsData).map((m) => ({ value: String(m.id), label: m.name }));
    const { data: branchesData, isLoading: branchesLoading } = useBranches(
        {
            status: "active",
            limit: 100,
            page: 1,
        },
        canUseBranchFilter,
    );
    const branches = canUseBranchFilter
        ? (branchesData?.data ?? []).map((b) => ({ value: String(b.id), label: b.name }))
        : [];

    const { data: myProfileData } = useGetMyProfile();

    const managerRegionId = useMemo(() => {
        if (!isManagerRole) return "";

        const profileUser =
            ((myProfileData as { data?: Record<string, unknown> } | undefined)?.data as Record<string, unknown> | undefined)
            ?? null;
        const sourceUser = profileUser ?? currentUser;
        if (!sourceUser) return "";

        const branchObject =
            sourceUser.branch && typeof sourceUser.branch === "object"
                ? (sourceUser.branch as Record<string, unknown>)
                : null;
        const nestedBranchObject =
            branchObject?.branch && typeof branchObject.branch === "object"
                ? (branchObject.branch as Record<string, unknown>)
                : null;
        const branchRegionObject =
            branchObject?.region && typeof branchObject.region === "object"
                ? (branchObject.region as Record<string, unknown>)
                : null;
        const nestedBranchRegionObject =
            nestedBranchObject?.region && typeof nestedBranchObject.region === "object"
                ? (nestedBranchObject.region as Record<string, unknown>)
                : null;

        const rawValue =
            nestedBranchObject?.region_id ??
            nestedBranchObject?.regionId ??
            nestedBranchRegionObject?.id ??
            branchObject?.region_id ??
            branchObject?.regionId ??
            branchRegionObject?.id;

        if (typeof rawValue === "string" && rawValue.trim()) return rawValue;
        if (typeof rawValue === "number") return String(rawValue);
        return "";
    }, [currentUser, isManagerRole, myProfileData]);

    const courierRegionId = isManagerRole ? managerRegionId : regionId;
    const canLoadCouriers = canLoadRoleDependentOptions && (!isManagerRole || Boolean(managerRegionId));
    const { data: couriersData, isLoading: couriersLoading } = useGetCouriers(
        {
            status: "active",
            limit: 100,
            ...(courierRegionId ? { region_id: courierRegionId } : {}),
        },
        canLoadCouriers,
    );
    const couriers = toItems(couriersData).map((c) => ({ value: String(c.id), label: c.name }));

    const { data: regionsData, isLoading: regionsLoading } = useGetRegions(!isManagerRole);
    const regions = ((regionsData?.data ?? regionsData ?? []) as { id: string | number; name: string }[]).map(
        (r) => ({ value: String(r.id), label: r.name })
    );
    const { data: districtsData, isLoading: districtsLoading } = useGetDistricts(managerRegionId || undefined);
    const managerDistricts = ((districtsData ?? []) as { id: string | number; name: string }[]).map((d) => ({
        value: String(d.id),
        label: d.name,
    }));
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

        if (isMobile) {
            setIsMobilePanelOpen(false);
        }
    };

    const updateRegionAndResetCourier = (value: string) => {
        dispatch(setFilterValue({ key: ORDER_FILTER_KEYS.regionId, value }));
        dispatch(setFilterValue({ key: ORDER_FILTER_KEYS.courierId, value: "" }));

        setMultipleParams({
            [ORDER_FILTER_KEYS.regionId]: value,
            [ORDER_FILTER_KEYS.courierId]: "",
        });

        if (isMobile) {
            setIsMobilePanelOpen(false);
        }
    };

    const updateDistrictAndResetCourier = (value: string) => {
        dispatch(setFilterValue({ key: ORDER_FILTER_KEYS.districtId, value }));
        dispatch(setFilterValue({ key: ORDER_FILTER_KEYS.courierId, value: "" }));

        setMultipleParams({
            [ORDER_FILTER_KEYS.districtId]: value,
            [ORDER_FILTER_KEYS.courierId]: "",
        });

        if (isMobile) {
            setIsMobilePanelOpen(false);
        }
    };

    const updateStatus = (value: string[]) => {
        const normalizedValue = value.filter((item): item is OrderStatus =>
            ALL_STATUSES.some((statusOption) => statusOption.value === item),
        );
        dispatch(setFilterValue({ key: ORDER_FILTER_KEYS.status, value: normalizedValue }));

        if (normalizedValue.length > 0) {
            setParam(ORDER_FILTER_KEYS.status, normalizedValue.join(","));
        } else {
            removeParam(ORDER_FILTER_KEYS.status);
        }

        if (isMobile) {
            setIsMobilePanelOpen(false);
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
        setMultipleParams({
            [ORDER_FILTER_KEYS.marketId]: "",
            [ORDER_FILTER_KEYS.branchId]: "",
            [ORDER_FILTER_KEYS.regionId]: "",
            [ORDER_FILTER_KEYS.districtId]: "",
            [ORDER_FILTER_KEYS.courierId]: "",
            [ORDER_FILTER_KEYS.status]: "",
            [ORDER_FILTER_KEYS.dateFrom]: "",
            [ORDER_FILTER_KEYS.dateTo]: "",
            [ORDER_FILTER_KEYS.search]: "",
            orderDateFrom: "",
            orderDateTo: "",
        });
        setSearchResetKey((prev) => prev + 1);

        if (isMobile) {
            setIsMobilePanelOpen(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {isMobile && (
                <div ref={mobilePanelRef} className="sm:hidden">
                    <button
                        type="button"
                        onClick={() => setIsMobilePanelOpen((prev) => !prev)}
                        className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-left shadow-sm transition-colors hover:border-main/40 dark:border-primarydark/70 dark:bg-primarydark/60"
                    >
                        <div className="flex items-center gap-2.5">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-main/10 text-main">
                                <Filter size={15} />
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-maindark dark:text-primary">
                                    {t("filters", { ns: "common" })}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {hasFilter
                                        ? t("activeCount", { ns: "common", count: activeFilterCount, defaultValue: `${activeFilterCount} ta faol filter` })
                                        : t("tapToOpen", { ns: "common", defaultValue: "Ochish uchun bosing" })}
                                </p>
                            </div>
                        </div>
                        <ChevronDown
                            size={17}
                            className={`shrink-0 text-gray-500 transition-transform dark:text-gray-400 ${isMobilePanelOpen ? "rotate-180" : ""}`}
                        />
                    </button>

                    <div
                        className={`grid transition-all duration-300 ease-out ${isMobilePanelOpen ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                    >
                        <div className="overflow-hidden">
                            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-primarydark/70 dark:bg-primarydark/60">
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
                                            key={`mobile-search-${searchResetKey}`}
                                            value={search}
                                            onChange={updateSearch}
                                            placeholder={t("filterSearchPlaceholder")}
                                            className="w-full sm:w-56"
                                        />
                                    </div>

                                    {/* ── 2-qator: selectlar ── */}
                                    <div className={selectGridClassName}>
                                        {/* MARKET */}
                                        {canUseBranchFilter && (
                                            <SearchableSelect
                                                label={t("filterMarket")}
                                                name={ORDER_FILTER_KEYS.marketId}
                                                value={marketId}
                                                onChange={(value) =>
                                                    update(ORDER_FILTER_KEYS.marketId, ORDER_FILTER_KEYS.marketId, value)
                                                }
                                                options={markets}
                                                placeholder={t("filterMarketPlaceholder")}
                                                icon={Building2}
                                                loading={marketsLoading}
                                            />
                                        )}
                                        {/* FILIAL */}
                                        {shouldShowBranchFilter && (
                                            <SearchableSelect
                                                label={t("filterBranch")}
                                                name={ORDER_FILTER_KEYS.branchId}
                                                value={branchId}
                                                onChange={(value) =>
                                                    update(ORDER_FILTER_KEYS.branchId, ORDER_FILTER_KEYS.branchId, value)
                                                }
                                                options={branches}
                                                placeholder={t("filterBranchPlaceholder")}
                                                icon={Store}
                                                loading={branchesLoading}
                                            />
                                        )}

                                        {/* VILOYAT */}
                                        {isManagerRole ? (
                                            <SearchableSelect
                                                label={t("district")}
                                                name={ORDER_FILTER_KEYS.districtId}
                                                value={districtId}
                                                onChange={updateDistrictAndResetCourier}
                                                options={managerDistricts}
                                                placeholder={t("selectDistrict")}
                                                icon={MapPin}
                                                loading={districtsLoading}
                                            />
                                        ) : (
                                            <SearchableSelect
                                                label={t("filterRegion")}
                                                name={ORDER_FILTER_KEYS.regionId}
                                                value={regionId}
                                                onChange={updateRegionAndResetCourier}
                                                options={regions}
                                                placeholder={t("filterRegionPlaceholder")}
                                                icon={MapPin}
                                                loading={regionsLoading}
                                            />
                                        )}

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
                                        <FilterMultiSelect
                                            label={t("filterStatus")}
                                            name={ORDER_FILTER_KEYS.status}
                                            value={statusValues}
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
                                            <FilterClearButton
                                                onClick={handleReset}
                                                className="shrink-0"
                                            />
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
                                                {canUseBranchFilter && branchId && (
                                                    <FilterChip
                                                        label={`${t("chipBranch")}: ${branches.find((b) => b.value === branchId)?.label ?? `#${branchId}`}`}
                                                        onRemove={() =>
                                                            update(ORDER_FILTER_KEYS.branchId, ORDER_FILTER_KEYS.branchId, "")
                                                        }
                                                    />
                                                )}
                                                {isManagerRole ? (
                                                    districtId && (
                                                        <FilterChip
                                                            label={`${t("district")}: ${managerDistricts.find((d) => d.value === districtId)?.label ?? `#${districtId}`}`}
                                                            onRemove={() =>
                                                                update(ORDER_FILTER_KEYS.districtId, ORDER_FILTER_KEYS.districtId, "")
                                                            }
                                                        />
                                                    )
                                                ) : (
                                                    regionId && (
                                                        <FilterChip
                                                            label={`${t("chipRegion")}: ${regions.find((r) => r.value === regionId)?.label ?? `#${regionId}`}`}
                                                            onRemove={() =>
                                                                update(ORDER_FILTER_KEYS.regionId, ORDER_FILTER_KEYS.regionId, "")
                                                            }
                                                        />
                                                    )
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
                                                            updateStatus(statusValues.filter((item) => item !== status))
                                                        }
                                                    />
                                                ))}
                                                {dateFrom && (
                                                    <FilterChip
                                                        label={`${t("chipFrom")}: ${dateFrom}`}
                                                        onRemove={() =>
                                                            update(ORDER_FILTER_KEYS.dateFrom, ORDER_FILTER_KEYS.dateFrom, "")
                                                        }
                                                    />
                                                )}
                                                {dateTo && (
                                                    <FilterChip
                                                        label={`${t("chipTo")}: ${dateTo}`}
                                                        onRemove={() =>
                                                            update(ORDER_FILTER_KEYS.dateTo, ORDER_FILTER_KEYS.dateTo, "")
                                                        }
                                                    />
                                                )}
                                                {search && (
                                                    <FilterChip
                                                        label={`${t("chipSearch")}: "${search}"`}
                                                        onRemove={() => updateSearch("")}
                                                    />
                                                )}
                                            </div>
                                        )}

                                        <div className="hidden flex-1 sm:block" />

                                        {/* Export Excel */}
                                        {onExport && (
                                            <button
                                                type="button"
                                                onClick={onExport}
                                                disabled={isExporting}
                                                aria-label={t("export", { ns: "common" })}
                                                className="
                                                    flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 sm:ml-auto sm:w-auto
                                                    bg-emerald-500 hover:bg-emerald-600
                                                    text-white text-xs font-semibold
                                                    transition-all duration-200
                                                    shadow-sm hover:shadow-md hover:shadow-emerald-500/25
                                                    disabled:cursor-not-allowed disabled:bg-emerald-500/55 disabled:hover:bg-emerald-500/55 disabled:hover:shadow-sm
                                                "
                                            >
                                                <Download size={14} />
                                                {isExporting
                                                    ? t("exporting", { ns: "common", defaultValue: "Export..." })
                                                    : t("export", { ns: "common" })}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className={`${isMobile ? "hidden sm:flex sm:flex-col sm:gap-4" : "flex flex-col gap-4"}`}>

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
                    key={`desktop-search-${searchResetKey}`}
                    value={search}
                    onChange={updateSearch}
                    placeholder={t("filterSearchPlaceholder")}
                    className="w-full sm:w-56"
                />
            </div>

            {/* ── 2-qator: selectlar ── */}
            <div className={selectGridClassName}>
                {/* MARKET */}
                {canUseBranchFilter && (
                    <SearchableSelect
                        label={t("filterMarket")}
                        name={ORDER_FILTER_KEYS.marketId}
                        value={marketId}
                        onChange={(value) =>
                            update(ORDER_FILTER_KEYS.marketId, ORDER_FILTER_KEYS.marketId, value)
                        }
                        options={markets}
                        placeholder={t("filterMarketPlaceholder")}
                        icon={Building2}
                        loading={marketsLoading}
                    />
                )}
                {/* FILIAL */}
                {shouldShowBranchFilter && (
                    <SearchableSelect
                        label={t("filterBranch")}
                        name={ORDER_FILTER_KEYS.branchId}
                        value={branchId}
                        onChange={(value) =>
                            update(ORDER_FILTER_KEYS.branchId, ORDER_FILTER_KEYS.branchId, value)
                        }
                        options={branches}
                        placeholder={t("filterBranchPlaceholder")}
                        icon={Store}
                        loading={branchesLoading}
                    />
                )}

                {/* VILOYAT */}
                {isManagerRole ? (
                    <SearchableSelect
                        label={t("district")}
                        name={ORDER_FILTER_KEYS.districtId}
                        value={districtId}
                        onChange={updateDistrictAndResetCourier}
                        options={managerDistricts}
                        placeholder={t("selectDistrict")}
                        icon={MapPin}
                        loading={districtsLoading}
                    />
                ) : (
                    <SearchableSelect
                        label={t("filterRegion")}
                        name={ORDER_FILTER_KEYS.regionId}
                        value={regionId}
                        onChange={updateRegionAndResetCourier}
                        options={regions}
                        placeholder={t("filterRegionPlaceholder")}
                        icon={MapPin}
                        loading={regionsLoading}
                    />
                )}

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
                <FilterMultiSelect
                    label={t("filterStatus")}
                    name={ORDER_FILTER_KEYS.status}
                    value={statusValues}
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
                    <FilterClearButton
                        onClick={handleReset}
                        className="shrink-0"
                    />
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
                        {canUseBranchFilter && branchId && (
                            <FilterChip
                                label={`${t("chipBranch")}: ${branches.find((b) => b.value === branchId)?.label ?? `#${branchId}`}`}
                                onRemove={() =>
                                    update(ORDER_FILTER_KEYS.branchId, ORDER_FILTER_KEYS.branchId, "")
                                }
                            />
                        )}
                        {isManagerRole ? (
                            districtId && (
                                <FilterChip
                                    label={`${t("district")}: ${managerDistricts.find((d) => d.value === districtId)?.label ?? `#${districtId}`}`}
                                    onRemove={() =>
                                        update(ORDER_FILTER_KEYS.districtId, ORDER_FILTER_KEYS.districtId, "")
                                    }
                                />
                            )
                        ) : (
                            regionId && (
                                <FilterChip
                                    label={`${t("chipRegion")}: ${regions.find((r) => r.value === regionId)?.label ?? `#${regionId}`}`}
                                    onRemove={() =>
                                        update(ORDER_FILTER_KEYS.regionId, ORDER_FILTER_KEYS.regionId, "")
                                    }
                                />
                            )
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
                                    updateStatus(statusValues.filter((item) => item !== status))
                                }
                            />
                        ))}
                        {dateFrom && (
                            <FilterChip
                                label={`${t("chipFrom")}: ${dateFrom}`}
                                onRemove={() =>
                                    update(ORDER_FILTER_KEYS.dateFrom, ORDER_FILTER_KEYS.dateFrom, "")
                                }
                            />
                        )}
                        {dateTo && (
                            <FilterChip
                                label={`${t("chipTo")}: ${dateTo}`}
                                onRemove={() =>
                                    update(ORDER_FILTER_KEYS.dateTo, ORDER_FILTER_KEYS.dateTo, "")
                                }
                            />
                        )}
                        {search && (
                            <FilterChip
                                label={`${t("chipSearch")}: "${search}"`}
                                onRemove={() => updateSearch("")}
                            />
                        )}
                    </div>
                )}

                <div className="hidden flex-1 sm:block" />

                {/* Export Excel */}
                {onExport && (
                    <button
                        type="button"
                        onClick={onExport}
                        disabled={isExporting}
                        aria-label={t("export", { ns: "common" })}
                        className="
                            flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 sm:ml-auto sm:w-auto
                            bg-emerald-500 hover:bg-emerald-600
                            text-white text-xs font-semibold
                            transition-all duration-200
                            shadow-sm hover:shadow-md hover:shadow-emerald-500/25
                            disabled:cursor-not-allowed disabled:bg-emerald-500/55 disabled:hover:bg-emerald-500/55 disabled:hover:shadow-sm
                        "
                    >
                        <Download size={14} />
                        {isExporting
                            ? t("exporting", { ns: "common", defaultValue: "Export..." })
                            : t("export", { ns: "common" })}
                    </button>
                )}
            </div>
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
