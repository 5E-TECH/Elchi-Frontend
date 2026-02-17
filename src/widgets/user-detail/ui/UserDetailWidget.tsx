import { memo } from 'react';
import { Loader2, AlertCircle, UserX } from 'lucide-react';
import type { User } from '../../../entities/user/types/user';
import { UserDetailHeader } from '../../../entities/user/ui/UserDetailHeader';
import { UserInfoCards } from '../../../entities/user/ui/UserInfoCards';
import { UserStatsCard } from '../../../entities/user/ui/UserStatsCard';

interface UserDetailWidgetProps {
  user?: User;
  isLoading: boolean;
  isError: boolean;
  error?: any;
}

export const UserDetailWidget = memo(({ user, isLoading, isError, error }: UserDetailWidgetProps) => {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-main animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-white/60 font-medium">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Xatolik yuz berdi</h3>
          <p className="text-slate-600 dark:text-white/60">
            {error?.response?.data?.message || "Ma'lumotlarni yuklashda xatolik"}
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserX className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Foydalanuvchi topilmadi</h3>
          <p className="text-slate-600 dark:text-white/60">Bu foydalanuvchi mavjud emas</p>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className="space-y-6">
      {/* Header */}
      <UserDetailHeader user={user} />

      {/* Info Cards */}
      <UserInfoCards user={user} />

      {/* Stats Card (role-based) */}
      <UserStatsCard user={user} />
    </div>
  );
});

UserDetailWidget.displayName = 'UserDetailWidget';
