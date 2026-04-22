import { memo } from 'react';
import { useDispatch } from 'react-redux';
import { Filter, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import Select from '../../../../shared/ui/Select';
import { GlobalSearchInput } from '../../../search';
import { resetFilters } from '../../../Select/model/FilterSlice';
import { clearAllSearch } from '../../../search/model/searchSlice';
import { useQueryParams } from '../../../../shared/lib/useQueryParams';
import { useTranslation } from 'react-i18next';
import FilterClearButton from '../../../../shared/ui/FilterClearButton';

export const UserFilters = memo(() => {
    const { t } = useTranslation("users");
    const dispatch = useDispatch();
    const { clearAllParams } = useQueryParams();

    // Role options - Backend API ga mos value lar
    const roleOptions = [
        { value: 'admin', label: t('roleAdmin') },
        { value: 'manager', label: t('roleManager') },
        { value: 'courier', label: t('roleCourier') },
        { value: 'market', label: t('roleMarket') },
        { value: 'operator', label: t('roleOperator') },
        { value: 'superadmin', label: t('roleSuperAdmin') },
    ];

    // Status options
    const statusOptions = [
        { value: 'active', label: t('statusActive') },
        { value: 'inactive', label: t('statusInactive') },
    ];

    // Tozalash funksiyasi
    const handleReset = () => {
        dispatch(resetFilters());
        dispatch(clearAllSearch());
        clearAllParams();
    };

    return (
        <section className="relative mb-6 overflow-visible rounded-[28px] border border-white/55 bg-white/75 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] dark:shadow-black/10">
            <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-main/20 blur-3xl dark:bg-main/25" />
            <div className="pointer-events-none absolute -bottom-20 left-1/4 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />

            <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end">
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

                <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,0.75fr)_minmax(180px,0.75fr)_minmax(260px,1.35fr)_auto] xl:items-end">
                    <Select
                        name="role"
                        options={roleOptions}
                        placeholder={t("rolePlaceholder")}
                        icon={ShieldCheck}
                        className="border-white/70 bg-white/85 shadow-sm dark:border-white/10 dark:bg-white/7"
                        useRedux={true}
                        reduxKey="userRole"
                    />

                    <Select
                        name="status"
                        options={statusOptions}
                        placeholder={t("statusSelect")}
                        className="border-white/70 bg-white/85 shadow-sm dark:border-white/10 dark:bg-white/7"
                        useRedux={true}
                        reduxKey="userStatus"
                    />

                    <GlobalSearchInput
                        searchKey="userSearch"
                        placeholder={t("searchPlaceholder")}
                        className="md:col-span-2 xl:col-span-1"
                    />

                    <FilterClearButton
                        onClick={handleReset}
                        className="h-12 rounded-2xl px-5 xl:w-auto"
                    />
                </div>
            </div>
        </section>
    );
});

UserFilters.displayName = 'UserFilters';
