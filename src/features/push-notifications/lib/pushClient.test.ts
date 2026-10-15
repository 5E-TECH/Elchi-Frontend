import { afterEach, describe, expect, it, vi } from "vitest";
import { authClient, logout, registerBeforeLogout } from "../../../auth/authService";
import tokenStorage from "../../../auth/tokenStorage";
import { installPushEnv, uninstallPushEnv } from "../test/pushEnv";
import {
  detectPlatform,
  LOGOUT_DELETE_TIMEOUT_MS,
  subscribeDevice,
  unsubscribePushOnLogout,
  urlBase64ToUint8Array,
} from "./pushClient";
import { BEFORE_LOGOUT_TIMEOUT_MS } from "../../../auth/authService";

describe("pushClient", () => {
  afterEach(() => {
    uninstallPushEnv();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("detects the platform for the push_subscriptions row", () => {
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14; SM-A546E)")).toBe("android");
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)")).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129")).toBe("desktop");
  });

  it("⭐ 3 marta obuna — qurilmada BITTA obuna, har safar AYNI endpoint (server endpoint bo'yicha bitta qator)", async () => {
    const env = installPushEnv({ permission: "granted" });
    const endpoints = [];
    for (let i = 0; i < 3; i += 1) {
      endpoints.push((await subscribeDevice("aGk_")).endpoint);
    }
    expect(env.pushManager.subscribe).toHaveBeenCalledTimes(1);
    expect(new Set(endpoints).size).toBe(1);
  });

  it("decodes a base64url VAPID key into bytes", () => {
    // "hi?" → base64url "aGk_"
    expect(Array.from(urlBase64ToUint8Array("aGk_"))).toEqual([104, 105, 63]);
  });

  it("logout hook deletes this device's subscription with the still-valid token, then unsubscribes the browser", async () => {
    const env = installPushEnv({ permission: "granted", subscribed: true });
    const subscription = env.subscription!;
    const del = vi.spyOn(authClient, "delete").mockResolvedValue({ data: {} });

    await unsubscribePushOnLogout("token-123");

    expect(del).toHaveBeenCalledWith("notifications/push/subscribe", {
      data: { endpoint: subscription.endpoint },
      headers: { Authorization: "Bearer token-123" },
      timeout: LOGOUT_DELETE_TIMEOUT_MS,
    });
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });

  it("⭐ sekin / osilib qolgan DELETE qurilmadagi obunani USHLAB TURMAYDI (umumiy telefon)", async () => {
    const env = installPushEnv({ permission: "granted", subscribed: true });
    const subscription = env.subscription!;
    // Server javob bermaydi — avval bu holatda mahalliy obuna o'chmay qolardi.
    vi.spyOn(authClient, "delete").mockImplementation(() => new Promise(() => {}));

    void unsubscribePushOnLogout("token-123");

    await vi.waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalled());
  });

  it("DELETE'ning o'z timeouti logout chegarasidan qisqa — u chegara ichida tugaydi", () => {
    expect(LOGOUT_DELETE_TIMEOUT_MS).toBeLessThan(BEFORE_LOGOUT_TIMEOUT_MS);
  });

  it("logout runs the hook BEFORE the token is revoked (POST /auth/logout)", async () => {
    tokenStorage.setAccessToken("token-123");
    const order: string[] = [];
    const unregister = registerBeforeLogout(async (token) => {
      order.push(`hook:${token}`);
    });
    vi.spyOn(authClient, "post").mockImplementation(async () => {
      order.push("logout");
      return { data: {} };
    });

    await logout();
    unregister();

    expect(order).toEqual(["hook:token-123", "logout"]);
  });

  it("a hanging hook never blocks logout for more than 4 s", async () => {
    vi.useFakeTimers();
    tokenStorage.setAccessToken("token-123");
    const unregister = registerBeforeLogout(() => new Promise(() => {}));
    const post = vi.spyOn(authClient, "post").mockResolvedValue({ data: {} });

    const done = logout();
    await vi.advanceTimersByTimeAsync(4_000);
    await done;
    unregister();

    expect(post).toHaveBeenCalled();
    expect(tokenStorage.getAccessToken()).toBeFalsy();
  });
});
