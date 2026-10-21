/**
 * «ILOVANI O'RNATISH» (PWA, KI-2, Trello 18WkrRCE) — brauzer hodisalari bilan ishlash, React'dan tashqarida.
 *
 * `beforeinstallprompt` sahifa yuklanishi bilan (React chizishidan OLDIN) bir marta keladi — shuning uchun
 * `captureInstallPrompt()` `main.tsx` da `render` dan oldin chaqiriladi va hodisani shu modul saqlaydi.
 * Holat (`installed | installable | ios | unsupported`) — `getInstallSnapshot()`, o'zgarish — `subscribeInstall()`
 * (`useSyncExternalStore` uchun).
 *
 * Qoidalar:
 *  - `display-mode: standalone` (yoki iOS `navigator.standalone`) — ilova ichida ochilgan → `installed`;
 *  - `appinstalled` — shu qurilmada o'rnatildi → `installed` (localStorage'da eslab qolinadi: brauzer tabida qayta
 *    ochilsa ham taklif qaytmaydi; `beforeinstallprompt` yana kelsa — ilova o'chirilgan, belgi tozalanadi);
 *  - iPhone / iPad (iPadOS o'zini Mac deb tanishtiradi — sensorli ekran bilan ajratiladi) → `ios`: o'rnatish faqat
 *    «Ulashish → Bosh ekranga qo'shish» orqali, tugma yo'riqnoma oynasini ochadi;
 *  - `beforeinstallprompt` kelgan (Chrome, Edge, Android) → `installable`; foydalanuvchi brauzer oynasini yopsa
 *    hodisa ishlatilgan bo'ladi, lekin holat `installable` qoladi (`offered`) — keyingi bosish brauzer menyusiga
 *    yo'naltiradi (`promptInstall` → `"unavailable"`);
 *  - qolgani (Firefox, eski brauzerlar) → `unsupported`;
 *  - boshqa tabda o'rnatilsa (yoki belgi tozalansa) — `storage` hodisasi: ochiq tab ham qayta yuklashsiz yangilanadi.
 */

export type AppInstallStatus = "installed" | "installable" | "ios" | "unsupported";

/** `promptInstall()` natijasi: brauzer oynasi javobi yoki oyna ochib bo'lmadi. */
export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

/** Chrome / Edge `beforeinstallprompt` hodisasi (TypeScript DOM tiplarida yo'q). */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
}

/** Shu qurilmada o'rnatilgani belgisi (`appinstalled`). */
export const INSTALLED_STORAGE_KEY = "elchi:pwa-install:installed";

const STANDALONE_QUERY = "(display-mode: standalone)";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
/** Brauzer o'rnatish taklifini hech bo'lmasa bir marta bergan (ishlatilgan bo'lsa ham). */
let offered = false;
let installedNow = false;
let captured = false;
const listeners = new Set<() => void>();
let snapshot: AppInstallStatus | null = null;

const readFlag = (): boolean => {
  try {
    return window.localStorage.getItem(INSTALLED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const writeFlag = (value: boolean) => {
  try {
    if (value) window.localStorage.setItem(INSTALLED_STORAGE_KEY, "1");
    else window.localStorage.removeItem(INSTALLED_STORAGE_KEY);
  } catch {
    // Xususiy rejim / bloklangan saqlash — belgi shu sessiya uchun xotirada qoladi.
  }
};

export const isStandaloneDisplay = (): boolean => {
  if (typeof window === "undefined") return false;
  const media = typeof window.matchMedia === "function" && window.matchMedia(STANDALONE_QUERY).matches;
  return media || (navigator as Navigator & { standalone?: boolean }).standalone === true;
};

/** iPhone, iPod, iPad va iPadOS 13+ («Macintosh» + sensorli ekran). */
export const isIosDevice = (
  userAgent: string = typeof navigator === "undefined" ? "" : navigator.userAgent,
  maxTouchPoints: number = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints,
): boolean => /iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && maxTouchPoints > 1);

const computeStatus = (): AppInstallStatus => {
  if (installedNow || isStandaloneDisplay()) return "installed";
  if (deferredPrompt || offered) return "installable";
  if (readFlag()) return "installed";
  if (isIosDevice()) return "ios";
  return "unsupported";
};

const emit = () => {
  snapshot = computeStatus();
  for (const listener of listeners) listener();
};

const onBeforeInstallPrompt = (event: Event) => {
  // Brauzerning o'z mini-paneli chiqmasin — taklif bizning kartada.
  event.preventDefault();
  deferredPrompt = event as BeforeInstallPromptEvent;
  offered = true;
  installedNow = false;
  // Hodisa yana keldi — ilova o'chirilgan (yoki hech o'rnatilmagan): eski belgi tozalanadi.
  writeFlag(false);
  emit();
};

const onAppInstalled = () => {
  deferredPrompt = null;
  installedNow = true;
  writeFlag(true);
  emit();
};

/** Boshqa tab `INSTALLED_STORAGE_KEY` ni o'zgartirdi (o'rnatdi / belgini tozaladi). */
const onStorage = (event: StorageEvent) => {
  if (event.key !== INSTALLED_STORAGE_KEY && event.key !== null) return;
  if (readFlag()) {
    deferredPrompt = null;
    installedNow = true;
  } else {
    installedNow = false;
  }
  emit();
};

/**
 * Brauzer hodisalarini ushlash — `main.tsx` da birinchi chizishdan OLDIN, bir marta (takror chaqiruv xavfsiz).
 */
export const captureInstallPrompt = () => {
  if (captured || typeof window === "undefined") return;
  captured = true;
  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onAppInstalled);
  window.addEventListener("storage", onStorage);
  if (typeof window.matchMedia === "function") {
    const media = window.matchMedia(STANDALONE_QUERY);
    media.addEventListener?.("change", emit);
  }
};

export const getInstallSnapshot = (): AppInstallStatus => {
  snapshot ??= computeStatus();
  return snapshot;
};

export const subscribeInstall = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Brauzerning o'rnatish oynasi (faqat foydalanuvchi bosishi ichida). Hodisa bir martalik — javobdan keyin
 * tashlanadi; qabul qilinsa `appinstalled` holatni `installed` ga o'tkazadi.
 */
export const promptInstall = async (): Promise<InstallOutcome> => {
  const event = deferredPrompt;
  if (!event) return "unavailable";
  deferredPrompt = null;
  try {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      installedNow = true;
      writeFlag(true);
    }
    return choice.outcome;
  } catch {
    return "unavailable";
  } finally {
    emit();
  }
};

/** Faqat testlar uchun: modul holatini tozalash. */
export const resetInstallStateForTests = () => {
  if (typeof window !== "undefined") {
    window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.removeEventListener("appinstalled", onAppInstalled);
    window.removeEventListener("storage", onStorage);
  }
  deferredPrompt = null;
  offered = false;
  installedNow = false;
  captured = false;
  snapshot = null;
  listeners.clear();
};
