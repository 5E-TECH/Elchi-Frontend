import { afterEach, describe, expect, it, vi } from "vitest";
import { detectCameraPlatform, queryCameraPermission, watchCameraPermission } from "./cameraPermission";

const setPermissions = (value: unknown) =>
  Object.defineProperty(navigator, "permissions", { configurable: true, value });

const setUserAgent = (value: string, maxTouchPoints = 0) => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(value);
  Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: maxTouchPoints });
};

afterEach(() => {
  Reflect.deleteProperty(navigator, "permissions");
  Reflect.deleteProperty(navigator, "maxTouchPoints");
  Reflect.deleteProperty(window, "TelegramWebviewProxy");
  vi.restoreAllMocks();
});

describe("queryCameraPermission", () => {
  it.each(["granted", "denied", "prompt"] as const)("%s", async (state) => {
    setPermissions({ query: vi.fn(async () => ({ state })) });
    await expect(queryCameraPermission()).resolves.toBe(state);
  });

  it("API yo'q yoki «camera» nomini bilmaydi — unknown (brauzer o'zi so'raydi)", async () => {
    await expect(queryCameraPermission()).resolves.toBe("unknown");
    setPermissions({ query: vi.fn(async () => Promise.reject(new TypeError("camera is not a valid PermissionName"))) });
    await expect(queryCameraPermission()).resolves.toBe("unknown");
  });

  it("watchCameraPermission — holat o'zgarishini xabar qiladi, yechilgach tinglamaydi", async () => {
    const subscribed: { listener?: () => void } = {};
    const status = {
      state: "denied",
      addEventListener: vi.fn((_type: string, next: () => void) => {
        subscribed.listener = next;
      }),
      removeEventListener: vi.fn(),
    };
    setPermissions({ query: vi.fn(async () => status) });
    const onChange = vi.fn();
    const stop = watchCameraPermission(onChange);
    await vi.waitFor(() => expect(status.addEventListener).toHaveBeenCalled());
    status.state = "granted";
    subscribed.listener?.();
    expect(onChange).toHaveBeenCalledWith("granted");
    stop();
    expect(status.removeEventListener).toHaveBeenCalled();
  });
});

describe("detectCameraPlatform — ruxsat yo'riqnomasi", () => {
  it.each([
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1", 5, "ios"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", 5, "ios"],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/129.0 Mobile Safari/537.36", 5, "android"],
    ["Mozilla/5.0 (Linux; Android 14) Telegram-Android/11.2.0", 5, "telegram"],
    ["Mozilla/5.0 (X11; Linux x86_64) Chrome/129.0 Safari/537.36", 0, "desktop"],
  ] as const)("%s (sensor %s) → %s", (userAgent, touch, platform) => {
    setUserAgent(userAgent, touch);
    expect(detectCameraPlatform()).toBe(platform);
  });

  it("Telegram ichki brauzeri (`TelegramWebviewProxy`) — telegram", () => {
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", 5);
    Object.defineProperty(window, "TelegramWebviewProxy", { configurable: true, value: {} });
    expect(detectCameraPlatform()).toBe("telegram");
  });
});
