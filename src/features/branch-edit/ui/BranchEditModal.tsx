import { yupResolver } from "@hookform/resolvers/yup";
import { Form, Input, message } from "antd";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Building2, SquarePen } from "lucide-react";
import type { Branch } from "../../../entities/branch";
import FormPopup, { popupLabelClassName } from "../../../shared/ui/FormPopup";
import { branchEditSchema } from "../model/schema";
import type { UpdateBranchDto } from "../model/types";
import { useUpdateBranch } from "../api/useUpdateBranch";
import SearchableSelect from "../../../shared/ui/SearchableSelect";
import PhoneInput from "../../../shared/ui/PhoneInput";
import { GlobalSearchInput } from "../../search";
import { applyBranchBackendErrors } from "../../branch/lib/backendBranchErrors";
import {
  getBranchTypeOptions,
  getParentBranchOptions,
  useParentBranchOptions,
} from "../../branch/lib/branchFormOptions";

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
  const {
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors },
  } = useForm<UpdateBranchDto>({
    resolver: yupResolver(branchEditSchema),
    defaultValues: {
      name: "",
      parent_id: "",
      type: "CITY",
      code: "",
      phone_number: "+998",
      address: "",
    },
  });

  const selectedType = useWatch({ control, name: "type" });
  const branchTypeOptions = useMemo(() => getBranchTypeOptions(t), [t]);
  const parentOptions = useMemo(
    () => getParentBranchOptions(parentBranches?.data, t, initialData?.id),
    [initialData?.id, parentBranches?.data, t],
  );

  useEffect(() => {
    if (open && initialData) {
      reset({
        name: initialData.name,
        parent_id: initialData.parent_id ?? initialData.parent?.id ?? "",
        type: initialData.type ?? "CITY",
        code: initialData.code ?? "",
        phone_number: initialData.phone_number ?? "+998",
        address: initialData.address,
      });
    }
  }, [initialData, open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!initialData) return;
    try {
      const payload: UpdateBranchDto = {
        ...values,
        code: values.code.trim(),
        parent_id: values.type === "HQ" ? "" : values.parent_id,
      };
      await updateBranch.mutateAsync({ id: initialData.id, payload });
      message.success(t("messages.updated"));
      onClose();
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
      title={t("edit.title")}
      description={t("edit.description")}
      icon={<SquarePen size={22} />}
      submitLabel={t("actions.update")}
      isLoading={updateBranch.isPending}
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

export default BranchEditModal;
