import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "antd";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import { useSettings } from "../../../entities/settings";
import { queryKeys } from "../../../shared/config/queryKeys";
import type { RootState } from "../../../app/config/store";
import {
  fetchPushPublicKey,
  getCurrentSubscription,
  isPushSupported,
  saveSubscription,
  subscribeDevice,
  unsubscribeDevice,
} from "../lib/pushClient";
import { PUSH_SUBSCRIPTION_QUERY } from "../model/usePushSubscription";

/**
 * PushSync — qurilmadagi push obunasini foydalanuvchi sozlamasiga moslaydi.
 * UI render qilmaydi (null), provayderlar ichida bir marta turadi.
 *
 * - `notifications.push = true` va ruxsat bor → joriy obuna serverga qayta
 *   yuboriladi (idempotent). Bu `pushsubscriptionchange` dan keyingi yangi
 *   endpointni ham, umumiy qurilmada boshqa foydalanuvchi kirganini ham yopadi.
 * - `notifications.push = false` → qurilmadagi obuna o'chiriladi (sozlamada
 *   o'chirilsa yangi obuna yaratilmaydi, mavjudi o'chadi).
 * - SW'dan kelgan `elchi:push` → bell badge/inbox darhol yangilanadi va
 *   KO'RINIB turgan tabda ilova ichida toast chiqadi. SW bunday tab bo'lsa
 *   tizim bildirishnomasini ataylab KO'RSATMAYDI (ikki-xabar to'sig'i) —
 *   toastsiz foydalanuvchi hodisani umuman ko'rmay qolardi.
 */

interface PushPayload {
  title?: string;
  body?: string | null;
  link?: string | null;
  id?: string;
  tag?: string | null;
}

/** Faqat ilova ichidagi yo'l — tashqi havola toastdan ochilmaydi. */
const safeLink = (link: string | null | undefined) =>
  typeof link === "string" && link.startsWith("/") && !link.startsWith("//") ? link : "/inbox";
const PushSync = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation("notifications");
  const { api: notify } = useAppNotification();
  const { data: settings } = useSettings();
  const userId = useSelector((state: RootState) => state.role.id);
  const [resync, setResync] = useState(0);
  const settingsReady = settings !== undefined;
  const wantsPush = Boolean(settings?.notifications.push);

  useEffect(() => {
    if (!isPushSupported()) return;
    const onMessage = (event: MessageEvent) => {
      const type = (event.data as { type?: string } | null)?.type;
      if (type === "elchi:push") {
        void queryClient.invalidateQueries({ queryKey: queryKeys.notificationsInbox.all });
        const payload = ((event.data as { payload?: PushPayload }).payload ?? {}) as PushPayload;
        // Yashirin tab ko'rsatmaydi: u holda SW tizim bildirishnomasini o'zi chiqargan.
        if (payload.title && document.visibilityState === "visible") {
          const key = `elchi-push-${payload.id ?? payload.tag ?? payload.title}`;
          const link = safeLink(payload.link);
          notify.info({
            key,
            message: payload.title,
            description: payload.body || undefined,
            placement: "topRight",
            duration: 6,
            actions: (
              <Button
                type="primary"
                size="small"
                onClick={() => {
                  notify.destroy(key);
                  navigate(link);
                }}
              >
                {t("push.toastOpen")}
              </Button>
            ),
          });
        }
      }
      if (type === "elchi:push-subscription-changed") setResync((value) => value + 1);
    };
    const container = navigator.serviceWorker;
    container.addEventListener("message", onMessage);
    return () => container.removeEventListener("message", onMessage);
  }, [queryClient, navigate, notify, t]);

  useEffect(() => {
    if (!isPushSupported() || !settingsReady || !userId) return;
    let cancelled = false;

    const sync = async () => {
      const current = await getCurrentSubscription();
      if (cancelled) return;
      if (!wantsPush) {
        if (current) await unsubscribeDevice();
        return;
      }
      if (Notification.permission !== "granted") return;
      let subscription = current;
      if (!subscription) {
        const { public_key } = await fetchPushPublicKey();
        if (!public_key || cancelled) return;
        subscription = await subscribeDevice(public_key);
      }
      if (!cancelled) await saveSubscription(subscription);
    };

    sync()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) void queryClient.invalidateQueries({ queryKey: PUSH_SUBSCRIPTION_QUERY });
      });
    return () => {
      cancelled = true;
    };
  }, [settingsReady, wantsPush, userId, resync, queryClient]);

  return null;
};

export default PushSync;
