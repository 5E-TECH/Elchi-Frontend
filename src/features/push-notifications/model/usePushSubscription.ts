import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSettings, useUpdateSettings } from "../../../entities/settings";
import {
  fetchPushPublicKey,
  getCurrentSubscription,
  isPushSupported,
  saveSubscription,
  subscribeDevice,
  unsubscribeDevice,
} from "../lib/pushClient";

/**
 * - `unsupported`: brauzerda Push API yo'q (masalan iOS Safari tabi) yoki SW
 *   ro'yxatdan o'tmagan (dev rejim);
 * - `unavailable`: server tomonda push o'chiq (VAPID yo'q);
 * - `denied`: foydalanuvchi brauzerda rad etgan — QAYTA SO'RALMAYDI;
 * - `enabled` / `disabled`: ruxsat bor/yo'q va sozlama.
 */
export type PushStatus = "loading" | "unsupported" | "unavailable" | "denied" | "enabled" | "disabled";

export type EnableResult = "enabled" | "denied" | "dismissed";

/** Rad etish belgisi — tugma passiv holatda qoladi, qayta bezovta qilinmaydi. */
export const PUSH_DENIED_STORAGE_KEY = "elchi_push_denied";

const readDenied = () => {
  try {
    return window.localStorage.getItem(PUSH_DENIED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const writeDenied = () => {
  try {
    window.localStorage.setItem(PUSH_DENIED_STORAGE_KEY, "1");
  } catch {
    // localStorage bloklangan — brauzerning o'z `denied` holati baribir saqlanadi.
  }
};

export const PUSH_PUBLIC_KEY_QUERY = ["push", "public-key"] as const;
export const PUSH_SUBSCRIPTION_QUERY = ["push", "subscription"] as const;

export const usePushSubscription = () => {
  const supported = isPushSupported();
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const { mutateAsync: saveSettings } = useUpdateSettings();
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    supported ? Notification.permission : "default",
  );
  const [denied, setDenied] = useState(readDenied);

  const publicKey = useQuery({
    queryKey: PUSH_PUBLIC_KEY_QUERY,
    queryFn: fetchPushPublicKey,
    enabled: supported,
    staleTime: Infinity,
    retry: false,
    // Server push'ni hali qo'llab-quvvatlamasa ham foydalanuvchiga xato chiqmasin.
    meta: { silentError: true },
  });

  const subscription = useQuery({
    queryKey: PUSH_SUBSCRIPTION_QUERY,
    queryFn: async () => {
      const current = await getCurrentSubscription();
      return { registered: Boolean(await navigator.serviceWorker.getRegistration("/")), endpoint: current?.endpoint ?? null };
    },
    enabled: supported,
    staleTime: 30_000,
    meta: { silentError: true },
  });

  useEffect(() => {
    if (supported && Notification.permission === "denied") writeDenied();
  }, [supported]);

  const refreshSubscription = useCallback(
    () => queryClient.invalidateQueries({ queryKey: PUSH_SUBSCRIPTION_QUERY }),
    [queryClient],
  );

  let status: PushStatus;
  if (!supported) status = "unsupported";
  else if (permission === "denied" || denied) status = "denied";
  else if (publicKey.isLoading || subscription.isLoading) status = "loading";
  else if (!subscription.data?.registered) status = "unsupported";
  else if (!publicKey.data?.enabled) status = "unavailable";
  else if (permission === "granted" && settings?.notifications.push && subscription.data?.endpoint) status = "enabled";
  else status = "disabled";

  /**
   * ⚠️ Foydalanuvchi BOSGAN tugma ichidan chaqirilishi SHART: brauzer oynasi
   * faqat user gesture ichida ochiladi (iOS talabi, Chrome jazosidan himoya).
   * Shuning uchun `requestPermission` BIRINCHI qadam — undan oldin await yo'q.
   */
  const enable = useCallback(async (): Promise<EnableResult> => {
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "denied") {
      writeDenied();
      setDenied(true);
      return "denied";
    }
    if (result !== "granted") return "dismissed";

    const key = publicKey.data?.public_key ?? (await fetchPushPublicKey()).public_key;
    if (!key) throw new Error("push-unavailable");
    const pushSubscription = await subscribeDevice(key);
    await saveSubscription(pushSubscription);
    await saveSettings({ notifications: { push: true } });
    await refreshSubscription();
    return "enabled";
  }, [publicKey.data, saveSettings, refreshSubscription]);

  const disable = useCallback(async () => {
    await unsubscribeDevice();
    await saveSettings({ notifications: { push: false } });
    await refreshSubscription();
  }, [saveSettings, refreshSubscription]);

  return { status, enable, disable };
};
