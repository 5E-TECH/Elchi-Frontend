import { memo } from 'react';
import { User as UserIcon, Phone, Shield } from 'lucide-react';
import type { User } from '../types/user';

interface UserInfoCardsProps {
    user: User;
}

export const UserInfoCards = memo(({ user }: UserInfoCardsProps) => {
    const cards = [
        {
            icon: UserIcon,
            label: 'FOYDALANUVCHI NOMI',
            value: user.username,
            color: 'text-blue-500 dark:text-blue-400',
            bgColor: 'bg-blue-50 dark:bg-blue-500/10',
        },
        {
            icon: Phone,
            label: 'TELEFON RAQAM',
            value: user.phone_number,
            color: 'text-emerald-500 dark:text-emerald-400',
            bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
        },
        {
            icon: Shield,
            label: 'ROL',
            value: user.role.toUpperCase(),
            color: 'text-purple-500 dark:text-purple-400',
            bgColor: 'bg-purple-50 dark:bg-purple-500/10',
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.map((card, index) => {
                const Icon = card.icon;
                return (
                    <div
                        key={index}
                        className="bg-white dark:bg-maindark rounded-xl p-5 border border-slate-100 dark:border-primarydark/20 shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 ${card.bgColor} rounded-xl flex items-center justify-center`}>
                                <Icon className={`w-6 h-6 ${card.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-400 dark:text-white/40 uppercase tracking-wider mb-1">
                                    {card.label}
                                </p>
                                <p className="text-base font-bold text-slate-800 dark:text-white truncate">
                                    {card.value}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
});

UserInfoCards.displayName = 'UserInfoCards';
