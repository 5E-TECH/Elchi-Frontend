// dizayn-v2: superadmin-branches-detail
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getActionErrorMessage } from "../../../shared/lib/actionError";
import { notify } from "../../../shared/lib/notify";
import { Button, useConfirm } from "../../../shared/ui/primitives";
import { useRemoveEmployee } from "../api/useRemoveEmployee";

/**
 * «OLIB TASHLASH» — filial xodimini filialdan chiqarish (maket `superadmin-branches-detail`: `danger-soft` sm,
 * telefonda to'liq en; nomi «{ism}ni filialdan olib tashlash»). Har doim tasdiq oynasi orqali («{ism}ni
 * filialdan olib tashlash?» / «Olib tashlash»); `DELETE /branches/:id/users/:userId` oyna ichida yuradi.
 * Rad etilsa sabab xabarda (fix3 CODE-21: avval xato jimgina yutilardi — masalan backend
 * "Kuryerni filialdan chiqarib bo'lmaydi: qo'lida pul bor").
 */
const RemoveEmployeeButton = ({
  branchId,
  userId,
  userName,
  fullWidth = false,
}: {
  branchId: string;
  userId: string;
  /** Xodim ismi — tugma nomi va tasdiq sarlavhasi uchun. */
  userName?: string;
  /** Telefon kartasida to'liq en (maket `el-btn-block`). */
  fullWidth?: boolean;
}) => {
  const { t } = useTranslation("branches");
  const confirm = useConfirm();
  const removeEmployee = useRemoveEmployee(branchId);
  const name = userName?.trim() || t("fallback.employee");

  const handleClick = () =>
    void confirm({
      tone: "danger",
      icon: X,
      title: t("v2.employees.removeTitle", { name }),
      confirmLabel: t("employee.remove"),
      confirmIcon: X,
      onConfirm: async () => {
        try {
          await removeEmployee.mutateAsync(userId);
          notify.success(t("employee.removed"));
        } catch (error) {
          const description = getActionErrorMessage(error, t("employee.removeError"));
          if (description) notify.error(description);
        }
      },
    });

  return (
    <Button
      variant="danger-soft"
      size="sm"
      leftIcon={X}
      fullWidth={fullWidth}
      loading={removeEmployee.isPending}
      onClick={handleClick}
      aria-label={t("v2.employees.removeLabel", { name })}
    >
      {t("employee.remove")}
    </Button>
  );
};

export default RemoveEmployeeButton;
