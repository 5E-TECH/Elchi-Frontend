import { describe, expect, it, vi } from "vitest";
import swSource from "../../../public/sw.js?raw";

/**
 * public/sw.js (QgqO0CdZ, davC9QOX) — soxta Service Worker muhitida bajariladi.
 */
type Listener = (event: Record<string, unknown>) => void;

const loadWorker = (clients: Array<Record<string, unknown>> = []) => {
  const listeners = new Map<string, Listener>();
  const self = {
    location: { origin: "https://admin.elchipochta.uz" },
    addEventListener: (type: string, fn: Listener) => listeners.set(type, fn),
    skipWaiting: vi.fn(),
    registration: {
      showNotification: vi.fn(() => Promise.resolve()),
      pushManager: { subscribe: vi.fn(() => Promise.resolve({ endpoint: "https://push/new" })) },
    },
    clients: {
      matchAll: vi.fn(() => Promise.resolve(clients)),
      claim: vi.fn(() => Promise.resolve()),
      openWindow: vi.fn(() => Promise.resolve(null)),
    },
  };
  new Function("self", swSource)(self);

  /** Hodisani yuborib, `waitUntil` ga berilgan va'dani kutadi. */
  const dispatch = async (type: string, event: Record<string, unknown> = {}) => {
    let pending: Promise<unknown> = Promise.resolve();
    listeners.get(type)?.({ ...event, waitUntil: (p: Promise<unknown>) => (pending = p) });
    await pending;
  };
  const pushEvent = (payload: unknown) => ({ data: { json: () => payload, text: () => "" } });

  return { self, listeners, dispatch, pushEvent };
};

const payload = {
  id: "7",
  title: "Yangi buyurtma",
  body: "#EL-100081",
  link: "/orders/7",
  tag: "notification-7",
};

describe("public/sw.js", () => {
  it("declares SW_VERSION on the first line and has NO fetch handler (nothing is cached)", () => {
    expect(swSource.split("\n")[0]).toMatch(/^const SW_VERSION = "[^"]+";$/);
    const { listeners } = loadWorker();
    expect([...listeners.keys()].sort()).toEqual(
      ["activate", "install", "notificationclick", "push", "pushsubscriptionchange"].sort(),
    );
    expect(listeners.has("fetch")).toBe(false);
  });

  it("activates the new version at once (skipWaiting + clients.claim)", async () => {
    const { self, dispatch } = loadWorker();
    await dispatch("install");
    await dispatch("activate");
    expect(self.skipWaiting).toHaveBeenCalled();
    expect(self.clients.claim).toHaveBeenCalled();
  });

  it("shows a system notification when no tab is visible", async () => {
    const hidden = { visibilityState: "hidden", postMessage: vi.fn(), url: "https://admin.elchipochta.uz/" };
    const { self, dispatch, pushEvent } = loadWorker([hidden]);

    await dispatch("push", pushEvent(payload));

    expect(self.registration.showNotification).toHaveBeenCalledWith("Yangi buyurtma", {
      body: "#EL-100081",
      tag: "notification-7",
      icon: "/icon-192.png",
      badge: "/favicon-48.png",
      data: { link: "/orders/7", id: "7" },
    });
    expect(hidden.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "elchi:push" }));
  });

  it("two-message barrier: a visible open tab gets it in-app, no system notification", async () => {
    const visible = { visibilityState: "visible", postMessage: vi.fn(), url: "https://admin.elchipochta.uz/" };
    const { self, dispatch, pushEvent } = loadWorker([visible]);

    await dispatch("push", pushEvent(payload));

    expect(self.registration.showNotification).not.toHaveBeenCalled();
    expect(visible.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "elchi:push", payload }),
    );
  });

  it("click focuses an open tab and navigates it to the deep link", async () => {
    const navigate = vi.fn(() => Promise.resolve());
    const tab = { url: "https://admin.elchipochta.uz/inbox", focus: vi.fn(() => Promise.resolve(tab)), navigate };
    const { self, dispatch } = loadWorker([tab]);
    const close = vi.fn();

    await dispatch("notificationclick", { notification: { close, data: { link: "/orders/7" } } });

    expect(close).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("https://admin.elchipochta.uz/orders/7");
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it("click opens a new window (default /inbox) when the app is closed", async () => {
    const { self, dispatch } = loadWorker([]);
    await dispatch("notificationclick", { notification: { close: vi.fn(), data: {} } });
    expect(self.clients.openWindow).toHaveBeenCalledWith("https://admin.elchipochta.uz/inbox");
  });

  it("pushsubscriptionchange re-subscribes with the old key and tells open tabs to sync", async () => {
    const tab = { postMessage: vi.fn(), url: "https://admin.elchipochta.uz/" };
    const { self, dispatch } = loadWorker([tab]);
    const key = new Uint8Array([1, 2, 3]);

    await dispatch("pushsubscriptionchange", { oldSubscription: { options: { applicationServerKey: key } } });

    expect(self.registration.pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: key,
    });
    expect(tab.postMessage).toHaveBeenCalledWith({ type: "elchi:push-subscription-changed" });
  });
});
