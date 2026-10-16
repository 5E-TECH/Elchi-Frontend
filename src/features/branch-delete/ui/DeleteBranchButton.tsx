import { DeleteOutlined } from "@ant-design/icons";
import { ConfirmButton } from "../../../shared/ui/ConfirmButton";
import { useDeleteBranch } from "../api/useDeleteBranch";
import { useTranslation } from "react-i18next";
import { notify } from "../../../shared/lib/notify";

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
        try {
          await deleteBranch.mutateAsync(id);
          notify.success(t("delete.success"));
        } catch {
          notify.error(t("delete.error"));
        }
      }}
      loading={deleteBranch.isPending}
    />
  );
};

export default DeleteBranchButton;
