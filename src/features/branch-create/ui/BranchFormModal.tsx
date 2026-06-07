import { yupResolver } from "@hookform/resolvers/yup";
import { Form, Input } from "antd";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useEffect, useMemo } from "react";
import { Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { branchSchema } from "../model/schema";
import type { CreateBranchDto } from "../model/types";
import { useCreateBranch } from "../api/useCreateBranch";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import FormPopup, { popupLabelClassName } from "../../../shared/ui/FormPopup";
import SearchableSelect from "../../../shared/ui/SearchableSelect";
import PhoneInput from "../../../shared/ui/PhoneInput";
import { GlobalSearchInput } from "../../search";
import { applyBranchBackendErrors } from "../../branch/lib/backendBranchErrors";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import {
  getParentBranchOptions,
  useParentBranchOptions,
} from "../../branch/lib/branchFormOptions";

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

const BranchFormModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { t } = useTranslation("branches");
  const { api: apiNotification } = useAppNotification();
  const createBranch = useCreateBranch();
  const { data: regions = [] } = useRegionOptions();
  const { data: parentBranches, isLoading: parentBranchesLoading } = useParentBranchOptions(open);
  const {
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors },
  } = useForm<CreateBranchDto>({
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
  const branchTypeOptions = useMemo(
    () => [
      { value: "PICKUP", label: t("branchTypes.pickup") },
      { value: "REGIONAL", label: t("branchTypes.regional") },
      { value: "HYBRID", label: t("branchTypes.hybrid") },
    ],
    [t],
  );
  const parentOptions = useMemo(
    () => getParentBranchOptions(parentBranches?.data, t),
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
        const normalizedType = String(values.type).toUpperCase() as CreateBranchDto["type"];
        const payload: Omit<CreateBranchDto, "manager_id"> = {
          ...values,
          type: normalizedType,
          code: values.code.trim(),
          parent_id: normalizedType === "PICKUP" ? "" : values.parent_id,
        };
        await createBranch.mutateAsync(payload);
        apiNotification.success({
          message: t("messages.created"),
          placement: "topRight",
        });
        onClose();
        reset();
      } catch (error) {
        applyBranchBackendErrors(error, setError);
        const backendMessage =
          (error as { response?: { data?: { message?: string | string[] } } })?.response?.data
            ?.message ?? t("errors.generic");
        apiNotification.error({
          message: Array.isArray(backendMessage) ? backendMessage.join(", ") : backendMessage,
          placement: "topRight",
        });
      }
    },
    (invalidErrors) => {
      const firstError = Object.values(invalidErrors)[0];
      apiNotification.error({
        message: firstError?.message || t("validation.completeForm"),
        placement: "topRight",
      });
    },
  );

  return (
    <FormPopup
      isOpen={open}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
      title={t("create.title")}
      description={t("create.description")}
      icon={<Building2 size={22} />}
      submitLabel={t("actions.save")}
      isLoading={createBranch.isPending}
      theme="branch"
      widthClassName="max-w-xl"
    >
      <Form layout="vertical" component={false}>
        <Form.Item label={<span className={popupLabelClassName}>{t("fields.name")}</span>} validateStatus={errors.name ? "error" : ""} help={errors.name?.message}>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <GlobalSearchInput
                name={field.name}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={t("placeholders.name")}
                icon={Building2}
                error={Boolean(errors.name)}
                syncWithRedux={false}
                syncWithUrl={false}
              />
            )}
          />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>{t("fields.type")}</span>} validateStatus={errors.type ? "error" : ""} help={errors.type?.message}>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <SearchableSelect
                label={t("fields.type")}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                options={branchTypeOptions}
                placeholder={t("placeholders.type")}
                icon={Building2}
                hideLabel
              />
            )}
          />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>{t("fields.parent")}</span>} validateStatus={errors.parent_id ? "error" : ""} help={errors.parent_id?.message}>
          <Controller
            control={control}
            name="parent_id"
            render={({ field }) => (
              <SearchableSelect
                label={t("fields.parent")}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                options={parentOptions}
                loading={parentBranchesLoading}
                placeholder={t("placeholders.parent")}
                icon={Building2}
                hideLabel
                surface="search"
              />
            )}
          />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>{t("fields.code")}</span>} validateStatus={errors.code ? "error" : ""} help={errors.code?.message}>
          <Controller
            control={control}
            name="code"
            render={({ field }) => (
              <GlobalSearchInput
                name={field.name}
                value={field.value}
                onValueChange={(value) => field.onChange(value.toUpperCase())}
                onBlur={field.onBlur}
                placeholder={t("placeholders.code")}
                icon={Building2}
                error={Boolean(errors.code)}
                syncWithRedux={false}
                syncWithUrl={false}
              />
            )}
          />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>{t("fields.phone")}</span>} validateStatus={errors.phone_number ? "error" : ""} help={errors.phone_number?.message}>
          <Controller
            control={control}
            name="phone_number"
            render={({ field }) => (
              <PhoneInput
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={t("placeholders.phone")}
                error={Boolean(errors.phone_number)}
              />
            )}
          />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>{t("fields.region")}</span>} validateStatus={errors.region_id ? "error" : ""} help={errors.region_id?.message}>
          <Controller
            control={control}
            name="region_id"
            render={({ field }) => (
              <SearchableSelect
                label={t("fields.region")}
                name={field.name}
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  setValue("district_id", "");
                }}
                options={regionOptions}
                placeholder={t("placeholders.region")}
                icon={Building2}
                hideLabel
              />
            )}
          />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>{t("fields.district")}</span>} validateStatus={errors.district_id ? "error" : ""} help={errors.district_id?.message}>
          <Controller
            control={control}
            name="district_id"
            render={({ field }) => (
              <SearchableSelect
                label={t("fields.district")}
                name={field.name}
                value={field.value}
                disabled={!selectedRegionId}
                onChange={field.onChange}
                options={districtOptions}
                placeholder={t("placeholders.district")}
                icon={Building2}
                hideLabel
              />
            )}
          />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>{t("fields.address")}</span>} validateStatus={errors.address ? "error" : ""} help={errors.address?.message}>
          <Controller
            control={control}
            name="address"
            render={({ field }) => (
              <Input.TextArea
                {...field}
                rows={3}
                placeholder={t("placeholders.address")}
              />
            )}
          />
        </Form.Item>
      </Form>
    </FormPopup>
  );
};

export default BranchFormModal;
