import { memo, useState, useEffect } from 'react';
import { Wallet, Home, Building2, Clock, TrendingUp, CheckCircle2 } from 'lucide-react';
import type { User } from '../types/user';

interface UserStatsCardProps {
    user: User;
}

const formatNum = (n: number) =>
    Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// ─── Oylik Tsikl Hisoblash ────────────────────────────────────────────────────

const calcCycleProgress = (paymentDay: number) => {
    const now = new Date();
    const today = now.getDate();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed

    let cycleStart: Date;
    let cycleEnd: Date;

    if (today >= paymentDay) {
        // Hozirgi siklda (to'lov kuni o'tdi)
        cycleStart = new Date(year, month, paymentDay);
        cycleEnd = new Date(year, month + 1, paymentDay);
    } else {
        // Oldingi siklda (hali to'lov kuni kelmadi)
        cycleStart = new Date(year, month - 1, paymentDay);
        cycleEnd = new Date(year, month, paymentDay);
    }

    const totalMs = cycleEnd.getTime() - cycleStart.getTime();
    const passedMs = now.getTime() - cycleStart.getTime();
    const progress = Math.min((passedMs / totalMs) * 100, 100);

    const totalDays = Math.round(totalMs / 86400000);
    const passedDays = Math.round(passedMs / 86400000);
    const remainDays = totalDays - passedDays;

    // Keyingi to'lov sanasi
    const nextPayDate = cycleEnd.toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' });

    return { progress, passedDays, totalDays, remainDays, nextPayDate };
};



// ─── Progress Ring (SVG) ──────────────────────────────────────────────────────

const ProgressRing = ({ progress, size = 80, stroke = 6, color = '#576adb' }: {
    progress: number; size?: number; stroke?: number; color?: string;
}) => {
    const r = (size - stroke) / 2;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (progress / 100) * circumference;
    const [animated, setAnimated] = useState(0);

    useEffect(() => {
        const timeout = setTimeout(() => setAnimated(offset), 100);
        return () => clearTimeout(timeout);
    }, [offset]);

    return (
        <svg width={size} height={size} className="-rotate-90">
            {/* Background track */}
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
            {/* Progress arc */}
            <circle
                cx={size / 2} cy={size / 2} r={r}
                fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={circumference}
                strokeDashoffset={animated}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            />
        </svg>
    );
};

// ─── Admin Stats ──────────────────────────────────────────────────────────────

const AdminStats = ({ user }: { user: User }) => {
    const paymentDay = Number(user.payment_day ?? 1);
    // useMemo: bir marta hisoblanadi, re-render loop bo'lmaydi
    const { progress, passedDays, totalDays, remainDays, nextPayDate } = calcCycleProgress(paymentDay);
    const earned = Math.floor(user.salary * (progress / 100));

    return (
        <div className="space-y-4">
            {/* ── Asosiy Maosh Karta ── */}
            <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-main to-primarydark p-5 text-white shadow-lg">
                {/* Dekor */}
                <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/10 rounded-full" />
                <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-black/10 rounded-full" />

                <div className="relative z-10 flex items-start justify-between gap-4">
                    {/* Chap: ma'lumotlar */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                <Wallet size={16} className="text-white" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-widest text-white">Oylik Maosh</span>
                        </div>

                        {/* Maosh: earned / total */}
                        <div className="mb-1">
                            <p className="text-2xl font-black tabular-nums leading-none">
                                <span>{formatNum(earned)}</span>
                                <span className="text-white/40 font-medium mx-1">/</span>
                                <span className="text-white/70">{formatNum(user.salary)}</span>
                                <span className="text-sm font-semibold text-white/60 ml-1">so'm</span>
                            </p>
                            <p className="text-white text-xs mt-1">{passedDays}/{totalDays} kun — {progress.toFixed(0)}% to'plandi</p>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full bg-linear-to-r from-white/70 to-white transition-all duration-1500 ease-out relative"
                                style={{ width: `${progress}%` }}
                            >
                                <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/40 to-transparent animate-pulse" />
                            </div>
                        </div>

                        {/* Qolgan kunlar */}
                        <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                {remainDays <= 3
                                    ? <CheckCircle2 size={13} className="text-white/70" />
                                    : remainDays <= 7
                                        ? <TrendingUp size={13} className="text-white/70" />
                                        : <Clock size={13} className="text-white/50" />
                                }
                                <span className="text-white text-[11px] font-medium">
                                    {remainDays <= 1
                                        ? "🎉 To'lov bugun!"
                                        : remainDays <= 3
                                            ? `⚡ ${remainDays} kun qoldi!`
                                            : `${remainDays} kun qoldi`}
                                </span>
                            </div>
                            <span className="text-white text-[11px]">Keyingisi: {nextPayDate}</span>
                        </div>
                    </div>

                    {/* O'ng: Progress ring */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                        <div className="relative">
                            <ProgressRing progress={progress} size={76} stroke={6} color="rgba(255,255,255,0.9)" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-sm font-black text-white">{progress.toFixed(0)}%</span>
                            </div>
                        </div>
                        <span className="text-[10px] text-white font-bold">Tsikl</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Courier Stats ────────────────────────────────────────────────────────────

const CourierStats = ({ user }: { user: User }) => {
    const home = user.tariff_home ?? 0;
    const center = user.tariff_center ?? 0;
    const max = Math.max(home, center, 1);

    const StatCard = ({
        icon: Icon, label, value, sub, gradient, progress,
    }: {
        icon: React.ElementType; label: string; value: string; sub?: string; gradient: string; progress?: number;
    }) => (
        <div className={`relative overflow-hidden rounded-2xl p-5 bg-linear-to-br ${gradient} text-white shadow-md`}>
            <div className="absolute -top-5 -right-5 w-24 h-24 bg-white/10 rounded-full" />
            <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-black/10 rounded-full" />
            <div className="relative z-10">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                    <Icon size={20} className="text-white" />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/70 mb-1">{label}</p>
                <p className="text-xl font-black leading-tight tabular-nums">{value}</p>
                {sub && <p className="text-white/60 text-xs mt-1">{sub}</p>}
                {progress !== undefined && (
                    <div className="mt-4 h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-white/50 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }} />
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-2 gap-4">
            <StatCard
                icon={Home} label="Uyga Tarif"
                value={`${formatNum(home)} so'm`} sub="Bir yetkazish"
                gradient="from-orange-500 to-amber-500"
                progress={(home / max) * 100}
            />
            <StatCard
                icon={Building2} label="Markazga Tarif"
                value={`${formatNum(center)} so'm`} sub="Bir yetkazish"
                gradient="from-orange-600 to-red-500"
                progress={(center / max) * 100}
            />
        </div>
    );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export const UserStatsCard = memo(({ user }: UserStatsCardProps) => {
    const isAdmin = user.role === 'admin' || user.role === 'manager' || user.role === 'superadmin';
    const isCourier = user.role === 'courier';

    if (!isAdmin && !isCourier) return null;

    return (
        <div className="bg-white dark:bg-maindark rounded-2xl border border-slate-100 dark:border-primarydark/20 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 dark:border-white/5">
                <div className="w-1 h-5 bg-main rounded-full" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-600 dark:text-white">
                    {isAdmin ? "Moliyaviy Ko'rsatkichlar" : "Tarif Ko'rsatkichlari"}
                </h3>
            </div>
            <div className="p-5">
                {isAdmin && <AdminStats user={user} />}
                {isCourier && <CourierStats user={user} />}
            </div>
        </div>
    );
});

UserStatsCard.displayName = 'UserStatsCard';
