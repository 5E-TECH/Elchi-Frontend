import { useState } from "react";
import { useTranslation } from "react-i18next";
import { notify } from "../../../shared/lib/notify";
import { usePushSubscription } from "./usePushSubscription";

/**
 * Push boshqaruvi — bitta sahifada BITTA nusxa (sarlavha tugmasi, holat bloki va tushuntirish oynasi bir
 * holatni ko'rsin): `/inbox` sarlavhadagi «Bildirishnomalarni yoqish» + tanadagi «yoqilgan»/«bloklangan»
 * bloki, Sozlamalar qurilma bloki (`PushPermissionButton variant="switch"`).
 *
 * Oqim eski `PushPermissionButton` bilan aynan: «yoqish» → avval BIZNING tushuntirish oynasi →
 * «Yoqish» bosilganda (user gesture ichida) brauzer oynasi → obuna → sozlama `push=true` → xabar.
 * O'chirish — darhol (tasdiqsiz, avvalgidek), xabar bilan.
 */
export const usePushControl = () => {
  const { t } = useTranslation("notifications");
  const subscription = usePushSubscription();
  const { enable, disable } = subscription;
  const [explainOpen, setExplainOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  /** «Yoqish» — `Notification.requestPermission` shu bosish ichida birinchi chaqiriladi. */
  const confirmEnable = async () => {
    setBusy(true);
    try {
      const result = await enable();
      if (result === "enabled") notify.success(t("push.enabled"));
    } catch {
      notify.error(t("push.enableFailed"));
    } finally {
      setBusy(false);
      setExplainOpen(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      await disable();
      notify.success(t("push.disabled"));
    } catch {
      notify.error(t("push.disableFailed"));
    } finally {
      setBusy(false);
    }
  };

  return {
    status: subscription.status,
    permission: subscription.permission,
    state: subscription.state,
    busy,
    explainOpen,
    openExplain: () => setExplainOpen(true),
    closeExplain: () => {
      if (!busy) setExplainOpen(false);
    },
    confirmEnable,
    turnOff,
  };
};

export type PushControl = ReturnType<typeof usePushControl>;
