import { memo } from 'react';
import type { UserRole } from '../types/user';
import { useTranslation } from 'react-i18next';
import { getUserRoleLabelKey } from '../lib/role';

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
    registrator: {
        label: "Ro'yxatchi",
        className: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
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
    market: {
        label: 'Market',
        className: 'bg-green-500/10 text-green-500 border-green-500/20',
    },
    superadmin: {
        label: 'Super Admin',
        className: 'bg-red-500/10 text-red-500 border-red-500/20',
    },
    customer: {
        label: 'Mijoz',
        className: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    },
};

export const UserRoleBadge = memo(({ role }: UserRoleBadgeProps) => {
    const { t } = useTranslation("users");
    const config = roleConfig[role] ?? {
        label: t("roleUnknown"),
        className: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    };

    return (
        <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
        >
            {t(getUserRoleLabelKey(role))}
        </span>
    );
});

UserRoleBadge.displayName = 'UserRoleBadge';
