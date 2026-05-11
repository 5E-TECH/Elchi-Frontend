import { memo, useState } from 'react';
import { Loader2, AlertCircle, UserX, Pencil } from 'lucide-react';
import type { User } from '../../../entities/user/types/user';
import { UserDetailHeader } from '../../../entities/user/ui/UserDetailHeader';
import { UserInfoCards } from '../../../entities/user/ui/UserInfoCards';
import { UserStatsCard } from '../../../entities/user/ui/UserStatsCard';
import { CustomerOrdersTable } from '../../../entities/user/ui/CustomerOrdersTable';
import { UpdateUserModal } from '../../../features/user/update-user/ui/UpdateUserModal';
import { useTranslation } from 'react-i18next';

interface UserDetailWidgetProps {
  user?: User;
  isLoading: boolean;
  isError: boolean;
  error?: any;
  isOwnProfile?: boolean;
}

export const UserDetailWidget = memo(({
  user,
  isLoading,
  isError,
  error,
  isOwnProfile = false,
}: UserDetailWidgetProps) => {
  const { t } = useTranslation("users");
  const [showEdit, setShowEdit] = useState(false);

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-80">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-main/10 dark:bg-main/20 rounded-2xl flex items-center justify-center mx-auto">
            <Loader2 className="w-7 h-7 text-main animate-spin" />
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-white/50">{t("loading")}</p>
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
            <p className="font-bold text-slate-800 dark:text-white">{t("loadError")}</p>
            <p className="text-sm text-slate-500 dark:text-white/40 mt-1">
              {error?.response?.data?.message ?? t("loadDataError")}
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
            <p className="font-bold text-slate-800 dark:text-white">{t("notFound")}</p>
            <p className="text-sm text-slate-500 dark:text-white/40 mt-1">{t("userNotFound")}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Success ──
  return (
    <>
      <div className="flex flex-col items-start gap-4 lg:flex-row lg:gap-6">
        {/* Chap — Profil Sidebar */}
        <div className="w-full shrink-0 lg:w-72">
          <UserDetailHeader user={user} />
        </div>

        {/* O'ng — Kontent */}
        <div className="w-full min-w-0 flex-1 space-y-4 sm:space-y-5">
          {/* Edit tugmasi — sahifa yuqorisida */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowEdit(true)}
              className="
                flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold sm:w-auto sm:px-5
                bg-main text-white hover:bg-main/90
                shadow-md shadow-main/20 transition-all duration-200
                active:scale-95
              "
            >
              <Pencil size={15} strokeWidth={2.5} />
              <span>{t("edit")}</span>
            </button>
          </div>

          <UserInfoCards user={user} />
          {user.role === 'customer' ? (
            <CustomerOrdersTable orders={user.orders || []} />
          ) : (
            <UserStatsCard user={user} />
          )}
        </div>
      </div>

      {/* Update Modal */}
      <UpdateUserModal
        userId={showEdit ? user.id : null}
        initialUser={showEdit ? user : null}
        isOwnProfile={isOwnProfile}
        onClose={() => setShowEdit(false)}
      />
    </>
  );
});

UserDetailWidget.displayName = 'UserDetailWidget';
