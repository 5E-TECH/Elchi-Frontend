import { memo } from 'react';
import {
    Shield, Users, Truck, Store, Headphones, Crown,
    Phone, Calendar, Clock,
    CheckCircle2, XCircle, MinusCircle,
} from 'lucide-react';
import type { User } from '../types/user';
import { useTranslation } from 'react-i18next';

interface UserDetailHeaderProps {
    user: User;
}

// ─── Role Config ──────────────────────────────────────────────────────────────

const roleConfig: Record<string, {
    from: string;
    to: string;
    icon: React.ElementType;
    label: string;
}> = {
    admin: { from: 'from-purple-500', to: 'to-indigo-600', icon: Shield, label: 'Admin' },
    manager: { from: 'from-blue-500', to: 'to-cyan-600', icon: Users, label: "Ro'yxatchi" },
    courier: { from: 'from-orange-400', to: 'to-amber-500', icon: Truck, label: 'Kuryer' },
    market: { from: 'from-emerald-500', to: 'to-teal-600', icon: Store, label: 'Market' },
    marketing: { from: 'from-emerald-500', to: 'to-teal-600', icon: Store, label: 'Market' },
    operator: { from: 'from-pink-500', to: 'to-rose-600', icon: Headphones, label: 'Operator' },
    superadmin: { from: 'from-red-500', to: 'to-orange-600', icon: Crown, label: 'Super Admin' },
    customer: { from: 'from-blue-500', to: 'to-indigo-600', icon: Users, label: 'Mijoz' },
};

const statusConfig: Record<User['status'], {
    label: string;
    dot: string;
    text: string;
    bg: string;
    pulse: boolean;
    icon: React.ElementType;
}> = {
    active: { label: 'Faol', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', pulse: true, icon: CheckCircle2 },
    inactive: { label: 'Faol emas', dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-white/5', pulse: false, icon: MinusCircle },
    blocked: { label: 'Bloklangan', dot: 'bg-red-500', text: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', pulse: false, icon: XCircle },
};

const formatDate = (d: string) => {
    try {
        return new Date(d).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return d; }
};

// ─── Component ────────────────────────────────────────────────────────────────

export const UserDetailHeader = memo(({ user }: UserDetailHeaderProps) => {
    const { t } = useTranslation("users");
    const rc = roleConfig[user.role] ?? roleConfig.admin;
    const sc = statusConfig[user.status];
    const Icon = rc.icon;
    const StatusIcon = sc.icon;

    const initials = user.name
        .split(' ')
        .slice(0, 2)
        .map(w => w[0]?.toUpperCase() ?? '')
        .join('');

    return (
        <div className="bg-white dark:bg-maindark rounded-2xl border border-slate-100 dark:border-primarydark/20 shadow-sm overflow-hidden">

            {/* ── Gradient Top ── */}
            <div className={`relative h-28 rounded-t-2xl bg-main`}>
                {/* Dekorativ */}
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" />
                <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-black/10 rounded-full" />
                <div className="absolute top-3 right-16 w-2 h-2 bg-white/30 rounded-full" />
                <div className="absolute top-8 left-8 w-1.5 h-1.5 bg-white/20 rounded-full" />
                {/* Rol pill */}
                <div className="absolute top-3 left-4 inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full px-3 py-1">
                    <Icon size={12} className="text-white" />
                    <span className="text-white text-[11px] font-semibold">
                      {user.role === "admin" ? t("roleAdmin")
                        : user.role === "manager" ? t("roleManager")
                        : user.role === "courier" ? t("roleCourier")
                        : user.role === "market" ? t("roleMarket")
                        : user.role === "marketing" ? t("roleMarket")
                        : user.role === "operator" ? t("roleOperator")
                        : user.role === "superadmin" ? t("roleSuperAdmin")
                        : t("roleCustomer")}
                    </span>
                </div>
            </div>

            {/* ── Avatar — gradient ustida ── */}
            <div className="relative z-10 -mt-10 flex flex-col items-center px-5">
                <div className={`w-20 h-20 rounded-2xl bg-main border-4 border-white shadow-xl flex items-center justify-center`}>
                    {user.avatar
                        ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover rounded-xl" />
                        : <span className="text-2xl font-black text-white select-none">{initials}</span>
                    }
                </div>

                {/* Ism */}
                <h2 className="mt-3 text-lg font-bold text-slate-800 dark:text-white text-center leading-tight">
                    {user.name}
                </h2>
                {user.username && user.role !== 'customer' && (
                    <p className="text-sm text-slate-400 dark:text-white/40 mt-0.5">{user.username}</p>
                )}

                {/* Status chip */}
                <div className={`mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full ${sc.bg}`}>
                    <span className="relative flex h-2 w-2">
                        {sc.pulse && (
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${sc.dot} opacity-75`} />
                        )}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${sc.dot}`} />
                    </span>
                    <StatusIcon size={13} className={sc.text} />
                    <span className={`text-xs font-bold ${sc.text}`}>
                      {user.status === "active" ? t("statusActive") : user.status === "inactive" ? t("statusInactive") : t("statusBlocked")}
                    </span>
                </div>
            </div>

            {/* ── Info Rows ── */}
            <div className="mt-5 px-4 pb-5 space-y-1.5">
                {/* Telefon */}
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-default">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
                        <Phone size={13} className="text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30 leading-none mb-0.5">{t("phoneNumberLabel")}</p>
                        <p className="text-xs font-semibold text-slate-700 dark:text-white truncate">{user.phone_number}</p>
                    </div>
                </div>

                {/* Ro'yxatdan o'tgan */}
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-default">
                    <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center shrink-0">
                        <Calendar size={13} className="text-violet-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30 leading-none mb-0.5">{t("registeredAt")}</p>
                        <p className="text-xs font-semibold text-slate-700 dark:text-white">{formatDate(user.createdAt)}</p>
                    </div>
                </div>

                {/* Yangilangan */}
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-default">
                    <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-white/10 flex items-center justify-center shrink-0">
                        <Clock size={13} className="text-slate-500 dark:text-white/40" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30 leading-none mb-0.5">{t("updatedAt")}</p>
                        <p className="text-xs font-semibold text-slate-700 dark:text-white">{formatDate(user.updatedAt)}</p>
                    </div>
                </div>


            </div>
        </div>
    );
});

UserDetailHeader.displayName = 'UserDetailHeader';
