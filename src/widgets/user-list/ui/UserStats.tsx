import { memo } from 'react';
import { Users, Store, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface UserStatsProps {
    totalUsers?: number;
    totalMarkets?: number;
    totalEmployees?: number;
}

const formatCount = (value?: number) =>
    Number(value ?? 0).toLocaleString('uz-UZ');

const getProgress = (value: number, total: number) =>
    total > 0 ? Math.round((value / total) * 100) : 0;

export const UserStats = memo(({
    totalUsers = 0,
    totalMarkets = 0,
    totalEmployees = 0,
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
            bg: 'bg-blue-500/10',
            text: 'text-blue-500',
            progress: 100
        },
        {
            label: t('markets'),
            value: formatCount(safeTotalMarkets),
            icon: Store,
            colorFrom: '#10b981',
            colorTo: '#059669',
            bg: 'bg-emerald-500/10',
            text: 'text-emerald-500',
            progress: getProgress(safeTotalMarkets, safeTotalUsers)
        },
        {
            label: t('employees'),
            value: formatCount(safeTotalEmployees),
            icon: UserCheck,
            colorFrom: '#8b5cf6',
            colorTo: '#7c3aed',
            bg: 'bg-purple-light/10',
            text: 'text-purple-light',
            progress: getProgress(safeTotalEmployees, safeTotalUsers)
        }
    ];

    return (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat, index) => {
                const IconComponent = stat.icon;
                return (
                    <div
                        key={index}
                        className="group relative cursor-default overflow-hidden rounded-[24px] border border-white/55 bg-white/75 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 dark:border-white/10 dark:bg-white/[0.045] dark:shadow-black/10"
                        style={{
                            boxShadow: `0 4px 24px ${stat.colorFrom}18, 0 1px 4px rgba(0,0,0,0.06)`,
                        }}
                    >
                        {/* Decorative blob */}
                        <div
                            className="absolute -right-8 -top-8 w-36 h-36 rounded-full blur-3xl opacity-15 group-hover:opacity-25 transition-opacity duration-500"
                            style={{ background: `radial-gradient(circle, ${stat.colorFrom}, ${stat.colorTo})` }}
                        />

                        <div className="relative z-10">
                            {/* Top row: label + icon */}
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <p className="mb-1 text-sm font-semibold leading-snug text-slate-500 dark:text-white/55">
                                        {stat.label}
                                    </p>
                                    <h3 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                                        {stat.value}
                                    </h3>
                                </div>
                                {/* Icon badge */}
                                <div
                                    className={`shrink-0 rounded-2xl border border-white/50 p-3 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/8 ${stat.bg} ${stat.text}`}
                                >
                                    <IconComponent size={22} strokeWidth={2.5} />
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
        </div>
    );
});
