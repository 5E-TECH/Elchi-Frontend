import { memo, useState } from 'react';
import { Loader2, AlertCircle, UserX, Pencil } from 'lucide-react';
import type { User } from '../../../entities/user/types/user';
import { UserDetailHeader } from '../../../entities/user/ui/UserDetailHeader';
import { UserInfoCards } from '../../../entities/user/ui/UserInfoCards';
import { UserStatsCard } from '../../../entities/user/ui/UserStatsCard';
import { UpdateUserModal } from '../../../features/user/update-user/ui/UpdateUserModal';

interface UserDetailWidgetProps {
  user?: User;
  isLoading: boolean;
  isError: boolean;
  error?: any;
}

export const UserDetailWidget = memo(({ user, isLoading, isError, error }: UserDetailWidgetProps) => {
  const [showEdit, setShowEdit] = useState(false);

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-80">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-main/10 dark:bg-main/20 rounded-2xl flex items-center justify-center mx-auto">
            <Loader2 className="w-7 h-7 text-main animate-spin" />
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-white/50">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-80">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <div>
            <p className="font-bold text-slate-800 dark:text-white">Xatolik yuz berdi</p>
            <p className="text-sm text-slate-500 dark:text-white/40 mt-1">
              {error?.response?.data?.message ?? "Ma'lumotlarni yuklashda xatolik"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty ──
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-80">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center justify-center mx-auto">
            <UserX className="w-7 h-7 text-slate-400" />
          </div>
          <div>
            <p className="font-bold text-slate-800 dark:text-white">Topilmadi</p>
            <p className="text-sm text-slate-500 dark:text-white/40 mt-1">Bu foydalanuvchi mavjud emas</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Success ──
  return (
    <>
      <div className="flex gap-6 items-start">
        {/* Chap — Profil Sidebar */}
        <div className="w-72 shrink-0">
          <UserDetailHeader user={user} />
        </div>

        {/* O'ng — Kontent */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Edit tugmasi — sahifa yuqorisida */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowEdit(true)}
              className="
                flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm
                bg-main text-white hover:bg-main/90
                shadow-md shadow-main/20 transition-all duration-200
                active:scale-95
              "
            >
              <Pencil size={15} strokeWidth={2.5} />
              <span>Tahrirlash</span>
            </button>
          </div>

          <UserInfoCards user={user} />
          <UserStatsCard user={user} />
        </div>
      </div>

      {/* Update Modal */}
      <UpdateUserModal
        userId={showEdit ? user.id : null}
        onClose={() => setShowEdit(false)}
      />
    </>
  );
});

UserDetailWidget.displayName = 'UserDetailWidget';
