// dizayn-v2: superadmin-notifications-send, superadmin-notifications-send-confirm-dialog, superadmin-notifications-send-result, superadmin-notifications-send-unknown, superadmin-notifications-send-audience, superadmin-notifications-send-states
import { History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { NotificationDispatchForm } from "../../features/notification-dispatch";
import { ButtonIcon, PageHeader, buttonClasses } from "../../shared/ui/primitives";
import { NotificationInboxItem } from "../../widgets/notification-inbox";

/**
 * Xabar yuborish (`/notifications/send`) — superadmin va admin, dizayn v2 (maket `superadmin-notifications-send`).
 * «← Bildirishnomalar» — `/inbox` (ega savoli 10, sukut: kirish nuqtasi inbox, admin `/notifications` ni ocholmaydi).
 * Oldindan ko'rish — inbox kartasining o'zi (`NotificationInboxItem preview`). Sarlavhada «Yuborilganlar» (NS-2) —
 * `/notifications/sent` (ikkinchi darajali; asosiy amal — formadagi «Yuborish»). KM-2: «Auditoriya» rejimi (kampaniya) —
 * formaning o'zida (maketlar `-send-audience`, `-send-states`).
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
        actions={
          <Link to="/notifications/sent" className={buttonClasses({ variant: "secondary" })}>
            <ButtonIcon icon={History} px={18} />
            {t("dispatch.historyLink")}
          </Link>
        }
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
