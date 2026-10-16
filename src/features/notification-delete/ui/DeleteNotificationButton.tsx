import { DeleteOutlined } from "@ant-design/icons";
import { ConfirmButton } from "../../../shared/ui/ConfirmButton";
import { useDeleteNotification } from "../api/useDeleteNotification";
import { notify } from "../../../shared/lib/notify";

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
          notify.success("Bildirishnoma o'chirildi");
        } catch {
          notify.error("Bildirishnomani o'chirishda xatolik yuz berdi");
        }
      }}
      loading={deleteNotification.isPending}
    >
      O'chirish
    </ConfirmButton>
  );
};

export default DeleteNotificationButton;
