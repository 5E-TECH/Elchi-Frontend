// dizayn-v2: superadmin-branches-create-dialog
import { yupResolver } from "@hookform/resolvers/yup";
import { useForm, useWatch } from "react-hook-form";
import { useEffect, useMemo } from "react";
import { Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";
import { notify } from "../../../shared/lib/notify";
import { branchSchema } from "../model/schema";
import type { CreateBranchDto } from "../model/types";
import { buildCreateBranchPayload } from "../model/payload";
import { useCreateBranch } from "../api/useCreateBranch";
import { applyBranchBackendErrors } from "../../branch/lib/backendBranchErrors";
import {
  filterParentCandidates,
  getBranchTypeOptions,
  getParentBranchOptions,
  useParentBranchOptions,
} from "../../branch/lib/branchFormOptions";
import { BranchFormDialog } from "../../branch/ui/BranchFormDialog";

type RegionOption = {
  id: string;
  name: string;
  districts?: Array<{ id: string; name: string }>;
};

const extractRegionOptions = (payload: unknown): RegionOption[] => {
  const response = payload as {
    data?: RegionOption[] | { data?: RegionOption[]; items?: RegionOption[] };
    items?: RegionOption[];
  };

  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray((response?.data as { data?: RegionOption[] } | undefined)?.data)) {
    return (response.data as { data: RegionOption[] }).data;
  }
  if (Array.isArray((response?.data as { items?: RegionOption[] } | undefined)?.items)) {
    return (response.data as { items: RegionOption[] }).items;
  }
  if (Array.isArray(response?.items)) return response.items;

  return [];
};

const useRegionOptions = () =>
  useQuery({
    queryKey: queryKeys.regions.all,
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.REGIONS.BASE);
      return extractRegionOptions(response.data);
    },
  });

/**
 * «YANGI FILIAL» oynasi (maket `superadmin-branches-create-dialog`) — ko'rinish `BranchFormDialog` (v2).
 * Xulq o'zgarmagan: `branchSchema` (yup), `buildCreateBranchPayload` (PICKUP ham tanlangan yuqori filial
 * bilan), `POST /branches`, backend xatolari maydonga (`applyBranchBackendErrors`) + xabar, noto'g'ri
 * formada birinchi xato xabari. Tur: HQ o'chiq (yagona bosh ofis), sukut — «Viloyat».
 */
const BranchFormModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { t } = useTranslation("branches");
  const createBranch = useCreateBranch();
  const { data: regions = [], isLoading: regionsLoading } = useRegionOptions();
  const { data: parentBranches, isLoading: parentBranchesLoading } = useParentBranchOptions(open);
  const { control, handleSubmit, reset, setError, setValue } = useForm<CreateBranchDto>({
    resolver: yupResolver(branchSchema),
    defaultValues: {
      name: "",
      parent_id: "",
      type: "REGIONAL",
      code: "",
      phone_number: "+998",
      region_id: "",
      district_id: "",
      address: "",
    },
  });

  const selectedRegionId = useWatch({ control, name: "region_id" });
  const districts = useMemo(
    () => regions.find((region) => String(region.id) === selectedRegionId)?.districts ?? [],
    [regions, selectedRegionId],
  );
  const regionOptions = useMemo(
    () => regions.map((region) => ({ value: String(region.id), label: region.name })),
    [regions],
  );
  const districtOptions = useMemo(
    () => districts.map((district) => ({ value: String(district.id), label: district.name })),
    [districts],
  );
  // HQ ro'yxatda, lekin o'chiq (sxema ham faqat PICKUP · REGIONAL · HYBRID ni qabul qiladi).
  const branchTypeOptions = useMemo(() => getBranchTypeOptions(t), [t]);
  const parentOptions = useMemo(
    () => getParentBranchOptions(filterParentCandidates(parentBranches?.data), t),
    [parentBranches?.data, t],
  );

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(
    async (values) => {
      try {
        await createBranch.mutateAsync(buildCreateBranchPayload(values));
        notify.success(t("messages.created"));
        onClose();
        reset();
      } catch (error) {
        applyBranchBackendErrors(error, setError);
        const backendMessage =
          (error as { response?: { data?: { message?: string | string[] } } })?.response?.data
            ?.message ?? t("errors.generic");
        notify.error(Array.isArray(backendMessage) ? backendMessage.join(", ") : backendMessage);
      }
    },
    (invalidErrors) => {
      const firstError = Object.values(invalidErrors)[0];
      notify.error(firstError?.message || t("validation.completeForm"));
    },
  );

  return (
    <BranchFormDialog
      open={open}
      onClose={onClose}
      title={t("create.title")}
      description={t("create.description")}
      icon={Building2}
      control={control}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
      submitting={createBranch.isPending}
      submitLabel={t("actions.save")}
      typeOptions={branchTypeOptions}
      parentOptions={parentOptions}
      parentLoading={parentBranchesLoading}
      parentPlaceholder={t("placeholders.parent")}
      location={{
        regionOptions,
        districtOptions,
        regionsLoading,
        onRegionChange: () => setValue("district_id", ""),
        districtDisabled: !selectedRegionId,
      }}
    />
  );
};

export default BranchFormModal;
