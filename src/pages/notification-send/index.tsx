// dizayn-v2: superadmin-notifications-send, superadmin-notifications-send-confirm-dialog
import { useTranslation } from "react-i18next";
import { NotificationDispatchForm } from "../../features/notification-dispatch";
import { PageHeader } from "../../shared/ui/primitives";
import { NotificationInboxItem } from "../../widgets/notification-inbox";

/**
 * Xabar yuborish (`/notifications/send`) — superadmin va admin, dizayn v2 (maket `superadmin-notifications-send`).
 * «← Bildirishnomalar» — `/inbox` (ega savoli 10, sukut: kirish nuqtasi inbox, admin `/notifications` ni ocholmaydi).
 * Oldindan ko'rish — inbox kartasining o'zi (`NotificationInboxItem preview`).
 */
const NotificationSendPage = () => {
  const { t } = useTranslation("notifications");

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        back="/inbox"
        backLabel={t("dispatch.backLabel")}
        title={t("dispatch.pageTitle")}
        description={t("dispatch.pageDescription")}
      />
      <NotificationDispatchForm
        renderPreview={(notification) => (
          <NotificationInboxItem notification={notification} preview />
        )}
      />
    </div>
  );
};

export default NotificationSendPage;
