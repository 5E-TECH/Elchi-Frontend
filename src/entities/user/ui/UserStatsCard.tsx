import { memo, useState, useEffect } from 'react';
import { Wallet, Calendar, Home, Building, MapPin } from 'lucide-react';
import type { User } from '../types/user';

interface UserStatsCardProps {
    user: User;
}

// Summa formatlanishi
const formatCurrency = (amount: number): string => {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

export const UserStatsCard = memo(({ user }: UserStatsCardProps) => {
    // Animated counter state
    const [displaySalary, setDisplaySalary] = useState(0);
    const [progress, setProgress] = useState(0);

    // Admin va Manager uchun
    if (user.role === 'admin' || user.role === 'manager') {
        // Animated counter effect
        useEffect(() => {
            const duration = 2000; // 2 seconds
            const steps = 60;
            const increment = user.salary / steps;
            let current = 0;

            const timer = setInterval(() => {
                current += increment;
                if (current >= user.salary) {
                    setDisplaySalary(user.salary);
                    setProgress(100);
                    clearInterval(timer);
                } else {
                    setDisplaySalary(Math.floor(current));
                    setProgress((current / user.salary) * 100);
                }
            }, duration / steps);

            return () => clearInterval(timer);
        }, [user.salary]);

        // Progress bar color based on salary
        const getProgressColor = () => {
            if (user.salary >= 10000000) return 'bg-emerald-400';
            if (user.salary >= 5000000) return 'bg-blue-400';
            return 'bg-purple-400';
        };

        return (
            <div className="bg-gradient-to-br from-main to-primarydark rounded-2xl p-6 text-white shadow-lg">
                <h3 className="text-lg font-bold mb-6">Oylik Ma'lumotlari</h3>

                <div className="space-y-4">
                    {/* Maosh - with animation */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20 relative overflow-hidden">
                        {/* Animated background glow */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" />

                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center animate-bounce">
                                    <Wallet className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-sm font-medium text-white/80">OYLIK MAOSH</span>
                            </div>

                            {/* Animated counter */}
                            <p className="text-3xl font-bold mb-3 tabular-nums">
                                {formatCurrency(displaySalary)} so'm
                            </p>

                            {/* Progress bar */}
                            <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={`absolute top-0 left-0 h-full ${getProgressColor()} rounded-full transition-all duration-300 ease-out`}
                                    style={{ width: `${progress}%` }}
                                >
                                    {/* Shimmer effect */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                                </div>
                            </div>

                            {/* Percentage */}
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-xs text-white/60">Progress</span>
                                <span className="text-xs font-bold text-white">{Math.floor(progress)}%</span>
                            </div>
                        </div>
                    </div>

                    {/* To'lov Kuni */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-sm font-medium text-white/80">TO'LOV KUNI</span>
                        </div>
                        <p className="text-2xl font-bold">{user.payment_day}-kun</p>
                    </div>
                </div>
            </div>
        );
    }

    // Courier uchun
    if (user.role === 'courier') {
        return (
            <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-6 text-white shadow-lg">
                <h3 className="text-lg font-bold mb-6">Tarif Ma'lumotlari</h3>

                <div className="space-y-4">
                    {/* Uyga Tarif */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                <Home className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-sm font-medium text-white/80">UYGA TARIF</span>
                        </div>
                        <p className="text-2xl font-bold">{formatCurrency(user.tariff_home || 0)} so'm</p>
                    </div>

                    {/* Markazga Tarif */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                <Building className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-sm font-medium text-white/80">MARKAZGA TARIF</span>
                        </div>
                        <p className="text-2xl font-bold">{formatCurrency(user.tariff_center || 0)} so'm</p>
                    </div>
                </div>
            </div>
        );
    }

    // Market uchun
    if (user.role === 'market' || user.role === 'marketing') {
        return (
            <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl p-6 text-white shadow-lg">
                <h3 className="text-lg font-bold mb-6">Market Ma'lumotlari</h3>

                <div className="space-y-4">
                    {/* Uyga Tarif */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                <Home className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-sm font-medium text-white/80">UYGA TARIF</span>
                        </div>
                        <p className="text-2xl font-bold">{formatCurrency(user.tariff_home || 0)} so'm</p>
                    </div>

                    {/* Markazga Tarif */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                <Building className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-sm font-medium text-white/80">MARKAZGA TARIF</span>
                        </div>
                        <p className="text-2xl font-bold">{formatCurrency(user.tariff_center || 0)} so'm</p>
                    </div>

                    {/* Default Tariff */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                <MapPin className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-sm font-medium text-white/80">ASOSIY TARIF</span>
                        </div>
                        <p className="text-2xl font-bold capitalize">{user.default_tariff}</p>
                    </div>
                </div>
            </div>
        );
    }

    // Operator uchun - stats yo'q
    return null;
});

UserStatsCard.displayName = 'UserStatsCard';
