import { DeleteOutlined } from "@ant-design/icons";
import { ConfirmButton } from "../../../shared/ui/ConfirmButton";
import { useRemoveEmployee } from "../api/useRemoveEmployee";
import { useTranslation } from "react-i18next";
import { getActionErrorMessage } from "../../../shared/lib/actionError";
import { notify } from "../../../shared/lib/notify";

const RemoveEmployeeButton = ({
  branchId,
  userId,
  className,
}: {
  branchId: string;
  userId: string;
  className?: string;
}) => {
  const { t } = useTranslation("branches");
  const removeEmployee = useRemoveEmployee(branchId);

  return (
    <ConfirmButton
      size="small"
      icon={<DeleteOutlined />}
      className={className}
      aria-label={t("employee.remove")}
      title={t("employee.remove")}
      confirmTitle={t("employee.removeConfirm")}
      popupTheme="branch"
      onConfirm={async () => {
        try {
          await removeEmployee.mutateAsync(userId);
          notify.success(t("employee.removed"));
        } catch (error) {
          // fix3 CODE-21: avval xato jimgina yutilardi (masalan backend
          // "Kuryerni filialdan chiqarib bo'lmaydi: qo'lida pul bor").
          const description = getActionErrorMessage(error, t("employee.removeError"));
          if (description) notify.error(description);
        }
      }}
      loading={removeEmployee.isPending}
    />
  );
};

export default RemoveEmployeeButton;
