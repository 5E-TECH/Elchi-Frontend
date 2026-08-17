import { memo, useState } from 'react';
import { Loader2, AlertCircle, UserX, Pencil } from 'lucide-react';
import type { User } from '../../../entities/user/types/user';
import { UserDetailHeader } from '../../../entities/user/ui/UserDetailHeader';
import { UserInfoCards } from '../../../entities/user/ui/UserInfoCards';
import { UserStatsCard } from '../../../entities/user/ui/UserStatsCard';
import { CustomerOrdersTable } from '../../../entities/user/ui/CustomerOrdersTable';
import { UpdateUserModal } from '../../../features/user/update-user/ui/UpdateUserModal';
import { useTranslation } from 'react-i18next';
import { useUser } from '../../../entities/user/api/userApi';
import { useAppNotification } from '../../../app/providers/notification/NotificationProvider';
import type { ExpenseProofCondition } from '../../../entities/user/types/user';

interface UserDetailWidgetProps {
  user?: User;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  isOwnProfile?: boolean;
}

const getErrorMessage = (error: unknown) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    return typeof response?.data?.message === "string" ? response.data.message : undefined;
  }

  return undefined;
};

export const UserDetailWidget = memo(({
  user,
  isLoading,
  isError,
  error,
  isOwnProfile = false,
}: UserDetailWidgetProps) => {
  const { t } = useTranslation("users");
  const [showEdit, setShowEdit] = useState(false);
  const {
    updateMarketAddOrder,
    updateMarketExpenseProof,
    updateMarketCancelledHandoverQr,
  } = useUser();
  const { apiRequest } = useAppNotification();
  const isMarket = user?.role === "market" || user?.role === "marketing";

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
              {getErrorMessage(error) ?? t("loadDataError")}
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
  const handleToggleMarketAddOrder = async () => {
    if (!user || !isMarket) return;

    const nextValue = !user.add_order;

    await apiRequest({
      request: () =>
        updateMarketAddOrder.mutateAsync({
          id: user.id,
          add_order: nextValue,
        }),
      successMessage: nextValue
        ? t("marketAddOrderEnabled", { defaultValue: "Market uchun buyurtma qo'shish yoqildi" })
        : t("marketAddOrderDisabled", { defaultValue: "Market uchun buyurtma qo'shish o'chirildi" }),
      errorMessage: t("editUserError"),
    });
  };

  const handleToggleMarketProof = async (condition: ExpenseProofCondition) => {
    if (!user || !isMarket) return;

    const currentConditions = Array.isArray(user.expense_proof_conditions)
      ? user.expense_proof_conditions
      : [];
    const nextConditions = currentConditions.includes(condition)
      ? currentConditions.filter((item) => item !== condition)
      : [...currentConditions, condition];

    await apiRequest({
      request: () =>
        updateMarketExpenseProof.mutateAsync({
          id: user.id,
          expense_proof_conditions: nextConditions,
        }),
      successMessage: nextConditions.includes(condition)
        ? t("marketProofEnabled", { defaultValue: "Market uchun rasm/video isbot yoqildi" })
        : t("marketProofDisabled", { defaultValue: "Market uchun rasm/video isbot o'chirildi" }),
      errorMessage: t("editUserError"),
    });
  };

  const handleToggleMarketCancelledHandoverQr = async () => {
    if (!user || !isMarket) return;

    const nextValue = user.cancelled_handover_qr_required === false;

    await apiRequest({
      request: () =>
        updateMarketCancelledHandoverQr.mutateAsync({
          id: user.id,
          cancelled_handover_qr_required: nextValue,
        }),
      successMessage: nextValue
        ? t("cancelledHandoverQrEnabled", { defaultValue: "Bekor qilingan orderlarni topshirishda market QR talabi yoqildi" })
        : t("cancelledHandoverQrDisabled", { defaultValue: "Bekor qilingan orderlarni topshirishda market QR talabi o'chirildi" }),
      errorMessage: t("editUserError"),
    });
  };

  return (
    <>
      <div className="flex flex-col items-start gap-4 lg:flex-row lg:gap-5">
        {/* Chap — Profil Sidebar */}
        <div className="w-full shrink-0 lg:w-72">
          <UserDetailHeader user={user} />
        </div>

        {/* O'ng — Kontent */}
        <div className="w-full min-w-0 flex-1 space-y-4">
          <UserInfoCards
            user={user}
            onToggleMarketAddOrder={isMarket ? handleToggleMarketAddOrder : undefined}
            isMarketAddOrderPending={updateMarketAddOrder.isPending}
            onToggleMarketProof={isMarket ? handleToggleMarketProof : undefined}
            isMarketProofPending={updateMarketExpenseProof.isPending}
            onToggleMarketCancelledHandoverQr={isMarket ? handleToggleMarketCancelledHandoverQr : undefined}
            isMarketCancelledHandoverQrPending={updateMarketCancelledHandoverQr.isPending}
            headerAction={
              <button
                type="button"
                onClick={() => setShowEdit(true)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-main px-4 text-sm font-bold text-white shadow-md shadow-main/20 transition-all duration-200 hover:bg-main/90 active:scale-95"
                aria-label={t("edit")}
              >
                <Pencil size={15} strokeWidth={2.5} />
                <span>{t("edit")}</span>
              </button>
            }
          />
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
