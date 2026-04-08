import { yupResolver } from "@hookform/resolvers/yup";
import { Button, Form, Input, Modal, Select, message } from "antd";
import { Controller, useForm } from "react-hook-form";
import { useEffect } from "react";
import type { Notification } from "../../../entities/notification";
import { useUsers } from "../../../entities/user";
import { notificationEditSchema } from "../model/schema";
import { useUpdateNotification } from "../api/useUpdateNotification";
import type { UpdateNotificationDto } from "../model/types";

interface NotificationEditModalProps {
  open: boolean;
  initialData: Notification | null;
  onClose: () => void;
}

const NotificationEditModal = ({ open, initialData, onClose }: NotificationEditModalProps) => {
  const { data: users = [] } = useUsers();
  const updateNotification = useUpdateNotification();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateNotificationDto>({
    resolver: yupResolver(notificationEditSchema),
    defaultValues: {
      user_id: "",
      chat_id: "",
      status: "active",
    },
  });

  useEffect(() => {
    if (open && initialData) {
      reset({
        user_id: initialData.user.id,
        chat_id: initialData.chat_id,
        status: initialData.status,
      });
    }

    if (!open) {
      reset({
        user_id: "",
        chat_id: "",
        status: "active",
      });
    }
  }, [initialData, open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!initialData) return;
    await updateNotification.mutateAsync({ id: initialData.id, payload: values });
    message.success("Bildirishnoma yangilandi");
    onClose();
  });

  return (
    <Modal destroyOnHidden open={open} title="Bildirishnomani tahrirlash" footer={null} onCancel={onClose}>
      <Form layout="vertical" onFinish={onSubmit}>
        <Form.Item label="Foydalanuvchi" validateStatus={errors.user_id ? "error" : ""} help={errors.user_id?.message}>
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

        <Form.Item label="Chat ID" validateStatus={errors.chat_id ? "error" : ""} help={errors.chat_id?.message}>
          <Controller control={control} name="chat_id" render={({ field }) => <Input {...field} />} />
        </Form.Item>

        <Form.Item label="Holat" validateStatus={errors.status ? "error" : ""} help={errors.status?.message}>
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

        <Button block type="primary" htmlType="submit" loading={updateNotification.isPending}>
          Saqlash
        </Button>
      </Form>
    </Modal>
  );
};

export default NotificationEditModal;
