import { memo } from 'react';
import type { UserStatus } from '../types/user';
import { useTranslation } from 'react-i18next';

interface UserStatusBadgeProps {
    status: UserStatus;
}

const statusConfig: Record<UserStatus, { label: string; className: string }> = {
    active: {
        label: 'Faol',
        className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    },
    inactive: {
        label: 'Faol emas',
        className: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    },
    blocked: {
        label: 'Bloklangan',
        className: 'bg-red-500/10 text-red-500 border-red-500/20',
    },
};

export const UserStatusBadge = memo(({ status }: UserStatusBadgeProps) => {
    const { t } = useTranslation("users");
    const config = statusConfig[status];

    return (
        <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
        >
            {status === "active" ? t("statusActive") : status === "inactive" ? t("statusInactive") : t("statusBlocked")}
        </span>
    );
});
