import { message } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { ConfirmButton } from "../../../shared/ui/ConfirmButton";
import { useRemoveEmployee } from "../api/useRemoveEmployee";

const RemoveEmployeeButton = ({
  branchId,
  employeeId,
  className,
}: {
  branchId: string;
  employeeId: string;
  className?: string;
}) => {
  const removeEmployee = useRemoveEmployee(branchId);

  return (
    <ConfirmButton
      size="small"
      icon={<DeleteOutlined />}
      className={className}
      confirmTitle="Xodimni filialdan olib tashlamoqchimisiz?"
      onConfirm={async () => {
        await removeEmployee.mutateAsync(employeeId);
        message.success("Xodim olib tashlandi");
      }}
      loading={removeEmployee.isPending}
    >
      Olib tashlash
    </ConfirmButton>
  );
};

export default RemoveEmployeeButton;
