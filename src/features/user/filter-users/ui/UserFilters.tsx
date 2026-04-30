import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronDown, Filter, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import FilterSelect from '../../../../shared/ui/FilterSelect';
import { resetFilters } from '../../../Select/model/FilterSlice';
import { clearAllSearch, setSearchValue } from '../../../search/model/searchSlice';
import { useQueryParams } from '../../../../shared/lib/useQueryParams';
import { useTranslation } from 'react-i18next';
import FilterClearButton from '../../../../shared/ui/FilterClearButton';
import type { UserRole } from '../../../../entities/user/types/user';
import { getUserRoleLabelKey } from '../../../../entities/user/lib/role';
import type { RootState } from '../../../../app/config/store';
import FilterSearch from '../../../../shared/ui/FilterSearch';

const defaultRoles: UserRole[] = [
    "admin",
    "manager",
    "registrator",
    "courier",
    "market",
    "marketing",
    "operator",
    "superadmin",
    "customer",
];

const normalizeRoles = (roles?: string[]) => {
    const normalized = roles
        ?.filter((role): role is UserRole =>
            typeof role === "string" && defaultRoles.includes(role as UserRole),
        ) ?? defaultRoles;

    return [...new Set(normalized)];
};

interface UserFiltersProps {
    availableRoles?: string[];
}

export const UserFilters = memo(({ availableRoles }: UserFiltersProps) => {
    const { t } = useTranslation("users");
    const dispatch = useDispatch();
    const { clearAllParams, setParam, removeParam } = useQueryParams();
    const filters = useSelector((state: RootState) => state.filter);
    const search = useSelector((state: RootState) => state.search);
    const [isMobile, setIsMobile] = useState(
        typeof window !== "undefined" ? window.innerWidth < 640 : false,
    );
    const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
    const mobilePanelRef = useRef<HTMLDivElement | null>(null);

    const roleOptions = normalizeRoles(availableRoles).map((role) => ({
        value: role,
        label: t(getUserRoleLabelKey(role)),
    }));

    // Status options
    const statusOptions = [
        { value: 'active', label: t('statusActive') },
        { value: 'inactive', label: t('statusInactive') },
    ];

    const activeFilterCount = useMemo(
        () =>
            Number(Boolean(filters.userRole)) +
            Number(Boolean(filters.userStatus)) +
            Number(Boolean(search.userSearch)),
        [filters.userRole, filters.userStatus, search.userSearch],
    );
    const hasFilter = activeFilterCount > 0;

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

    // Tozalash funksiyasi
    const handleReset = () => {
        dispatch(resetFilters());
        dispatch(clearAllSearch());
        clearAllParams();
    };

    const updateSearch = (value: string) => {
        dispatch(setSearchValue({ key: "userSearch", value }));
        if (value) {
            setParam("search", value);
        } else {
            removeParam("search");
        }
    };

    return (
        <section className="relative mb-6 overflow-visible rounded-[28px] border border-white/55 bg-white/75 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] dark:shadow-black/10">
            <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-main/20 blur-3xl dark:bg-main/25" />
            <div className="pointer-events-none absolute -bottom-20 left-1/4 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />

            <div className="relative flex flex-col gap-4">
                {isMobile && (
                    <div ref={mobilePanelRef} className="sm:hidden">
                        <button
                            type="button"
                            onClick={() => setIsMobilePanelOpen((prev) => !prev)}
                            className="flex w-full items-center justify-between rounded-2xl border border-white/70 bg-white/90 px-3.5 py-2.5 text-left shadow-sm transition-colors hover:border-main/40 dark:border-white/10 dark:bg-primarydark/60"
                        >
                            <div className="flex items-center gap-2.5">
                                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-main/10 text-main dark:bg-white/10 dark:text-white">
                                    <Filter size={16} />
                                </span>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-maindark dark:text-primary">
                                        {t("filterPanelTitle")}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {hasFilter
                                            ? t("activeFiltersCount", { count: activeFilterCount })
                                            : t("filterPanelDescription")}
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
                                <div className="rounded-2xl border border-white/70 bg-white/95 p-3 shadow-sm dark:border-white/10 dark:bg-primarydark/60">
                                    <div className="flex flex-col gap-3">
                                        <FilterSelect
                                            label={t("role")}
                                            name="role"
                                            options={roleOptions}
                                            placeholder={t("rolePlaceholder")}
                                            icon={ShieldCheck}
                                            hideLabel
                                            useRedux={true}
                                            reduxKey="userRole"
                                            urlKey="role"
                                            onChange={() => setIsMobilePanelOpen(false)}
                                        />

                                        <FilterSelect
                                            label={t("status")}
                                            name="status"
                                            options={statusOptions}
                                            placeholder={t("statusSelect")}
                                            hideLabel
                                            useRedux={true}
                                            reduxKey="userStatus"
                                            urlKey="status"
                                            onChange={() => setIsMobilePanelOpen(false)}
                                        />

                                        <FilterSearch
                                            value={String(search.userSearch ?? "")}
                                            onChange={updateSearch}
                                            placeholder={t("searchPlaceholder")}
                                        />

                                        <FilterClearButton
                                            onClick={handleReset}
                                            className="h-12 w-full rounded-2xl px-5"
                                            responsiveIconOnly
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="hidden sm:flex sm:flex-col sm:gap-4">
                    <div className="flex min-w-56 items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-main/15 bg-main/10 text-main shadow-sm dark:border-white/10 dark:bg-white/8 dark:text-white">
                            <SlidersHorizontal size={19} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <Filter size={13} className="text-main" />
                                <p className="m-0 text-[11px] font-black uppercase tracking-[0.22em] text-main/80">
                                    {t("title")}
                                </p>
                            </div>
                            <p className="m-0 mt-1 text-sm font-semibold text-slate-700 dark:text-white/80">
                                {t("pageDescription")}
                            </p>
                        </div>
                    </div>

                    <div className="grid w-full grid-cols-12 items-end gap-3">
                        <div className="col-span-12 lg:col-span-6 2xl:col-span-3">
                            <FilterSelect
                                label={t("role")}
                                name="role"
                                options={roleOptions}
                                placeholder={t("rolePlaceholder")}
                                icon={ShieldCheck}
                                hideLabel
                                useRedux={true}
                                reduxKey="userRole"
                                urlKey="role"
                            />
                        </div>

                        <div className="col-span-12 lg:col-span-6 2xl:col-span-3">
                            <FilterSelect
                                label={t("status")}
                                name="status"
                                options={statusOptions}
                                placeholder={t("statusSelect")}
                                hideLabel
                                useRedux={true}
                                reduxKey="userStatus"
                                urlKey="status"
                            />
                        </div>

                        <div className="col-span-12 lg:col-span-11 2xl:col-span-5">
                            <FilterSearch
                                value={String(search.userSearch ?? "")}
                                onChange={updateSearch}
                                placeholder={t("searchPlaceholder")}
                            />
                        </div>

                        <div className="col-span-12 flex justify-end lg:col-span-1">
                            <FilterClearButton
                                onClick={handleReset}
                                className="h-12 w-12"
                                responsiveIconOnly
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
});

UserFilters.displayName = 'UserFilters';
