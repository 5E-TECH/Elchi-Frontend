// dizayn-v2: courier-scan-active
/**
 * TELEGRAM MINI APP SDK — faqat `/tg/scan` sahifasida yuklanadi (MWYaqprw).
 *
 * `telegram-web-app.js` `index.html` ga qo'shilmaydi: boshqa sahifalar uni yuklamasin. Skript bir marta
 * qo'shiladi; Telegram'dan tashqarida ham yuklanadi va `WebApp` obyektini yaratadi, lekin `initData`
 * bo'sh bo'ladi — sahifa shunga qarab «faqat Telegram ichida» holatini ko'rsatadi (kamera ochilmaydi).
 *
 * Global `Window` turi kengaytirilmaydi: kerakli minimal tur shu yerda, o'qish — `getTelegramWebApp()`.
 */

export const TELEGRAM_WEB_APP_SDK_URL = "https://telegram.org/js/telegram-web-app.js";

/** Skript yuklanmasa (bloklangan, internet yo'q) shuncha kutib «Telegram'dan tashqarida» deb hisoblanadi. */
const SDK_TIMEOUT_MS = 8_000;

export type TelegramHapticFeedback = {
  impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  notificationOccurred: (type: "error" | "success" | "warning") => void;
  selectionChanged: () => void;
};

export type TelegramScanQrPopupParams = {
  /** Skaner ostidagi matn (0–64 belgi). */
  text?: string;
};

/**
 * `true` qaytarsa — oyna yopiladi; aks holda ochiq qoladi va keyingi QR ham shu funksiyaga keladi.
 */
export type TelegramScanQrCallback = (text: string) => boolean | void;

export type TelegramWebApp = {
  /** Xom satr — backend imzosini tekshiradi (`POST /auth/telegram { init_data }`). Telegram'dan tashqarida bo'sh. */
  initData: string;
  version?: string;
  platform?: string;
  ready: () => void;
  expand: () => void;
  close: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  HapticFeedback?: TelegramHapticFeedback;
  showScanQrPopup?: (params: TelegramScanQrPopupParams, callback?: TelegramScanQrCallback) => void;
  closeScanQrPopup?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  disableVerticalSwipes?: () => void;
};

type WindowWithTelegram = Window & { Telegram?: { WebApp?: TelegramWebApp } };

export const getTelegramWebApp = (): TelegramWebApp | null =>
  typeof window === "undefined" ? null : ((window as WindowWithTelegram).Telegram?.WebApp ?? null);

let sdkPromise: Promise<TelegramWebApp | null> | null = null;

/**
 * SDK'ni bir marta yuklaydi va `WebApp` ni qaytaradi (yuklanmasa — `null`). Obyekt allaqachon bo'lsa
 * (Telegram o'zi qo'shgan yoki testdagi soxta obyekt) skript qo'shilmaydi.
 */
export const loadTelegramWebApp = (timeoutMs = SDK_TIMEOUT_MS): Promise<TelegramWebApp | null> => {
  const existing = getTelegramWebApp();
  if (existing) return Promise.resolve(existing);
  if (sdkPromise) return sdkPromise;
  if (typeof document === "undefined") return Promise.resolve(null);

  sdkPromise = new Promise<TelegramWebApp | null>((resolve) => {
    const script = document.createElement("script");
    let timer = 0;
    const finish = (failed: boolean) => {
      window.clearTimeout(timer);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      // Yuklanmagan bo'lsa keyingi urinish skriptni qaytadan so'raydi.
      if (failed) sdkPromise = null;
      resolve(getTelegramWebApp());
    };
    const onLoad = () => finish(false);
    const onError = () => finish(true);
    script.src = TELEGRAM_WEB_APP_SDK_URL;
    script.async = true;
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    timer = window.setTimeout(() => finish(!getTelegramWebApp()), timeoutMs);
    document.head.appendChild(script);
  });

  return sdkPromise;
};

/** Faqat testlar uchun: modul holatini tozalash. */
export const resetTelegramWebAppLoaderForTests = () => {
  sdkPromise = null;
};

/** Bot API versiyasi: `isVersionAtLeast` bo'lmasa (juda eski SDK) — qo'llab-quvvatlanmaydi deb hisoblanadi. */
const supports = (webApp: TelegramWebApp, version: string) => {
  try {
    return webApp.isVersionAtLeast?.(version) ?? false;
  } catch {
    return false;
  }
};

/** Eski mijozda chaqirilgan usul xato tashlashi mumkin (`WebAppMethodUnsupported`) — oqim to'xtamasin. */
const safely = (action: () => void) => {
  try {
    action();
  } catch {
    /* Telegram mijozi bu usulni bilmaydi */
  }
};

/**
 * Ochilganda: Telegram'ga «tayyor» deyish, oynani to'liq balandlikka yoyish, skanerlash paytida pastga
 * surib yopib qo'yishni o'chirish (7.7+) va Telegram sarlavhasini kamera yuzasi rangiga moslash.
 * `surfaceColor` — tungi kamera yuzasining `--color-bg` qiymati (literal rang kodga yozilmaydi).
 */
export const prepareTelegramWebApp = (webApp: TelegramWebApp, surfaceColor?: string | null) => {
  safely(() => webApp.ready());
  safely(() => webApp.expand());
  if (supports(webApp, "7.7")) safely(() => webApp.disableVerticalSwipes?.());
  const color = surfaceColor?.trim();
  if (color && color.startsWith("#")) {
    if (supports(webApp, "6.9")) safely(() => webApp.setHeaderColor?.(color));
    if (supports(webApp, "6.1")) safely(() => webApp.setBackgroundColor?.(color));
  }
};

export const closeTelegramWebApp = (webApp: TelegramWebApp) => safely(() => webApp.close());

/** Telegram ichki QR skaneri (6.4+) — iOS'da kamera ochilmasa zaxira yo'l. */
export const canUseTelegramQrPopup = (webApp: TelegramWebApp) =>
  typeof webApp.showScanQrPopup === "function" && supports(webApp, "6.4");

export const openTelegramQrPopup = (webApp: TelegramWebApp, text: string, onText: TelegramScanQrCallback) => {
  safely(() => webApp.showScanQrPopup?.({ text }, onText));
};

export type ScanHaptic = "success" | "error" | "warning" | "light";

const VIBRATE_PATTERN: Record<ScanHaptic, number | number[]> = {
  success: 40,
  light: 20,
  warning: [30, 60, 30],
  error: [60, 80, 60],
};

/**
 * Skan natijasini qo'lda his qilish: Telegram tebranishi (6.1+), bo'lmasa brauzer `navigator.vibrate`.
 */
export const scanHaptic = (webApp: TelegramWebApp | null, kind: ScanHaptic) => {
  const haptic = webApp?.HapticFeedback;
  if (webApp && haptic && supports(webApp, "6.1")) {
    safely(() => {
      if (kind === "light") haptic.impactOccurred("light");
      else haptic.notificationOccurred(kind);
    });
    return;
  }
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    safely(() => {
      navigator.vibrate(VIBRATE_PATTERN[kind]);
    });
  }
};
