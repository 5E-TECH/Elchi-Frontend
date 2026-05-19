import { DeleteOutlined } from "@ant-design/icons";
import { message } from "antd";
import { ConfirmButton } from "../../../shared/ui/ConfirmButton";
import { useDeleteBranch } from "../api/useDeleteBranch";
import { useTranslation } from "react-i18next";

const DeleteBranchButton = ({ id, className }: { id: string; className?: string }) => {
  const { t } = useTranslation("branches");
  const deleteBranch = useDeleteBranch();

  return (
    <ConfirmButton
      size="small"
      icon={<DeleteOutlined />}
      className={className}
      aria-label={t("actions.delete")}
      title={t("actions.delete")}
      confirmTitle={t("delete.confirm")}
      popupTheme="branch"
      onConfirm={async () => {
        await deleteBranch.mutateAsync(id);
        message.success(t("delete.success"));
      }}
      loading={deleteBranch.isPending}
    />
  );
};

export default DeleteBranchButton;
