import { yupResolver } from "@hookform/resolvers/yup";
import { Form, Select, message } from "antd";
import { Controller, useForm } from "react-hook-form";
import { useEffect } from "react";
import { UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUsers } from "../../../entities/user";
import FormPopup, { popupLabelClassName } from "../../../shared/ui/FormPopup";
import { addEmployeeSchema } from "../model/schema";
import { useAddEmployee, type AddEmployeeDto } from "../api/useAddEmployee";
import { getActionErrorMessage } from "../../../shared/lib/actionError";

/**
 * Filialga faqat shu rollar biriktiriladi — backend `resolveBranchRoleFromUserRole`
 * boshqasini 400 bilan rad etadi (fix3 CODE-21). Ilgari ro'yxat admin/operator
 * foydalanuvchilarni ko'rsatardi, ya'ni har qanday tanlov rad etilardi.
 */
const BRANCH_ASSIGNABLE_ROLES = ["manager", "registrator", "courier"] as const;

const AddEmployeeModal = ({
  branchId,
  open,
  onClose,
}: {
  branchId: string;
  open: boolean;
  onClose: () => void;
}) => {
  const { t } = useTranslation("branches");
  const { data: users = [] } = useUsers({
    status: "active",
    role: [...BRANCH_ASSIGNABLE_ROLES],
    page: 1,
    limit: 100,
    enabled: open,
  });
  const addEmployee = useAddEmployee(branchId);
  const { control, handleSubmit, reset, formState: { errors } } = useForm<AddEmployeeDto>({
    resolver: yupResolver(addEmployeeSchema),
    defaultValues: { user_id: "" },
  });

  useEffect(() => {
    if (!open) reset({ user_id: "" });
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await addEmployee.mutateAsync(values);
    } catch (error) {
      // Oyna ochiq qoladi — sabab ko'rinadi (masalan "boshqa filialga biriktirilgan").
      const description = getActionErrorMessage(error, t("employee.addError"));
      if (description) message.error(description);
      return;
    }
    message.success(t("employee.added"));
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
      title={t("employee.add")}
      description={t("employee.addDescription")}
      icon={<UserPlus size={22} />}
      submitLabel={t("employee.addAction")}
      isLoading={addEmployee.isPending}
      theme="branch"
    >
      <Form layout="vertical" component={false}>
        <Form.Item label={<span className={popupLabelClassName}>{t("employee.user")}</span>} validateStatus={errors.user_id ? "error" : ""} help={errors.user_id?.message}>
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
                placeholder={t("employee.selectUser")}
              />
            )}
          />
        </Form.Item>
      </Form>
    </FormPopup>
  );
};

export default AddEmployeeModal;
