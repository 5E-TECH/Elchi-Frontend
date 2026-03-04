import { memo } from 'react';
import { Users, Store, UserCheck } from 'lucide-react';

export const UserStats = memo(() => {
    const stats = [
        {
            label: 'Barcha Foydalanuvchilar',
            value: '150',
            icon: Users,
            colorFrom: '#3b82f6',
            colorTo: '#2563eb',
            bg: 'bg-blue-500/10',
            text: 'text-blue-500',
            progress: 70
        },
        {
            label: 'Marketlar',
            value: '92',
            icon: Store,
            colorFrom: '#10b981',
            colorTo: '#059669',
            bg: 'bg-emerald-500/10',
            text: 'text-emerald-500',
            progress: 45
        },
        {
            label: 'Xodimlar',
            value: '58',
            icon: UserCheck,
            colorFrom: '#8b5cf6',
            colorTo: '#7c3aed',
            bg: 'bg-purple-light/10',
            text: 'text-purple-light',
            progress: 30
        }
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
            {stats.map((stat, index) => {
                const IconComponent = stat.icon;
                return (
                    <div
                        key={index}
                        className="relative overflow-hidden rounded-2xl p-5 md:p-6 bg-primary dark:bg-main border border-maindark/5 dark:border-primary/5 shadow-lg shadow-maindark/5 group hover:-translate-y-1 active:scale-95 transition-all duration-300 cursor-default"
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
                                    <p className="text-sm font-medium text-maindark/60 dark:text-primary mb-1 leading-snug">
                                        {stat.label}
                                    </p>
                                    <h3 className="text-3xl font-bold text-maindark dark:text-primary tracking-tight">
                                        {stat.value}
                                    </h3>
                                </div>
                                {/* Icon badge */}
                                <div
                                    className={`p-3 rounded-xl ${stat.bg} ${stat.text} shadow-md backdrop-blur-sm shrink-0`}
                                >
                                    <IconComponent size={22} strokeWidth={2.5} />
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="flex items-center gap-3">
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
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
});
