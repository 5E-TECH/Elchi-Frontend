import { useCallback } from "react";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Branch } from "../../../entities/branch";
import { getApiErrorMessage } from "../../../shared/lib/apiError";
import { notify } from "../../../shared/lib/notify";
import { useConfirm } from "../../../shared/ui/primitives";
import { useDeleteBranch } from "../api/useDeleteBranch";

/** Rad etish sababi (5QHWbBCA): 4xx — backend matni (HQ'ga qarz, kassa qoldig'i), 503 — «keyinroq urinib ko'ring». */
const deleteErrorDescription = (error: unknown, retryLater: string) => {
  const status = (error as { response?: { status?: unknown } } | null)?.response?.status;
  if (status === 503) return retryLater;
  if (typeof status === "number" && status >= 400 && status < 500) return getApiErrorMessage(error) || undefined;
  return undefined;
};

/**
 * FILIALNI O'CHIRISH — tasdiq bilan (maket `superadmin-branches-list-table`: «Filialni o'chirmoqchimisiz?» /
 * «{nom} filiallar ro'yxatidan o'chiriladi.» / «O'chirish»; maketdagi qator popover'i o'rniga v2 `useConfirm`,
 * Popconfirm taqiqlangan). `DELETE /branches/:id` tasdiq oynasi ichida yuradi (tugma yuklanishda), keyin
 * xabar: «Filial o'chirildi» yoki «Filialni o'chirishda xatolik yuz berdi» (eski `DeleteBranchButton` bilan bir xil).
 * Rad etilsa — xabar izohida sabab (`deleteErrorDescription`).
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
          } catch (error) {
            notify.error(t("delete.error"), { description: deleteErrorDescription(error, t("delete.retryLater")) });
          }
        },
      }),
    [confirm, mutateAsync, t],
  );
};
