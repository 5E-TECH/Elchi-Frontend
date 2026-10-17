import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TELEGRAM_WEB_APP_SDK_URL,
  canUseTelegramQrPopup,
  loadTelegramWebApp,
  resetTelegramWebAppLoaderForTests,
  scanHaptic,
  type TelegramWebApp,
} from "./telegramWebApp";

const setTelegram = (value: unknown) => {
  (window as unknown as { Telegram?: unknown }).Telegram = value;
};

const sdkScripts = () =>
  [...document.head.querySelectorAll("script")].filter((script) => script.src === TELEGRAM_WEB_APP_SDK_URL);

const webApp = (overrides: Partial<TelegramWebApp> = {}): TelegramWebApp => ({
  initData: "hash=abc",
  ready: vi.fn(),
  expand: vi.fn(),
  close: vi.fn(),
  isVersionAtLeast: (version) => Number.parseFloat(version) <= 6.4,
  ...overrides,
});

afterEach(() => {
  setTelegram(undefined);
  sdkScripts().forEach((script) => script.remove());
  resetTelegramWebAppLoaderForTests();
});

describe("loadTelegramWebApp", () => {
  it("does not inject the SDK when Telegram already provided WebApp", async () => {
    const app = webApp();
    setTelegram({ WebApp: app });

    await expect(loadTelegramWebApp()).resolves.toBe(app);
    expect(sdkScripts()).toHaveLength(0);
  });

  it("injects the SDK once and resolves WebApp after it loads", async () => {
    const pending = loadTelegramWebApp();
    const again = loadTelegramWebApp();
    expect(sdkScripts()).toHaveLength(1);

    const app = webApp();
    setTelegram({ WebApp: app });
    sdkScripts()[0].dispatchEvent(new Event("load"));

    await expect(pending).resolves.toBe(app);
    await expect(again).resolves.toBe(app);
  });

  it("resolves null when the SDK cannot be loaded (treated as outside Telegram)", async () => {
    const pending = loadTelegramWebApp();
    sdkScripts()[0].dispatchEvent(new Event("error"));

    await expect(pending).resolves.toBeNull();
  });
});

describe("Telegram capabilities", () => {
  it("offers the Telegram QR popup only from Bot API 6.4", () => {
    expect(canUseTelegramQrPopup(webApp({ showScanQrPopup: vi.fn() }))).toBe(true);
    expect(canUseTelegramQrPopup(webApp({ showScanQrPopup: vi.fn(), isVersionAtLeast: () => false }))).toBe(false);
    expect(canUseTelegramQrPopup(webApp())).toBe(false);
  });

  it("uses Telegram haptics when available and falls back to navigator.vibrate", () => {
    const haptic = { impactOccurred: vi.fn(), notificationOccurred: vi.fn(), selectionChanged: vi.fn() };
    scanHaptic(webApp({ HapticFeedback: haptic }), "success");
    expect(haptic.notificationOccurred).toHaveBeenCalledWith("success");

    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
    scanHaptic(null, "error");
    expect(vibrate).toHaveBeenCalled();
    Reflect.deleteProperty(navigator, "vibrate");
  });
});
