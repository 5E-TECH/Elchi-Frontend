import { memo } from 'react';
import { Users, Store, UserCheck } from 'lucide-react';

export const UserStats = memo(() => {
    const stats = [
        {
            label: 'Barcha Foydalanuvchilar',
            value: '150',
            icon: Users,
            color: 'from-blue-400 to-blue-600',
            bg: 'bg-blue-500/10',
            text: 'text-blue-500',
            progress: 70
        },
        {
            label: 'Marketlar',
            value: '92',
            icon: Store,
            color: 'from-emerald-400 to-emerald-600',
            bg: 'bg-emerald-500/10',
            text: 'text-emerald-500',
            progress: 45
        },
        {
            label: 'Xodimlar',
            value: '58',
            icon: UserCheck,
            color: 'from-purple-400 to-purple-600',
            bg: 'bg-purple-500/10',
            text: 'text-purple-500',
            progress: 30
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {stats.map((stat, index) => (
                <div
                    key={index}
                    className="bg-[var(--primarydark)] p-6 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-xl shadow-black/10"
                >
                    {/* Decorative Background Blob */}
                    <div className={`absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-20 bg-gradient-to-br ${stat.color} blur-2xl group-hover:scale-150 transition-transform duration-700`}></div>

                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-[var(--primary)]/70 text-sm font-medium mb-1">{stat.label}</p>
                                <h3 className="text-3xl font-bold text-[var(--primary)]">{stat.value}</h3>
                            </div>
                            <div className={`p-3.5 rounded-xl ${stat.bg} ${stat.text} shadow-lg backdrop-blur-sm`}>
                                <stat.icon size={24} strokeWidth={2.5} />
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex-1 bg-[var(--maindark)]/50 rounded-full h-2 overflow-hidden backdrop-blur-sm">
                                <div
                                    className={`h-full rounded-full bg-gradient-to-r ${stat.color} transition-all duration-1000 ease-out`}
                                    style={{ width: `${stat.progress}%` }}
                                ></div>
                            </div>
                            <span className="text-xs font-medium text-[var(--primary)]/50">{stat.progress}%</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
});
