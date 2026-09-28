import { Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import HeaderName from "../../shared/components/headerName";
import PageContainer from "../../shared/ui/PageContainer";
import { NotificationDispatchForm } from "../../features/notification-dispatch";
import { NotificationInboxItem } from "../../widgets/notification-inbox";

/**
 * Xabar yuborish (`/notifications/send`) — superadmin va admin. Operator
 * tizim ichidan bildirishnoma yuboradi; ilgari yagona yo'l Swagger edi.
 */
const NotificationSendPage = () => {
  const { t } = useTranslation("notifications");

  return (
    <PageContainer>
      <HeaderName name={t("dispatch.pageTitle")} description={t("dispatch.pageDescription")} icon={<Send size={22} />} />
      <div className="mt-5">
        <NotificationDispatchForm
          renderPreview={(notification) => <NotificationInboxItem notification={notification} preview />}
        />
      </div>
    </PageContainer>
  );
};

export default NotificationSendPage;
