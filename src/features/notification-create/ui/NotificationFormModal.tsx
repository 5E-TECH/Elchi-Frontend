import { yupResolver } from "@hookform/resolvers/yup";
import { Button, Form, Input, Modal, Select, message } from "antd";
import { Controller, useForm } from "react-hook-form";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useUsers } from "../../../entities/user";
import { notificationSchema } from "../model/schema";
import type { CreateNotificationDto } from "../model/types";
import { useCreateNotification } from "../api/useCreateNotification";

interface NotificationFormModalProps {
  open: boolean;
  onClose: () => void;
}

const NotificationFormModal = ({ open, onClose }: NotificationFormModalProps) => {
  const { t } = useTranslation("common");
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const createNotification = useCreateNotification();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateNotificationDto>({
    resolver: yupResolver(notificationSchema),
    defaultValues: {
      user_id: "",
      chat_id: "",
      status: "active",
    },
  });

  useEffect(() => {
    if (!open) {
      reset({
        user_id: "",
        chat_id: "",
        status: "active",
      });
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    await createNotification.mutateAsync(values);
    message.success(t("notificationCreated"));
    onClose();
    reset();
  });

  return (
    <Modal
      destroyOnHidden
      open={open}
      title={t("addNotification")}
      footer={null}
      onCancel={onClose}
    >
      <Form layout="vertical" onFinish={onSubmit}>
        <Form.Item
          label={t("notificationUser")}
          validateStatus={errors.user_id ? "error" : ""}
          help={errors.user_id?.message}
        >
          <Controller
            control={control}
            name="user_id"
            render={({ field }) => (
              <Select
                {...field}
                showSearch
                loading={usersLoading}
                placeholder={t("selectUser")}
                optionFilterProp="label"
                options={users.map((user) => ({
                  value: user.id,
                  label: `${user.fullName} (${user.username})`,
                }))}
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Chat ID"
          validateStatus={errors.chat_id ? "error" : ""}
          help={errors.chat_id?.message}
        >
          <Controller
            control={control}
            name="chat_id"
            render={({ field }) => <Input {...field} type="tel" placeholder={t("exampleChatId")} />}
          />
        </Form.Item>

        <Form.Item
          label={t("status")}
          validateStatus={errors.status ? "error" : ""}
          help={errors.status?.message}
        >
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select
                {...field}
                options={[
                  { value: "active", label: t("active") },
                  { value: "inactive", label: t("inactive") },
                ]}
              />
            )}
          />
        </Form.Item>

        <Button block type="primary" htmlType="submit" loading={createNotification.isPending}>
          {t("save")}
        </Button>
      </Form>
    </Modal>
  );
};

export default NotificationFormModal;
