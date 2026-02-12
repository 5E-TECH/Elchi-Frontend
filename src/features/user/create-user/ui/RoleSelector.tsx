import { memo } from 'react';
import type { UserRole } from '../../../../entities/user/types/user';
import { Shield, Users, Truck, Store, Headset } from 'lucide-react';

interface RoleSelectorProps {
    selectedRole: UserRole;
    onSelect: (role: UserRole) => void;
}

const roles: { id: UserRole; label: string; icon: any; color: string }[] = [
    { id: 'admin', label: 'Admin', icon: Shield, color: 'text-purple-500 bg-purple-500/10' },
    { id: 'manager', label: 'Ro\'yxatchi', icon: Users, color: 'text-blue-500 bg-blue-500/10' },
    { id: 'courier', label: 'Kuryer', icon: Truck, color: 'text-yellow-500 bg-yellow-500/10' },
    { id: 'marketing', label: 'Market', icon: Store, color: 'text-emerald-500 bg-emerald-500/10' },
    { id: 'operator', label: 'Operator', icon: Headset, color: 'text-orange-500 bg-orange-500/10' },
];

export const RoleSelector = memo(({ selectedRole, onSelect }: RoleSelectorProps) => {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {roles.map((role) => (
                <button
                    key={role.id}
                    onClick={() => onSelect(role.id)}
                    className={`relative overflow-hidden flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 group ${selectedRole === role.id
                            ? 'border-[var(--main)] bg-[var(--main)]/10 scale-105 shadow-xl shadow-[var(--main)]/20'
                            : 'border-[var(--primary)]/5 bg-[var(--primarydark)] hover:bg-[var(--primarydark)]/80 hover:border-[var(--primary)]/20'
                        }`}
                >
                    <div className={`p-4 rounded-xl mb-3 transition-transform duration-300 group-hover:scale-110 ${role.color} ${selectedRole === role.id ? 'bg-[var(--main)] text-white' : ''}`}>
                        <role.icon size={28} strokeWidth={selectedRole === role.id ? 2.5 : 2} />
                    </div>
                    <span className={`font-semibold text-sm transition-colors ${selectedRole === role.id ? 'text-[var(--primary)]' : 'text-[var(--primary)]/60 group-hover:text-[var(--primary)]'}`}>
                        {role.label}
                    </span>

                    {selectedRole === role.id && (
                        <div className="absolute inset-0 border-2 border-[var(--main)] rounded-2xl pointer-events-none animate-pulse"></div>
                    )}
                </button>
            ))}
        </div>
    );
});
