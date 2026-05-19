import { message } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { ConfirmButton } from "../../../shared/ui/ConfirmButton";
import { useRemoveEmployee } from "../api/useRemoveEmployee";
import { useTranslation } from "react-i18next";

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
        await removeEmployee.mutateAsync(userId);
        message.success(t("employee.removed"));
      }}
      loading={removeEmployee.isPending}
    />
  );
};

export default RemoveEmployeeButton;
