import { memo } from 'react';
import {
    User as UserIcon,
    Phone,
    AtSign,
    ShieldCheck,
    // Activity,
    Wallet,
    CalendarDays,
    Home,
    Building2,
    MapPin,
    CheckCircle2,
    XCircle,
    MinusCircle,
    Package,
} from 'lucide-react';
import type { User } from '../types/user';

interface UserInfoCardsProps {
    user: User;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatMoney = (n: number) =>
    n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm";

const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin', manager: "Ro'yxatchi", courier: 'Kuryer',
    market: 'Market', marketing: 'Market', operator: 'Operator', superadmin: 'Super Admin',
    customer: 'Mijoz',
};

const STATUS_MAP: Record<User['status'], {
    label: string; icon: React.ElementType;
    text: string; bg: string; dot: string; pulse: boolean;
}> = {
    active: { label: 'Faol', icon: CheckCircle2, text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', dot: 'bg-emerald-500', pulse: true },
    inactive: { label: 'Faol emas', icon: MinusCircle, text: 'text-slate-500', bg: 'bg-slate-50 dark:bg-white/5', dot: 'bg-slate-400', pulse: false },
    blocked: { label: 'Bloklangan', icon: XCircle, text: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', dot: 'bg-red-500', pulse: false },
};

// ─── Info Chip ─────────────────────────────────────────────────────────────────

interface ChipProps {
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    label: string;
    value: React.ReactNode;
    wide?: boolean;
}

const InfoChip = ({ icon: Icon, iconBg, iconColor, label, value, wide }: ChipProps) => (
    <div className={`flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:border-main/30 dark:hover:border-main/30 hover:shadow-sm transition-all group ${wide ? 'col-span-2' : ''}`}>
        <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
            <Icon size={17} className={iconColor} />
        </div>
        <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/80 mb-1 leading-none">
                {label}
            </p>
            <div className="text-sm font-semibold text-slate-800 dark:text-white break-all leading-snug">
                {value}
            </div>
        </div>
    </div>
);

// ─── Separator ────────────────────────────────────────────────────────────────

const Divider = ({ title }: { title: string }) => (
    <div className="col-span-2 flex items-center gap-3 pt-1">
        <div className="h-px flex-1 bg-slate-100 dark:bg-white/10" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white whitespace-nowrap">
            {title}
        </span>
        <div className="h-px flex-1 bg-slate-100 dark:bg-white/10" />
    </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

export const UserInfoCards = memo(({ user }: UserInfoCardsProps) => {
    const isAdmin = user.role === 'admin' || user.role === 'manager' || user.role === 'superadmin';
    const isCourier = user.role === 'courier';
    const isMarket = user.role === 'market' || user.role === 'marketing';
    const isCustomer = user.role === 'customer';
    const sc = STATUS_MAP[user.status];
    console.log(sc);

    // const StatusIcon = sc.icon;

    return (
        <div className="bg-white dark:bg-maindark rounded-2xl border border-slate-100 dark:border-primarydark/20 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 dark:border-white/5">
                <div className="w-1 h-5 bg-main rounded-full" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-600 dark:text-white">
                    Profil Ma'lumotlari
                </h3>
            </div>

            {/* Grid */}
            <div className="p-5 grid grid-cols-2 gap-3">

                {/* ── Umumiy ── */}
                <InfoChip
                    icon={UserIcon}
                    iconBg="bg-main/10 dark:bg-main/20"
                    iconColor="text-main"
                    label="To'liq Ism"
                    value={user.name}
                />

                <InfoChip
                    icon={Phone}
                    iconBg="bg-blue-50 dark:bg-blue-500/10"
                    iconColor="text-blue-500"
                    label="Telefon"
                    value={user.phone_number}
                />

                <InfoChip
                    icon={ShieldCheck}
                    iconBg="bg-violet-50 dark:bg-violet-500/10"
                    iconColor="text-violet-500"
                    label="Rol"
                    value={ROLE_LABELS[user.role] ?? user.role}
                />

                {/* <InfoChip
                    icon={Activity}
                    iconBg={sc.bg}
                    iconColor={sc.text}
                    label="Holat"
                    value={
                        <span className={`inline-flex items-center gap-1.5 ${sc.text}`}>
                            <span className="relative flex h-2 w-2">
                                {sc.pulse && (
                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${sc.dot} opacity-70`} />
                                )}
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${sc.dot}`} />
                            </span>
                            <StatusIcon size={13} />
                            {sc.label}
                        </span>
                    }
                /> */}

                {user.username && user.role !== 'customer' && (
                    <InfoChip
                        icon={AtSign}
                        iconBg="bg-indigo-50 dark:bg-indigo-500/10"
                        iconColor="text-indigo-500"
                        label="Username"
                        value={<span className="text-indigo-500">{user.username}</span>}
                    />
                )}

                {isCustomer && (
                    <InfoChip
                        icon={Package}
                        iconBg="bg-blue-50 dark:bg-blue-500/10"
                        iconColor="text-blue-500"
                        label="Jami Buyurtmalar"
                        value={user.orders?.length ?? 0}
                    />
                )}

                {/* ── Admin / Manager: Moliya ── */}
                {isAdmin && (
                    <>
                        <Divider title="Moliyaviy" />

                        <InfoChip
                            icon={Wallet}
                            iconBg="bg-main/10 dark:bg-main/20"
                            iconColor="text-main"
                            label="Oylik Maosh"
                            value={<span className="text-main font-bold">{formatMoney(user.salary)}</span>}
                        />

                        {user.payment_day && (
                            <InfoChip
                                icon={CalendarDays}
                                iconBg="bg-purple-50 dark:bg-purple-500/10"
                                iconColor="text-purple-500"
                                label="To'lov Kuni"
                                value={`${user.payment_day}-kun`}
                            />
                        )}
                    </>
                )}


                {/* ── Courier: Tarif ── */}
                {isCourier && (
                    <>
                        <Divider title="Tarif" />

                        <InfoChip
                            icon={Home}
                            iconBg="bg-orange-50 dark:bg-orange-500/10"
                            iconColor="text-orange-500"
                            label="Uyga Tarif"
                            value={<span className="text-orange-500 font-bold">{formatMoney(user.tariff_home ?? 0)}</span>}
                        />

                        <InfoChip
                            icon={Building2}
                            iconBg="bg-amber-50 dark:bg-amber-500/10"
                            iconColor="text-amber-500"
                            label="Markazga Tarif"
                            value={<span className="text-amber-500 font-bold">{formatMoney(user.tariff_center ?? 0)}</span>}
                        />
                    </>
                )}

                {/* ── Market: Tarif ── */}
                {isMarket && (
                    <>
                        <Divider title="Tarif" />

                        <InfoChip
                            icon={Home}
                            iconBg="bg-emerald-50 dark:bg-emerald-500/10"
                            iconColor="text-emerald-500"
                            label="Uyga Tarif"
                            value={<span className="text-emerald-500 font-bold">{formatMoney(user.tariff_home ?? 0)}</span>}
                        />

                        <InfoChip
                            icon={Building2}
                            iconBg="bg-teal-50 dark:bg-teal-500/10"
                            iconColor="text-teal-500"
                            label="Markazga Tarif"
                            value={<span className="text-teal-500 font-bold">{formatMoney(user.tariff_center ?? 0)}</span>}
                        />

                        <InfoChip
                            icon={MapPin}
                            iconBg="bg-cyan-50 dark:bg-cyan-500/10"
                            iconColor="text-cyan-500"
                            label="Asosiy Tarif"
                            value={user.default_tariff === 'center' ? 'Markazgacha' : 'Eshikkacha'}
                        />
                    </>
                )}
            </div>
        </div>
    );
});

UserInfoCards.displayName = 'UserInfoCards';
