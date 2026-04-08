import { DeleteOutlined } from "@ant-design/icons";
import { message } from "antd";
import { ConfirmButton } from "../../../shared/ui/ConfirmButton";
import { useDeleteBranch } from "../api/useDeleteBranch";

const DeleteBranchButton = ({ id, className }: { id: string; className?: string }) => {
  const deleteBranch = useDeleteBranch();

  return (
    <ConfirmButton
      size="small"
      icon={<DeleteOutlined />}
      className={className}
      confirmTitle="Filialni o'chirmoqchimisiz?"
      onConfirm={async () => {
        await deleteBranch.mutateAsync(id);
        message.success("Filial o'chirildi");
      }}
      loading={deleteBranch.isPending}
    >
      O'chirish
    </ConfirmButton>
  );
};

export default DeleteBranchButton;
