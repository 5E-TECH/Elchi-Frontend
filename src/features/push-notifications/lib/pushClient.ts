import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { authClient } from "../../../auth/authService";

/**
 * Web Push — brauzer bilan ishlash (davC9QOX).
 *
 * ⚠️ iOS Safari TABIDA PushManager umuman yo'q: iOS'da push faqat bosh ekranga
 * o'rnatilgan PWA ichida ishlaydi (18WkrRCE kartasi). Bu yerda shunchaki
 * "qo'llab-quvvatlanmaydi" deb qaytadi.
 */

export type PushPlatform = "android" | "ios" | "desktop";

export const isPushSupported = (): boolean =>
  typeof window !== "undefined" &&
  window.isSecureContext !== false &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export const detectPlatform = (userAgent = navigator.userAgent): PushPlatform => {
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  // iPadOS 13+ o'zini Mac deb tanishtiradi — sensorli ekran bilan ajratamiz.
  if (/macintosh/i.test(userAgent) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1) {
    return "ios";
  }
  return "desktop";
};

export const isStandalone = (): boolean =>
  (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** VAPID public kalit (base64url) → `applicationServerKey`. */
export const urlBase64ToUint8Array = (base64Url: string): Uint8Array<ArrayBuffer> => {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
};

/** Ro'yxatdan o'tgan SW (dev rejimda yo'q — u faqat PROD da ro'yxatdan o'tadi). */
export const getRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!isPushSupported()) return null;
  return (await navigator.serviceWorker.getRegistration("/")) ?? null;
};

export const getCurrentSubscription = async (): Promise<PushSubscription | null> => {
  const registration = await getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
};

export interface PushPublicKey {
  enabled: boolean;
  public_key: string | null;
}

export const fetchPushPublicKey = async (): Promise<PushPublicKey> => {
  const response = await api.get(API_ENDPOINTS.NOTIFICATIONS.PUSH_PUBLIC_KEY);
  const data = (response.data?.data ?? response.data ?? {}) as Partial<PushPublicKey>;
  return { enabled: Boolean(data.enabled && data.public_key), public_key: data.public_key ?? null };
};

/** Brauzer obunasini serverga yuboradi (server tomonda endpoint bo'yicha idempotent). */
export const saveSubscription = async (subscription: PushSubscription) => {
  const json = subscription.toJSON();
  await api.post(API_ENDPOINTS.NOTIFICATIONS.PUSH_SUBSCRIBE, {
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
    user_agent: navigator.userAgent.slice(0, 1024),
    platform: detectPlatform(),
    is_standalone: isStandalone(),
  });
};

/** Qurilmani obuna qiladi (`userVisibleOnly: true` majburiy — busiz Chrome rad etadi). */
export const subscribeDevice = async (publicKey: string): Promise<PushSubscription> => {
  const registration = await getRegistration();
  if (!registration) throw new Error("service-worker-missing");
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
};

/** Serverdan va brauzerdan o'chiradi. Server 404 bersa ham (allaqachon yo'q) davom etadi. */
export const unsubscribeDevice = async () => {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;
  await api
    .delete(API_ENDPOINTS.NOTIFICATIONS.PUSH_SUBSCRIBE, { data: { endpoint: subscription.endpoint } })
    .catch(() => undefined);
  await subscription.unsubscribe().catch(() => false);
};

/**
 * LOGOUT'dan OLDIN chaqiriladi (authService.registerBeforeLogout): token hali
 * tirik. `authClient` — 401 interceptori yo'q, ya'ni rad javobi qayta logout
 * siklini boshlamaydi. Umumiy qurilmada keyingi odam avvalgisining
 * xabarlarini olmasin.
 */
export const unsubscribePushOnLogout = async (accessToken: string | null) => {
  const subscription = await getCurrentSubscription().catch(() => null);
  if (!subscription) return;
  if (accessToken) {
    await authClient
      .delete(API_ENDPOINTS.NOTIFICATIONS.PUSH_SUBSCRIBE, {
        data: { endpoint: subscription.endpoint },
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .catch(() => undefined);
  }
  await subscription.unsubscribe().catch(() => false);
};
