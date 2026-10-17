// dizayn-v2: (maket yo'q) superadmin-branches-create-dialog
import { yupResolver } from "@hookform/resolvers/yup";
import { useForm } from "react-hook-form";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import type { Branch } from "../../../entities/branch";
import { notify } from "../../../shared/lib/notify";
import { branchEditSchema, type BranchEditSchemaContext } from "../model/schema";
import type { UpdateBranchDto, UpdateBranchPayload } from "../model/types";
import { useUpdateBranch } from "../api/useUpdateBranch";
import { applyBranchBackendErrors } from "../../branch/lib/backendBranchErrors";
import {
  getBranchTypeOptions,
  filterParentCandidates,
  getParentBranchOptions,
  useParentBranchOptions,
} from "../../branch/lib/branchFormOptions";
import { BranchFormDialog } from "../../branch/ui/BranchFormDialog";

/**
 * «FILIALNI TAHRIRLASH» oynasi. Maket yo'q — eng yaqini `superadmin-branches-create-dialog` (o'sha
 * `BranchFormDialog`, viloyat/tumansiz: `PATCH /branches/:id` ularni olmaydi).
 *
 * Xulq o'zgarmagan: `branchEditSchema` (`isHqBranch` konteksti), HQ — tur qulflangan va yuqori filial yo'q
 * (`parent_id` umuman yuborilmaydi), qolganlar (PICKUP ham) — tanlangan yuqori filial bilan; backend rad etishi
 * maydonga yoki xabar bilan (`applyBranchBackendErrors(..., { notification: notify })`).
 */
const BranchEditModal = ({
  open,
  initialData,
  onClose,
}: {
  open: boolean;
  initialData: Branch | null;
  onClose: () => void;
}) => {
  const { t } = useTranslation("branches");
  const { data: parentBranches, isLoading: parentBranchesLoading } = useParentBranchOptions(open);
  const updateBranch = useUpdateBranch();
  // HQ (bosh ofis): tur qulflangan (backend o'zgartirishni rad etadi), yuqori filial yo'q.
  const isHqBranch = initialData?.type === "HQ";
  const { control, handleSubmit, reset, setError } = useForm<UpdateBranchDto, BranchEditSchemaContext>({
    resolver: yupResolver(branchEditSchema),
    context: { isHqBranch },
    defaultValues: {
      name: "",
      parent_id: "",
      type: "PICKUP",
      code: "",
      phone_number: "+998",
      address: "",
    },
  });

  // Ilgari PICKUP uchun ham o'chiq edi va saqlashda `parent_id: ""` ketardi —
  // backend esa uni rad etadi, ya'ni PICKUP'ni tahrirlab bo'lmasdi.
  const isParentDisabled = isHqBranch;
  const branchTypeOptions = useMemo(() => getBranchTypeOptions(t), [t]);
  const parentOptions = useMemo(
    () => getParentBranchOptions(filterParentCandidates(parentBranches?.data), t, initialData?.id),
    [initialData?.id, parentBranches?.data, t],
  );

  useEffect(() => {
    if (open && initialData) {
      reset({
        name: initialData.name,
        parent_id:
          initialData.type === "HQ" ? "" : (initialData.parent_id ?? initialData.parent?.id ?? ""),
        type: initialData.type ?? "PICKUP",
        code: initialData.code ?? "",
        phone_number: initialData.phone_number ?? "+998",
        address: initialData.address,
      });
    }
  }, [initialData, open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!initialData) return;
    try {
      const code = values.code.trim();
      // HQ: tur doim HQ, `parent_id` yuborilmaydi (yuqori filial o'zgarmaydi).
      const payload: UpdateBranchPayload = isHqBranch
        ? {
            name: values.name,
            type: "HQ",
            code,
            phone_number: values.phone_number,
            address: values.address,
          }
        : {
            ...values,
            code,
            parent_id: values.parent_id,
          };
      await updateBranch.mutateAsync({ id: initialData.id, payload });
      notify.success(t("messages.updated"));
      onClose();
    } catch (error) {
      applyBranchBackendErrors(error, setError, { notification: notify });
    }
  });

  return (
    <BranchFormDialog
      open={open}
      onClose={onClose}
      title={t("edit.title")}
      description={t("edit.description")}
      icon={Pencil}
      control={control}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
      submitting={updateBranch.isPending}
      submitLabel={t("actions.save")}
      typeOptions={branchTypeOptions}
      typeLocked={isHqBranch}
      parentOptions={parentOptions}
      parentLoading={parentBranchesLoading}
      parentDisabled={isParentDisabled}
      parentPlaceholder={isParentDisabled ? t("placeholders.parentForHq") : t("placeholders.parent")}
    />
  );
};

export default BranchEditModal;
