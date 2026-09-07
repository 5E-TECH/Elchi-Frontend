import { message } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { ConfirmButton } from "../../../shared/ui/ConfirmButton";
import { useDeleteNotification } from "../api/useDeleteNotification";

const DeleteNotificationButton = ({ id }: { id: string }) => {
  const deleteNotification = useDeleteNotification();

  return (
    <ConfirmButton
      danger
      size="small"
      icon={<DeleteOutlined />}
      confirmTitle="Haqiqatan ham o'chirmoqchimisiz?"
      onConfirm={async () => {
        try {
          await deleteNotification.mutateAsync(id);
          message.success("Bildirishnoma o'chirildi");
        } catch {
          message.error("Bildirishnomani o'chirishda xatolik yuz berdi");
        }
      }}
      loading={deleteNotification.isPending}
    >
      O'chirish
    </ConfirmButton>
  );
};

export default DeleteNotificationButton;
