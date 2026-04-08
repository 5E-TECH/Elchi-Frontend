import { yupResolver } from "@hookform/resolvers/yup";
import { Button, Form, Input, Modal, Select, message } from "antd";
import { Controller, useForm } from "react-hook-form";
import { useEffect } from "react";
import { useUsers } from "../../../entities/user";
import { notificationSchema } from "../model/schema";
import type { CreateNotificationDto } from "../model/types";
import { useCreateNotification } from "../api/useCreateNotification";

interface NotificationFormModalProps {
  open: boolean;
  onClose: () => void;
}

const NotificationFormModal = ({ open, onClose }: NotificationFormModalProps) => {
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
    message.success("Bildirishnoma yaratildi");
    onClose();
    reset();
  });

  return (
    <Modal
      destroyOnHidden
      open={open}
      title="Yangi bildirishnoma"
      footer={null}
      onCancel={onClose}
    >
      <Form layout="vertical" onFinish={onSubmit}>
        <Form.Item
          label="Foydalanuvchi"
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
                placeholder="Foydalanuvchini tanlang"
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
            render={({ field }) => <Input {...field} type="tel" placeholder="Masalan: 123456789" />}
          />
        </Form.Item>

        <Form.Item
          label="Holat"
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
                  { value: "active", label: "Faol" },
                  { value: "inactive", label: "Nofaol" },
                ]}
              />
            )}
          />
        </Form.Item>

        <Button block type="primary" htmlType="submit" loading={createNotification.isPending}>
          Saqlash
        </Button>
      </Form>
    </Modal>
  );
};

export default NotificationFormModal;
