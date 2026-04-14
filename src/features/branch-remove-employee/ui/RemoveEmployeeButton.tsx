import { message } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { ConfirmButton } from "../../../shared/ui/ConfirmButton";
import { useRemoveEmployee } from "../api/useRemoveEmployee";

const RemoveEmployeeButton = ({
  branchId,
  userId,
  className,
}: {
  branchId: string;
  userId: string;
  className?: string;
}) => {
  const removeEmployee = useRemoveEmployee(branchId);

  return (
    <ConfirmButton
      size="small"
      icon={<DeleteOutlined />}
      className={className}
      confirmTitle="Xodimni filialdan olib tashlamoqchimisiz?"
      popupTheme="branch"
      onConfirm={async () => {
        await removeEmployee.mutateAsync(userId);
        message.success("Xodim olib tashlandi");
      }}
      loading={removeEmployee.isPending}
    >
      Olib tashlash
    </ConfirmButton>
  );
};

export default RemoveEmployeeButton;
