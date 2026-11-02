// dizayn-v2: common-inbox, superadmin-notifications-inbox, courier-inbox-list, superadmin-notifications-push-explain-dialog, courier-inbox-push-explain-dialog, courier-inbox-pwa-install, courier-inbox-pwa-ios-dialog
import { Bell, BellOff, BellRing, CheckCheck, MessageSquareText, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import type { RootState } from "../../../app/config/store";
import { canSendNotifications } from "../../../app/lib/access";
import { useUnreadCount } from "../../../entities/notification-inbox";
import { useMarkAllInboxRead } from "../../../features/notification-inbox";
import {
  PushExplainDialog,
  usePushControl,
  type PushControl,
} from "../../../features/push-notifications";
import { InstallAppCard } from "../../../features/pwa-install";
import { notify } from "../../../shared/lib/notify";
import { Button, buttonClasses, Card, PageHeader } from "../../../shared/ui/primitives";
import { NotificationInboxList } from "../../../widgets/notification-inbox";

/** Push holat bloki: bloklangan — ogohlantirish, yoqilgan — karta «O'chirib qo'yish» bilan (spec D4, barcha rollar). */
const PushStateBlock = ({ push }: { push: PushControl }) => {
  const { t } = useTranslation("notifications");

  if (push.state === "denied") {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-fg"
      >
        <BellOff size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
        <div className="min-w-0 text-text">
          <p className="font-bold text-warning-fg">{t("push.blockedTitle")}</p>
          <p>
            {t("push.blockedBody")}{" "}
            <Link
              to="/settings"
              state={{ tab: "notifications" }}
              className="font-semibold text-action-fg underline underline-offset-2 hover:text-action-hover max-md:inline-flex max-md:min-h-11 max-md:items-center"
            >
              {t("push.howToLink")}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (push.state === "enabled") {
    return (
      <Card
        padding="none"
        aria-label={t("push.deviceToggle")}
        bodyClassName="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 px-5 py-4 max-md:grid-cols-[auto_minmax(0,1fr)] max-md:items-start max-md:gap-x-3 max-md:px-3.5 max-md:py-3"
      >
        <span
          aria-hidden="true"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-success-soft text-success-fg"
        >
          <BellRing size={18} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold text-text">{t("push.enabledTitle")}</span>
          <span className="text-[13px] text-text-muted max-md:hidden">{t("push.enabledBody")}</span>
          <span className="text-xs text-text-muted md:hidden">{t("push.enabledBodyShort")}</span>
        </div>
        {/* e2e va ekran o'quvchi nomi saqlanadi: «Bildirishnomalarni o'chirish» (ko'rinadigan matn — «O'chirib qo'yish»). */}
        <Button
          variant="secondary"
          aria-label={t("push.turnOff")}
          loading={push.busy}
          onClick={() => void push.turnOff()}
          className="max-md:col-start-2 max-md:justify-self-start"
        >
          {t("push.turnOffShort")}
        </Button>
      </Card>
    );
  }

  return null;
};

/**
 * BILDIRISHNOMALAR QUTISI (`/inbox`, barcha rollar) — maketlar `common-inbox`, `superadmin-notifications-inbox`,
 * `courier-inbox-list` va push tushuntirish oynalari. Spec D4: layout bitta, xulq rolga ko'ra —
 * sarlavha superadminda «Bildirishnomalar qutisi» (maket `superadmin-notifications-inbox`: menyudagi «Bildirishnomalar» —
 * Telegram guruhlari), boshqalarda «Bildirishnomalar»; amallar: push so'ralmagan bo'lsa «Bildirishnomalarni yoqish», «Barchasini o'qilgan
 * deb belgilash», yubora oladiganlarga (`canSendNotifications`) «SMS» va «Xabar yuborish» (asosiy).
 * Push holat bloki (bloklangan / yoqilgan) sarlavha ostida; so'ng «Ilovani o'rnatish» kartasi (KI-2, maketlar
 * `courier-inbox-pwa-install` / `courier-inbox-pwa-ios-dialog`, barcha rollar, doim — yopishsiz, ilova o'rnatilmagan va
 * o'rnatish mumkin bo'lsa); ro'yxat — `NotificationInboxList`.
 *
 * Per-user inbox (o'qilgan/o'qilmagan, o'chirish). Admin `NotificationsPage` (Telegram guruhlari) — boshqa sahifa.
 */
const NotificationInboxPage = () => {
  const { t } = useTranslation("notifications");
  const canSend = useSelector(canSendNotifications);
  const isSuperadmin = useSelector((state: RootState) => state.role.role === "superadmin");
  const push = usePushControl();
  const markAllRead = useMarkAllInboxRead();
  const unread = useUnreadCount().data;

  const handleMarkAllRead = async () => {
    try {
      await markAllRead.mutateAsync();
      notify.success(t("markAllReadSuccess"));
    } catch {
      notify.error(t("markAllReadError"));
    }
  };

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t(isSuperadmin ? "inboxTitleSuperadmin" : "inboxTitle")}
        description={t("inboxDescription")}
        actions={
          <>
            {push.state === "default" || push.state === "granted-off" ? (
              <Button variant="secondary" compact leftIcon={Bell} onClick={push.openExplain}>
                {t("push.turnOn")}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              compact
              leftIcon={CheckCheck}
              disabled={unread === 0}
              loading={markAllRead.isPending}
              onClick={() => void handleMarkAllRead()}
            >
              {t("markAllRead")}
            </Button>
            {canSend ? (
              <Link
                to="/notifications/sms"
                className={buttonClasses({ variant: "secondary", compact: true })}
              >
                <MessageSquareText size={16} aria-hidden="true" />
                {t("inbox.sms")}
              </Link>
            ) : null}
            {canSend ? (
              <Link
                to="/notifications/send"
                className={buttonClasses({ variant: "primary", compact: true })}
              >
                <Send size={16} aria-hidden="true" />
                {t("dispatch.openSend")}
              </Link>
            ) : null}
          </>
        }
      />

      <PushStateBlock push={push} />

      <InstallAppCard placement="inbox" />

      <NotificationInboxList />

      <PushExplainDialog
        open={push.explainOpen}
        busy={push.busy}
        onClose={push.closeExplain}
        onConfirm={() => void push.confirmEnable()}
      />
    </div>
  );
};

export default NotificationInboxPage;
