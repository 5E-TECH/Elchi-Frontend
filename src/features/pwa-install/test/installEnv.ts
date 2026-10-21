import { act } from "@testing-library/react";
import { vi } from "vitest";
import { captureInstallPrompt, resetInstallStateForTests } from "../lib/installPrompt";

/**
 * jsdom'da PWA o'rnatish API'lari yo'q — testlar uchun soxta brauzer muhiti: user agent (iPhone, iPadOS, Chrome),
 * `display-mode: standalone`, `beforeinstallprompt` / `appinstalled` hodisalari.
 */
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
export const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
export const IPADOS_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";

const originalMatchMedia = window.matchMedia;
// `setDevice` navigator xususiyatlarini o'zgartiradi — keyingi testlarga (shu fayldagi boshqa describe) iPhone UA
// meros qolmasin: asl deskriptorlar saqlanadi va `restoreInstallEnv` da qaytariladi.
const NAVIGATOR_PROPS = ["userAgent", "maxTouchPoints"] as const;
const originalNavigatorProps = NAVIGATOR_PROPS.map(
  (name) => [name, Object.getOwnPropertyDescriptor(window.navigator, name)] as const,
);

export const setDevice = (userAgent: string = ANDROID_UA, maxTouchPoints = 0) => {
  Object.defineProperty(window.navigator, "userAgent", { value: userAgent, configurable: true });
  Object.defineProperty(window.navigator, "maxTouchPoints", { value: maxTouchPoints, configurable: true });
};

export const setStandalone = (standalone: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: standalone && query.includes("standalone"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

/** Toza muhit: Android Chrome, brauzer tabi, saqlash bo'sh, hodisalar ushlangan. */
export const resetInstallEnv = () => {
  resetInstallStateForTests();
  window.localStorage.clear();
  setDevice();
  setStandalone(false);
  captureInstallPrompt();
};

export const restoreInstallEnv = () => {
  resetInstallStateForTests();
  window.localStorage.clear();
  window.matchMedia = originalMatchMedia;
  for (const [name, descriptor] of originalNavigatorProps) {
    // Asl xususiyat prototipda (`Navigator.prototype`) — o'z (own) nusxasi o'chiriladi.
    if (descriptor) Object.defineProperty(window.navigator, name, descriptor);
    else Reflect.deleteProperty(window.navigator, name);
  }
};

/** `beforeinstallprompt` — `outcome` brauzer oynasidagi javob. */
export const fireBeforeInstallPrompt = (outcome: "accepted" | "dismissed" = "accepted") => {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  };
  event.prompt = vi.fn(() => Promise.resolve());
  event.userChoice = Promise.resolve({ outcome, platform: "web" });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
};

export const fireAppInstalled = () =>
  act(() => {
    window.dispatchEvent(new Event("appinstalled"));
  });
