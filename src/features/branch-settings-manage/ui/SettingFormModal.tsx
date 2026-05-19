import { yupResolver } from "@hookform/resolvers/yup";
import { Form, Input, message } from "antd";
import { Controller, useForm } from "react-hook-form";
import { useEffect } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BranchSetting } from "../../../entities/branch";
import FormPopup, { popupLabelClassName } from "../../../shared/ui/FormPopup";
import { branchSettingSchema } from "../model/schema";
import { useAddSetting } from "../api/useAddSetting";
import { useUpdateSetting } from "../api/useUpdateSetting";
import type { BranchSettingDto } from "../api/useAddSetting";

const SettingFormModal = ({
  branchId,
  open,
  initialData,
  onClose,
}: {
  branchId: string;
  open: boolean;
  initialData: BranchSetting | null;
  onClose: () => void;
}) => {
  const { t } = useTranslation("branches");
  const addSetting = useAddSetting(branchId);
  const updateSetting = useUpdateSetting(branchId);
  const { control, handleSubmit, reset, formState: { errors } } = useForm<BranchSettingDto>({
    resolver: yupResolver(branchSettingSchema),
    defaultValues: { key: "", value: "" },
  });

  useEffect(() => {
    if (open) {
      reset({
        key: initialData?.key ?? "",
        value: initialData?.value ?? "",
      });
    }
  }, [initialData, open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (initialData) {
      await updateSetting.mutateAsync({ id: initialData.id, payload: values });
      message.success(t("settings.updated"));
    } else {
      await addSetting.mutateAsync(values);
      message.success(t("settings.created"));
    }
    onClose();
  });

  return (
    <FormPopup
      isOpen={open}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
      title={initialData ? t("settings.edit") : t("settings.add")}
      description={t("settings.formDescription")}
      icon={<SlidersHorizontal size={22} />}
      submitLabel={initialData ? t("actions.update") : t("actions.save")}
      isLoading={addSetting.isPending || updateSetting.isPending}
      widthClassName="max-w-xl"
      theme="branch"
    >
      <Form layout="vertical" component={false}>
        <Form.Item label={<span className={popupLabelClassName}>{t("settings.key")}</span>} validateStatus={errors.key ? "error" : ""} help={errors.key?.message}>
          <Controller control={control} name="key" render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>{t("settings.value")}</span>} validateStatus={errors.value ? "error" : ""} help={errors.value?.message}>
          <Controller control={control} name="value" render={({ field }) => <Input {...field} />} />
        </Form.Item>
      </Form>
    </FormPopup>
  );
};

export default SettingFormModal;
