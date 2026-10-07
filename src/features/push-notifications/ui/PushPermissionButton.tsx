import { memo, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import PopupConfirm from "../../../shared/components/popupConfirm";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import { usePushSubscription } from "../model/usePushSubscription";

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

/**
 * "Bildirishnomalarni yoqish" (davC9QOX).
 *
 * Ikki qadam: avval BIZNING tushuntiruvchi oynamiz, faqat "Yoqish" bosilgach
 * brauzer oynasi. Sahifa yuklanganda hech qanday ruxsat so'ralmaydi. Rad
 * etilgan bo'lsa tugma o'rniga passiv izoh — qayta bezovta qilinmaydi
 * (brauzer 'denied' dan keyin dasturiy qayta so'rashga ruxsat bermaydi).
 */
const PushPermissionButton = () => {
  const { t } = useTranslation("notifications");
  const { api: notify } = useAppNotification();
  const { status, enable, disable } = usePushSubscription();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (status === "loading" || status === "unsupported" || status === "unavailable") return null;

  if (status === "denied") {
    return (
      <p
        role="status"
        className="m-0 inline-flex max-w-full items-start gap-2 self-start rounded-xl border border-[color:var(--color-border-soft)] px-3 py-2 text-xs text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]"
      >
        <BellOff size={16} className="mt-0.5 shrink-0" />
        <span>{t("push.blocked")}</span>
      </p>
    );
  }

  const handleEnable = async () => {
    setBusy(true);
    try {
      const result = await enable();
      if (result === "enabled") notify.success({ message: t("push.enabled") });
    } catch {
      notify.error({ message: t("push.enableFailed") });
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      await disable();
      notify.success({ message: t("push.disabled") });
    } catch {
      notify.error({ message: t("push.disableFailed") });
    } finally {
      setBusy(false);
    }
  };

  if (status === "enabled") {
    return (
      <button
        type="button"
        onClick={() => void handleDisable()}
        disabled={busy}
        className={`${buttonBase} self-start border border-[color:var(--color-border-soft)] text-maindark hover:border-main/40 hover:text-main dark:text-white`}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />}
        {t("push.turnOff")}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className={`${buttonBase} self-start bg-main text-white hover:bg-main/90`}
      >
        <Bell size={16} />
        {t("push.turnOn")}
      </button>
      <PopupConfirm
        isOpen={confirmOpen}
        onClose={() => {
          if (!busy) setConfirmOpen(false);
        }}
        // Brauzer oynasi shu bosish (user gesture) ichida ochiladi.
        onConfirm={() => void handleEnable()}
        title={t("push.explainTitle")}
        message={t("push.explainBody")}
        confirmLabel={t("push.explainConfirm")}
        cancelLabel={t("push.explainCancel")}
        isLoading={busy}
        variant="success"
      />
    </>
  );
};

export default memo(PushPermissionButton);
