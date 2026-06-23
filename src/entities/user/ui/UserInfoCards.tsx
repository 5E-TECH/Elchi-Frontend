import { memo } from 'react';
import {
    User as UserIcon,
    Phone,
    ShieldCheck,
    // Activity,
    CalendarDays,
    Home,
    Building2,
    MapPin,
    Package,
    Camera,
} from 'lucide-react';
import type { ExpenseProofCondition, User } from '../types/user';
import { useTranslation } from 'react-i18next';
import { getUserRoleLabelKey } from '../lib/role';

interface UserInfoCardsProps {
    user: User;
    onToggleMarketAddOrder?: () => void;
    isMarketAddOrderPending?: boolean;
    onToggleMarketProof?: (condition: ExpenseProofCondition) => void;
    isMarketProofPending?: boolean;
    headerAction?: React.ReactNode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    <div className={`group flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 transition-all hover:border-main/30 hover:shadow-sm dark:border-white/5 dark:bg-white/5 dark:hover:border-main/30 sm:p-4 ${wide ? 'md:col-span-2' : ''}`}>
        <div className={`h-9 w-9 shrink-0 rounded-xl ${iconBg} flex items-center justify-center transition-transform group-hover:scale-110`}>
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
    <div className="col-span-full flex items-center gap-3 pt-1 md:col-span-2">
        <div className="h-px flex-1 bg-slate-100 dark:bg-white/10" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white whitespace-nowrap">
            {title}
        </span>
        <div className="h-px flex-1 bg-slate-100 dark:bg-white/10" />
    </div>
);

interface ToggleButtonProps {
    checked?: boolean;
    disabled?: boolean;
    label: string;
    onClick?: () => void;
}

const ToggleButton = ({ checked = false, disabled = false, label, onClick }: ToggleButtonProps) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`relative inline-flex h-8 w-16 items-center rounded-full border px-1 transition-all ${
            checked
                ? "border-emerald-500/50 bg-emerald-500/20"
                : "border-slate-300 bg-slate-200/70 dark:border-white/15 dark:bg-white/10"
        } ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
        aria-label={label}
        aria-pressed={checked}
    >
        <span
            className={`h-6 w-6 rounded-full bg-white shadow-sm transition-transform dark:bg-slate-100 ${
                checked ? "translate-x-8" : "translate-x-0"
            }`}
        />
        <span className="sr-only">{label}</span>
    </button>
);

// ─── Component ────────────────────────────────────────────────────────────────

export const UserInfoCards = memo(({
    user,
    onToggleMarketAddOrder,
    isMarketAddOrderPending = false,
    onToggleMarketProof,
    isMarketProofPending = false,
    headerAction,
}: UserInfoCardsProps) => {
    const { t } = useTranslation("users");
    const hasPaymentInfo = user.role === 'admin' || user.role === 'manager' || user.role === 'registrator';
    const isCourier = user.role === 'courier';
    const isMarket = user.role === 'market' || user.role === 'marketing';
    const isCustomer = user.role === 'customer';
    const proofConditions = Array.isArray(user.expense_proof_conditions)
        ? user.expense_proof_conditions
        : [];

    // const StatusIcon = sc.icon;

    return (
        <div className="bg-white dark:bg-maindark rounded-2xl border border-slate-100 dark:border-primarydark/20 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/5 sm:px-5">
                <div className="flex min-w-0 items-center gap-2.5">
                    <div className="h-5 w-1 rounded-full bg-main" />
                    <h3 className="truncate text-sm font-black uppercase tracking-wider text-slate-600 dark:text-white">
                        {t("profileInfo")}
                    </h3>
                </div>
                {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 sm:p-4">

                {/* ── Umumiy ── */}
                <InfoChip
                    icon={UserIcon}
                    iconBg="bg-main/10 dark:bg-main/20"
                    iconColor="text-main"
                    label={t("fullName")}
                    value={user.name}
                />

                <InfoChip
                    icon={Phone}
                    iconBg="bg-blue-50 dark:bg-blue-500/10"
                    iconColor="text-blue-500"
                    label={t("phone")}
                    value={user.phone_number}
                />

                <InfoChip
                    icon={ShieldCheck}
                    iconBg="bg-violet-50 dark:bg-violet-500/10"
                    iconColor="text-violet-500"
                    label={t("role")}
                    value={t(getUserRoleLabelKey(user.role))}
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

                {isCustomer && (
                    <InfoChip
                        icon={Package}
                        iconBg="bg-blue-50 dark:bg-blue-500/10"
                        iconColor="text-blue-500"
                        label={t("totalOrders")}
                        value={user.orders?.length ?? 0}
                    />
                )}

                {/* ── Admin / Manager: Moliya ── */}
                {hasPaymentInfo && user.payment_day && (
                    <>
                        <Divider title={t("financial")} />

                        <InfoChip
                            icon={CalendarDays}
                            iconBg="bg-purple-50 dark:bg-purple-500/10"
                            iconColor="text-purple-500"
                            label={t("paymentDay")}
                            value={`${user.payment_day}-kun`}
                        />
                    </>
                )}


                {/* ── Courier: Tarif ── */}
                {isCourier && (
                    <>
                        <Divider title={t("tariff")} />

                        <InfoChip
                            icon={Home}
                            iconBg="bg-orange-50 dark:bg-orange-500/10"
                            iconColor="text-orange-500"
                            label={t("homeTariff")}
                            value={<span className="text-orange-500 font-bold">{Number(user.tariff_home ?? 0).toLocaleString('uz-UZ')} so'm</span>}
                        />

                        <InfoChip
                            icon={Building2}
                            iconBg="bg-amber-50 dark:bg-amber-500/10"
                            iconColor="text-amber-500"
                            label={t("centerTariff")}
                            value={<span className="text-amber-500 font-bold">{Number(user.tariff_center ?? 0).toLocaleString('uz-UZ')} so'm</span>}
                        />
                    </>
                )}

                {/* ── Market: Tarif ── */}
                {isMarket && (
                    <>
                        <Divider title={t("tariff")} />

                        <InfoChip
                            icon={Home}
                            iconBg="bg-emerald-50 dark:bg-emerald-500/10"
                            iconColor="text-emerald-500"
                            label={t("homeTariff")}
                            value={<span className="text-emerald-500 font-bold">{Number(user.tariff_home ?? 0).toLocaleString('uz-UZ')} so'm</span>}
                        />

                        <InfoChip
                            icon={Building2}
                            iconBg="bg-teal-50 dark:bg-teal-500/10"
                            iconColor="text-teal-500"
                            label={t("centerTariff")}
                            value={<span className="text-teal-500 font-bold">{Number(user.tariff_center ?? 0).toLocaleString('uz-UZ')} so'm</span>}
                        />

                        <InfoChip
                            icon={MapPin}
                            iconBg="bg-cyan-50 dark:bg-cyan-500/10"
                            iconColor="text-cyan-500"
                            label={t("mainTariff")}
                            value={user.default_tariff === 'center' ? t("centerOnlyTariff") : t("doorTariff")}
                        />

                        <InfoChip
                            icon={Package}
                            iconBg="bg-indigo-50 dark:bg-indigo-500/10"
                            iconColor="text-indigo-500"
                            label={t("marketAddOrderPermission", { defaultValue: "Buyurtma qo'shish" })}
                            value={
                                <ToggleButton
                                    checked={Boolean(user.add_order)}
                                    disabled={!onToggleMarketAddOrder || isMarketAddOrderPending}
                                    label={t("marketAddOrderPermission", { defaultValue: "Buyurtma qo'shish" })}
                                    onClick={onToggleMarketAddOrder}
                                />
                            }
                        />

                        <Divider title={t("proofPolicy", { defaultValue: "Rasm/video isbot" })} />

                        <InfoChip
                            icon={Camera}
                            iconBg="bg-emerald-50 dark:bg-emerald-500/10"
                            iconColor="text-emerald-500"
                            label={t("sellMediaProofRequired", { defaultValue: "Sotishda isbot" })}
                            value={
                                <ToggleButton
                                    checked={proofConditions.includes('sell_any')}
                                    disabled={!onToggleMarketProof || isMarketProofPending}
                                    label={t("sellMediaProofRequired", { defaultValue: "Sotishda isbot" })}
                                    onClick={() => onToggleMarketProof?.('sell_any')}
                                />
                            }
                        />

                        <InfoChip
                            icon={Camera}
                            iconBg="bg-rose-50 dark:bg-rose-500/10"
                            iconColor="text-rose-500"
                            label={t("cancelMediaProofRequired", { defaultValue: "Bekor qilishda isbot" })}
                            value={
                                <ToggleButton
                                    checked={proofConditions.includes('cancel_any')}
                                    disabled={!onToggleMarketProof || isMarketProofPending}
                                    label={t("cancelMediaProofRequired", { defaultValue: "Bekor qilishda isbot" })}
                                    onClick={() => onToggleMarketProof?.('cancel_any')}
                                />
                            }
                        />
                    </>
                )}
            </div>
        </div>
    );
});

UserInfoCards.displayName = 'UserInfoCards';
