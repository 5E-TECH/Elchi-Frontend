import { memo } from 'react';
import type { UserRole } from '../../../../entities/user/types/user';
import { Shield, Users, Truck, Store } from 'lucide-react';

interface RoleSelectorProps {
    selectedRole: UserRole;
    onSelect: (role: UserRole) => void;
}

const roles: { id: UserRole; label: string; icon: any; color: string; gradient: string }[] = [
    { id: 'admin', label: 'Admin', icon: Shield, color: 'text-white', gradient: 'from-purple-600 to-indigo-600' },
    { id: 'manager', label: "Ro'yxatchi", icon: Users, color: 'text-white', gradient: 'from-blue-500 to-cyan-500' },
    { id: 'courier', label: 'Kuryer', icon: Truck, color: 'text-white', gradient: 'from-orange-500 to-amber-500' },
    { id: 'marketing', label: 'Market', icon: Store, color: 'text-white', gradient: 'from-emerald-500 to-teal-500' },
];

export const RoleSelector = memo(({ selectedRole, onSelect }: RoleSelectorProps) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {roles.map((role) => (
                <button
                    key={role.id}
                    onClick={() => onSelect(role.id)}
                    className={`relative overflow-hidden flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 group ${selectedRole === role.id
                        ? 'border-transparent scale-105 shadow-xl shadow-black/20'
                        : 'border-[var(--primary)]/5 bg-[var(--maindark)] hover:bg-[var(--maindark)]/80 hover:border-[var(--primary)]/20'
                        }`}
                >
                    {selectedRole === role.id && (
                        <div className={`absolute inset-0 bg-gradient-to-br ${role.gradient} opacity-100 transition-opacity duration-300`}></div>
                    )}

                    <div className={`relative z-10 p-4 rounded-xl mb-3 transition-transform duration-300 group-hover:scale-110 ${selectedRole === role.id ? 'bg-white/20 text-white' : 'bg-[var(--primary)]/5 text-[var(--primary)]/60 group-hover:text-[var(--primary)]'}`}>
                        <role.icon size={28} strokeWidth={2} />
                    </div>
                    <span className={`relative z-10 font-semibold text-sm transition-colors ${selectedRole === role.id ? 'text-white' : 'text-[var(--primary)]/60 group-hover:text-[var(--primary)]'}`}>
                        {role.label}
                    </span>
                </button>
            ))}
        </div>
    );
});
