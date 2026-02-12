import { memo } from 'react';
import type { UserRole } from '../types/user';

interface UserRoleBadgeProps {
    role: UserRole;
}

const roleConfig: Record<UserRole, { label: string; className: string }> = {
    admin: {
        label: 'Admin',
        className: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    },
    manager: {
        label: 'Manager',
        className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    },
    marketing: {
        label: 'Marketing',
        className: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    },
    operator: {
        label: 'Operator',
        className: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    },
    courier: {
        label: 'Kuryer',
        className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    },
};

export const UserRoleBadge = memo(({ role }: UserRoleBadgeProps) => {
    const config = roleConfig[role];

    return (
        <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
        >
            {config.label}
        </span>
    );
});
