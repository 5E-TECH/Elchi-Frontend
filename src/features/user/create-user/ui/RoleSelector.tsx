import { memo } from 'react';
import type { UserRole } from '../../../../entities/user/types/user';
import type { LucideIcon } from 'lucide-react';
import { Shield, Users, Truck, Store, Check, Briefcase } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getUserRoleLabelKey } from '../../../../entities/user/lib/role';

interface RoleSelectorProps {
    selectedRole: UserRole;
    onSelect: (role: UserRole) => void;
}

const roles: { id: UserRole; label: string; icon: LucideIcon; gradient: string; shadow: string }[] = [
    {
        id: 'admin',
        label: 'Admin',
        icon: Shield,
        gradient: 'from-purple-600 to-indigo-600',
        shadow: 'shadow-purple-500/20'
    },
    {
        id: 'manager',
        label: 'Menejer',
        icon: Briefcase,
        gradient: 'from-violet-500 to-fuchsia-500',
        shadow: 'shadow-violet-500/20'
    },
    {
        id: 'registrator',
        label: "Ro'yxatchi",
        icon: Users,
        gradient: 'from-blue-500 to-cyan-500',
        shadow: 'shadow-blue-500/20'
    },
    {
        id: 'courier',
        label: 'Kuryer',
        icon: Truck,
        gradient: 'from-orange-500 to-amber-500',
        shadow: 'shadow-orange-500/20'
    },
    {
        id: 'marketing',
        label: 'Market',
        icon: Store,
        gradient: 'from-emerald-500 to-teal-500',
        shadow: 'shadow-emerald-500/20'
    },
];

export const RoleSelector = memo(({ selectedRole, onSelect }: RoleSelectorProps) => {
    const { t } = useTranslation("users");
    return (
        <div className="flex flex-col gap-3">
            {roles.map((role) => {
                const isSelected = selectedRole === role.id;
                return (
                    <button
                        key={role.id}
                        onClick={() => onSelect(role.id)}
                        className={`
                            relative w-full text-left p-4 rounded-xl transition-all duration-300 border group overflow-hidden
                            ${isSelected
                                ? 'border-transparent shadow-lg transform scale-[1.02]'
                                : 'bg-slate-50 dark:bg-[#1a1f3a] border-slate-100 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'
                            }
                        `}
                    >
                        {/* Background Gradient for Selected State */}
                        <div className={`
                            absolute inset-0 bg-linear-to-r ${role.gradient} transition-opacity duration-300
                            ${isSelected ? 'opacity-100' : 'opacity-0'}
                        `} />

                        <div className="relative flex items-center gap-4">
                            {/* Icon Box */}
                            <div className={`
                                p-3 rounded-lg transition-colors duration-300
                                ${isSelected
                                    ? 'bg-white/20 text-white'
                                    : 'bg-white dark:bg-white/5 text-slate-400 dark:text-white/40 group-hover:text-slate-600 dark:group-hover:text-white/80 shadow-sm'
                                }
                            `}>
                                <role.icon size={20} strokeWidth={2.5} />
                            </div>

                            {/* Label */}
                            <div className="flex-1">
                                <span className={`
                                    block font-bold text-sm transition-colors duration-300
                                    ${isSelected ? 'text-white' : 'text-slate-600 dark:text-white/70 group-hover:text-slate-900 dark:group-hover:text-white'}
                                `}>
                                    {t(getUserRoleLabelKey(role.id))}
                                </span>
                                <span className={`
                                    block text-xs transition-colors duration-300 mt-0.5
                                    ${isSelected ? 'text-white/70' : 'text-slate-400 dark:text-white/40'}
                                `}>
                                    {isSelected ? t("selected") : t("clickToSelect")}
                                </span>
                            </div>

                            {/* Check Icon for Selected */}
                            {isSelected && (
                                <div className="text-white animate-in zoom-in spin-in-12 duration-300">
                                    <Check size={20} strokeWidth={3} />
                                </div>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
});

RoleSelector.displayName = 'RoleSelector';
