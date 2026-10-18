import { useCallback } from "react";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Branch } from "../../../entities/branch";
import { notify } from "../../../shared/lib/notify";
import { useConfirm } from "../../../shared/ui/primitives";
import { useDeleteBranch } from "../api/useDeleteBranch";

/**
 * FILIALNI O'CHIRISH — tasdiq bilan (maket `superadmin-branches-list-table`: «Filialni o'chirmoqchimisiz?» /
 * «{nom} filiallar ro'yxatidan o'chiriladi.» / «O'chirish»; maketdagi qator popover'i o'rniga v2 `useConfirm`,
 * Popconfirm taqiqlangan). `DELETE /branches/:id` tasdiq oynasi ichida yuradi (tugma yuklanishda), keyin
 * xabar: «Filial o'chirildi» yoki «Filialni o'chirishda xatolik yuz berdi» (eski `DeleteBranchButton` bilan bir xil).
 *
 *   const deleteBranch = useDeleteBranchAction();
 *   <button onClick={() => void deleteBranch(branch)}>…</button>
 */
export const useDeleteBranchAction = () => {
  const { t } = useTranslation("branches");
  const confirm = useConfirm();
  const { mutateAsync } = useDeleteBranch();

  return useCallback(
    (branch: Pick<Branch, "id" | "name">) =>
      confirm({
        tone: "danger",
        icon: Trash2,
        title: t("delete.confirm"),
        description: t("v2.delete.description", { name: branch.name }),
        confirmLabel: t("actions.delete"),
        confirmIcon: Trash2,
        onConfirm: async () => {
          try {
            await mutateAsync(branch.id);
            notify.success(t("delete.success"));
          } catch {
            notify.error(t("delete.error"));
          }
        },
      }),
    [confirm, mutateAsync, t],
  );
};
