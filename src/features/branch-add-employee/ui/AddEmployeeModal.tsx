import { yupResolver } from "@hookform/resolvers/yup";
import { Form, Input, Select, message } from "antd";
import { Controller, useForm } from "react-hook-form";
import { useEffect } from "react";
import { UserPlus } from "lucide-react";
import { useUsers } from "../../../entities/user";
import FormPopup, { popupLabelClassName } from "../../../shared/ui/FormPopup";
import { addEmployeeSchema } from "../model/schema";
import { useAddEmployee, type AddEmployeeDto } from "../api/useAddEmployee";

const AddEmployeeModal = ({
  branchId,
  open,
  onClose,
}: {
  branchId: string;
  open: boolean;
  onClose: () => void;
}) => {
  const { data: users = [] } = useUsers({
    status: "active",
    role: ["admin", "operator"],
    page: 1,
    limit: 100,
    enabled: open,
  });
  const addEmployee = useAddEmployee(branchId);
  const { control, handleSubmit, reset, formState: { errors } } = useForm<AddEmployeeDto>({
    resolver: yupResolver(addEmployeeSchema),
    defaultValues: { user_id: "", position: "" },
  });

  useEffect(() => {
    if (!open) reset({ user_id: "", position: "" });
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    await addEmployee.mutateAsync(values);
    message.success("Xodim filialga qo'shildi");
    onClose();
    reset();
  });

  return (
    <FormPopup
      isOpen={open}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
      title="Xodim qo'shish"
      description="Filialga foydalanuvchini biriktirib, lavozimini belgilang."
      icon={<UserPlus size={22} />}
      submitLabel="Qo'shish"
      isLoading={addEmployee.isPending}
    >
      <Form layout="vertical" component={false}>
        <Form.Item label={<span className={popupLabelClassName}>Foydalanuvchi</span>} validateStatus={errors.user_id ? "error" : ""} help={errors.user_id?.message}>
          <Controller
            control={control}
            name="user_id"
            render={({ field }) => (
              <Select
                {...field}
                showSearch
                optionFilterProp="label"
                options={users.map((user) => ({
                  value: user.id,
                  label: `${user.fullName} (${user.username})`,
                }))}
              />
            )}
          />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>Lavozim</span>} validateStatus={errors.position ? "error" : ""} help={errors.position?.message}>
          <Controller control={control} name="position" render={({ field }) => <Input {...field} />} />
        </Form.Item>
      </Form>
    </FormPopup>
  );
};

export default AddEmployeeModal;
