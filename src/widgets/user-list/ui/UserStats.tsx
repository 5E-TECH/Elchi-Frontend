import { memo } from 'react';
import { UserPlus, Users, Store, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface UserStatsProps {
    totalUsers?: number;
    totalMarkets?: number;
    totalEmployees?: number;
    onAdd?: () => void;
}

const formatCount = (value?: number) =>
    Number(value ?? 0).toLocaleString('uz-UZ');

const getProgress = (value: number, total: number) =>
    total > 0 ? Math.round((value / total) * 100) : 0;

export const UserStats = memo(({
    totalUsers = 0,
    totalMarkets = 0,
    totalEmployees = 0,
    onAdd,
}: UserStatsProps) => {
    const { t } = useTranslation("users");
    const safeTotalUsers = Number(totalUsers) || 0;
    const safeTotalMarkets = Number(totalMarkets) || 0;
    const safeTotalEmployees = Number(totalEmployees) || 0;

    const stats = [
        {
            label: t('allUsers'),
            value: formatCount(safeTotalUsers),
            icon: Users,
            colorFrom: '#3b82f6',
            colorTo: '#2563eb',
            bg: 'bg-blue-500/20 dark:bg-blue-500/25',
            text: 'text-blue-600 dark:text-blue-300',
            progress: 100
        },
        {
            label: t('markets'),
            value: formatCount(safeTotalMarkets),
            icon: Store,
            colorFrom: '#10b981',
            colorTo: '#059669',
            bg: 'bg-emerald-500/20 dark:bg-emerald-500/25',
            text: 'text-emerald-600 dark:text-emerald-300',
            progress: getProgress(safeTotalMarkets, safeTotalUsers)
        },
        {
            label: t('employees'),
            value: formatCount(safeTotalEmployees),
            icon: UserCheck,
            colorFrom: '#8b5cf6',
            colorTo: '#7c3aed',
            bg: 'bg-purple-light/20 dark:bg-purple-light/25',
            text: 'text-purple-light dark:text-purple-200',
            progress: getProgress(safeTotalEmployees, safeTotalUsers)
        }
    ];

    return (
        <div className={`mb-4 grid gap-2 sm:mb-6 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 ${onAdd ? "grid-cols-4" : "grid-cols-3"}`}>
            {stats.map((stat, index) => {
                const IconComponent = stat.icon;
                return (
                    <div
                        key={index}
                        className="group relative cursor-default overflow-hidden rounded-2xl border border-white/70 bg-white/95 p-3 shadow-[0_10px_26px_rgba(15,23,42,0.07)] transition-transform duration-200 sm:rounded-[24px] sm:p-5 sm:shadow-[0_18px_55px_rgba(15,23,42,0.07)] sm:hover:-translate-y-1 dark:border-white/10 dark:bg-[#342f4b] dark:shadow-black/10"
                        style={{
                            boxShadow: `0 4px 24px ${stat.colorFrom}18, 0 1px 4px rgba(0,0,0,0.06)`,
                        }}
                    >
                        {/* Decorative blob */}
                        <div
                            className="absolute -right-8 -top-8 hidden h-36 w-36 rounded-full opacity-10 transition-opacity duration-300 group-hover:opacity-15 sm:block"
                            style={{ background: `radial-gradient(circle, ${stat.colorFrom}, ${stat.colorTo})` }}
                        />

                        <div className="relative z-10">
                            {/* Top row: label + icon */}
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="mb-0.5 hidden truncate text-[11px] font-semibold leading-4 text-slate-500 dark:text-white sm:block sm:text-base sm:leading-snug">
                                        {stat.label}
                                    </p>
                                    <h3 className="text-2xl font-black leading-none tracking-tight text-slate-900 dark:text-white sm:text-[40px]">
                                        {stat.value}
                                    </h3>
                                </div>
                                {/* Icon badge */}
                                <div
                                    className={`shrink-0 rounded-xl border border-white/60 bg-white/90 p-2 shadow-sm sm:rounded-2xl sm:p-3 dark:border-white/10 dark:bg-slate-900/50 ${stat.bg} ${stat.text}`}
                                >
                                    <IconComponent size={17} strokeWidth={2.7} className="sm:h-[22px] sm:w-[22px]" />
                                </div>
                            </div>

                            {/* Progress bar */}
                            {/* <div className="flex items-center gap-3">
                                <div className="flex-1 bg-maindark/8 dark:bg-primary/10 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-1000 ease-out"
                                        style={{
                                            width: `${stat.progress}%`,
                                            background: `linear-gradient(to right, ${stat.colorFrom}, ${stat.colorTo})`
                                        }}
                                    />
                                </div>
                                <span className="text-xs font-semibold text-maindark/50 dark:text-primary/50 w-8 text-right">
                                    {stat.progress}%
                                </span>
                            </div> */}
                        </div>
                    </div>
                );
            })}

            {onAdd && (
                <button
                    type="button"
                    onClick={onAdd}
                    aria-label={t("addUser")}
                    className="group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-white/70 bg-white/95 p-3 shadow-[0_10px_26px_rgba(15,23,42,0.07)] transition-shadow duration-200 hover:border-main/40 hover:shadow-[0_14px_32px_rgba(87,106,219,0.2)] dark:border-white/10 dark:bg-[#342f4b] sm:hidden"
                >
                    <span className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-main/10 transition-opacity group-hover:opacity-80" />
                    <span className="relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/60 bg-main text-white shadow-md shadow-main/30">
                        <UserPlus size={20} strokeWidth={2.4} />
                    </span>
                </button>
            )}
        </div>
    );
});
