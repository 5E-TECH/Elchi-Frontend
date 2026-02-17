import { memo } from 'react';
import { ArrowLeft, Shield, Users, Truck, Store, Headphones, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types/user';
import { UserRoleBadge } from './UserRoleBadge';
import { UserStatusBadge } from './UserStatusBadge';

interface UserDetailHeaderProps {
    user: User;
}

// Role-based gradients va icons
const roleConfig = {
    admin: {
        gradient: 'from-purple-600 to-indigo-600',
        icon: Shield,
    },
    manager: {
        gradient: 'from-blue-500 to-cyan-500',
        icon: Users,
    },
    courier: {
        gradient: 'from-orange-500 to-amber-500',
        icon: Truck,
    },
    market: {
        gradient: 'from-emerald-500 to-teal-500',
        icon: Store,
    },
    marketing: {
        gradient: 'from-emerald-500 to-teal-500',
        icon: Store,
    },
    operator: {
        gradient: 'from-pink-500 to-rose-500',
        icon: Headphones,
    },
    superadmin: {
        gradient: 'from-red-600 to-orange-600',
        icon: Crown,
    },
};

export const UserDetailHeader = memo(({ user }: UserDetailHeaderProps) => {
    const navigate = useNavigate();
    const config = roleConfig[user.role] || roleConfig.admin;
    const Icon = config.icon;

    return (
        <div className={`relative bg-gradient-to-br ${config.gradient} rounded-2xl overflow-hidden shadow-xl`}>
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
            </div>

            {/* Content */}
            <div className="relative px-8 py-6">
                {/* Back Button */}
                <button
                    onClick={() => navigate('/users')}
                    className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-6"
                >
                    <ArrowLeft size={20} />
                    <span className="text-sm font-medium">Orqaga</span>
                </button>

                {/* User Info */}
                <div className="flex items-center gap-6">
                    {/* Avatar/Icon */}
                    <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border-2 border-white/30">
                        <Icon className="w-10 h-10 text-white" />
                    </div>

                    {/* Name & Badges */}
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-white mb-2">{user.name}</h1>
                        <div className="flex items-center gap-3">
                            <UserRoleBadge role={user.role} />
                            <UserStatusBadge status={user.status} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

UserDetailHeader.displayName = 'UserDetailHeader';
