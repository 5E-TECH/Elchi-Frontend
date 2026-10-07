import { vi } from "vitest";

/**
 * jsdom'da Web Push API yo'q — testlar uchun soxta brauzer muhiti:
 * Notification, PushManager, navigator.serviceWorker va obuna.
 */
export interface PushEnvOptions {
  permission?: NotificationPermission;
  /** requestPermission() natijasi. */
  answer?: NotificationPermission;
  /** Qurilmada allaqachon obuna bor. */
  subscribed?: boolean;
  /** SW ro'yxatdan o'tganmi (dev rejimda yo'q). */
  registered?: boolean;
}

export const fakeSubscription = (endpoint = "https://fcm.googleapis.com/fcm/send/device-1") => ({
  endpoint,
  toJSON: () => ({ endpoint, keys: { p256dh: "BNcR-p256dh", auth: "tBHI-auth" } }),
  unsubscribe: vi.fn(() => Promise.resolve(true)),
});

export type FakeSubscription = ReturnType<typeof fakeSubscription>;

export const installPushEnv = ({
  permission = "default",
  answer = "granted",
  subscribed = false,
  registered = true,
}: PushEnvOptions = {}) => {
  let current: FakeSubscription | null = subscribed ? fakeSubscription() : null;
  const listeners = new Map<string, Set<(event: MessageEvent) => void>>();

  const notification = {
    permission,
    requestPermission: vi.fn(() => {
      notification.permission = answer;
      return Promise.resolve(answer);
    }),
  };

  const pushManager = {
    getSubscription: vi.fn(() => Promise.resolve(current)),
    subscribe: vi.fn(() => {
      current = fakeSubscription("https://fcm.googleapis.com/fcm/send/new-device");
      return Promise.resolve(current);
    }),
  };
  const registration = { pushManager };

  const serviceWorker = {
    getRegistration: vi.fn(() => Promise.resolve(registered ? registration : undefined)),
    addEventListener: vi.fn((type: string, fn: (event: MessageEvent) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    }),
    removeEventListener: vi.fn((type: string, fn: (event: MessageEvent) => void) => {
      listeners.get(type)?.delete(fn);
    }),
  };

  vi.stubGlobal("Notification", notification);
  vi.stubGlobal("PushManager", function PushManager() {});
  vi.stubGlobal("isSecureContext", true);
  Object.defineProperty(navigator, "serviceWorker", { value: serviceWorker, configurable: true });

  return {
    notification,
    pushManager,
    serviceWorker,
    get subscription() {
      return current;
    },
    /** SW'dan ilovaga xabar (postMessage) — `message` tinglovchilariga. */
    emitMessage: (data: unknown) =>
      listeners.get("message")?.forEach((fn) => fn({ data } as MessageEvent)),
  };
};

export const uninstallPushEnv = () => {
  vi.unstubAllGlobals();
  // navigator.serviceWorker jsdom'da umuman yo'q — o'chirib, asl holatga qaytaramiz.
  delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
};
