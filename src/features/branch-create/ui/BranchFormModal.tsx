import { yupResolver } from "@hookform/resolvers/yup";
import { Form, Input, message } from "antd";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useEffect, useMemo } from "react";
import { Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUsers } from "../../../entities/user";
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
import {
  getBranchTypeOptions,
  getParentBranchOptions,
  useParentBranchOptions,
} from "../../branch/lib/branchFormOptions";

type RegionOption = {
  id: string;
  name: string;
  districts?: Array<{ id: string; name: string }>;
};

const useRegionOptions = () =>
  useQuery({
    queryKey: queryKeys.regions.all,
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.REGIONS.BASE);
      const raw = response.data as { data?: RegionOption[] } | RegionOption[];
      return Array.isArray(raw) ? raw : raw.data ?? [];
    },
  });

const BranchFormModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { t } = useTranslation("branches");
  const createBranch = useCreateBranch();
  const { data: regions = [] } = useRegionOptions();
  const { data: parentBranches, isLoading: parentBranchesLoading } = useParentBranchOptions(open);
  const { data: managers = [] } = useUsers({
    status: "active",
    role: ["admin", "operator"],
    page: 1,
    limit: 100,
    enabled: open,
  });
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
      type: "CITY",
      code: "",
      phone_number: "+998",
      region_id: "",
      district_id: "",
      address: "",
      status: "active",
      manager_id: "",
    },
  });

  const selectedType = useWatch({ control, name: "type" });
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
  const statusOptions = useMemo(
    () => [
      { value: "active", label: t("status.active") },
      { value: "inactive", label: t("status.inactive") },
    ],
    [t],
  );
  const branchTypeOptions = useMemo(() => getBranchTypeOptions(t), [t]);
  const parentOptions = useMemo(
    () => getParentBranchOptions(parentBranches?.data, t),
    [parentBranches?.data, t],
  );
  const managerOptions = useMemo(
    () =>
      managers.map((user) => ({
        value: String(user.id),
        label: `${user.fullName} (${user.username})`,
      })),
    [managers],
  );

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const payload: CreateBranchDto = {
        ...values,
        code: values.code.trim(),
        parent_id: values.type === "HQ" ? "" : values.parent_id,
      };
      await createBranch.mutateAsync(payload);
      message.success(t("messages.created"));
      onClose();
      reset();
    } catch (error) {
      applyBranchBackendErrors(error, setError);
    }
  });

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
                onChange={(value) => {
                  field.onChange(value);
                  if (value === "HQ") {
                    setValue("parent_id", "");
                  }
                }}
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
                disabled={selectedType === "HQ"}
                options={parentOptions}
                loading={parentBranchesLoading}
                placeholder={selectedType === "HQ" ? t("placeholders.parentForHq") : t("placeholders.parent")}
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
        <Form.Item label={<span className={popupLabelClassName}>{t("fields.status")}</span>} validateStatus={errors.status ? "error" : ""} help={errors.status?.message}>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <SearchableSelect
                label={t("fields.status")}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                options={statusOptions}
                placeholder={t("placeholders.status")}
                icon={Building2}
                hideLabel
              />
            )}
          />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>{t("fields.manager")}</span>} validateStatus={errors.manager_id ? "error" : ""} help={errors.manager_id?.message}>
          <Controller
            control={control}
            name="manager_id"
            render={({ field }) => (
              <SearchableSelect
                label={t("fields.manager")}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                options={managerOptions}
                placeholder={t("placeholders.manager")}
                icon={Building2}
                hideLabel
              />
            )}
          />
        </Form.Item>
      </Form>
    </FormPopup>
  );
};

export default BranchFormModal;
