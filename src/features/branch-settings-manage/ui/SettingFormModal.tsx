import { yupResolver } from "@hookform/resolvers/yup";
import { Form, Input, message } from "antd";
import { Controller, useForm } from "react-hook-form";
import { useEffect } from "react";
import { SlidersHorizontal } from "lucide-react";
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
      message.success("Sozlama yangilandi");
    } else {
      await addSetting.mutateAsync(values);
      message.success("Sozlama qo'shildi");
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
      title={initialData ? "Sozlamani tahrirlash" : "Sozlama qo'shish"}
      description="Filialga tegishli kalit va qiymatni kiriting."
      icon={<SlidersHorizontal size={22} />}
      submitLabel={initialData ? "Yangilash" : "Saqlash"}
      isLoading={addSetting.isPending || updateSetting.isPending}
      widthClassName="max-w-xl"
      theme="branch"
    >
      <Form layout="vertical" component={false}>
        <Form.Item label={<span className={popupLabelClassName}>Kalit</span>} validateStatus={errors.key ? "error" : ""} help={errors.key?.message}>
          <Controller control={control} name="key" render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>Qiymat</span>} validateStatus={errors.value ? "error" : ""} help={errors.value?.message}>
          <Controller control={control} name="value" render={({ field }) => <Input {...field} />} />
        </Form.Item>
      </Form>
    </FormPopup>
  );
};

export default SettingFormModal;
