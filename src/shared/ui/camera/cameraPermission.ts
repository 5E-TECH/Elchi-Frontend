/**
 * Kamera ruxsati va platforma (taxta `tizim-scanner` 04.1 «Ruxsat so'rash izohi», 04.2 «Ruxsat rad etilgan»,
 * Trello kkDkrAIz).
 *
 *   - `prompt`  — hali so'ralmagan: brauzer oynasidan OLDIN nima uchun kerakligini aytamiz («Kamerani yoqish»);
 *   - `granted` — darhol ishga tushiramiz;
 *   - `denied`  — qanday yoqishni platformaga qarab 3 qadamda ko'rsatamiz;
 *   - `unknown` — `navigator.permissions` yo'q yoki «camera» nomini bilmaydi (eski Safari, Firefox) — ishga
 *     tushiramiz, brauzer o'zi so'raydi.
 */
export type CameraPermission = "granted" | "denied" | "prompt" | "unknown";

type PermissionStatusLike = {
  state: string;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

const toPermission = (state: string | undefined): CameraPermission =>
  state === "granted" || state === "denied" || state === "prompt" ? state : "unknown";

const queryStatus = async (): Promise<PermissionStatusLike | null> => {
  if (typeof navigator === "undefined" || typeof navigator.permissions?.query !== "function") return null;
  try {
    return (await navigator.permissions.query({ name: "camera" as PermissionName })) as PermissionStatusLike;
  } catch {
    return null;
  }
};

export const queryCameraPermission = async (): Promise<CameraPermission> => toPermission((await queryStatus())?.state);

/**
 * Ruxsat holati o'zgarishini kuzatadi (foydalanuvchi sozlamada yoqdi → kamera o'zi qayta ochiladi).
 * Yechish funksiyasini qaytaradi.
 */
export const watchCameraPermission = (onChange: (permission: CameraPermission) => void): (() => void) => {
  let cancelled = false;
  let status: PermissionStatusLike | null = null;
  const listener = () => {
    if (!cancelled && status) onChange(toPermission(status.state));
  };
  void queryStatus().then((result) => {
    if (cancelled || !result) return;
    status = result;
    status.addEventListener?.("change", listener);
  });
  return () => {
    cancelled = true;
    status?.removeEventListener?.("change", listener);
  };
};

/** Ruxsatni yoqish yo'riqnomasi qaysi platforma uchun. */
export type CameraPlatform = "telegram" | "ios" | "android" | "desktop";

type TelegramWindow = Window & {
  Telegram?: { WebApp?: { initData?: string } };
  TelegramWebview?: unknown;
  TelegramWebviewProxy?: unknown;
};

/**
 * Telegram ichidagi brauzer (havola Telegram'da ochilgan) — kameraga ruxsat bera olmaydi, «Brauzerda oching».
 * iOS (iPadOS «Macintosh» + sensor ham) — Sozlamalar → Safari → Kamera. Android — manzil satridagi qulf.
 */
export const detectCameraPlatform = (): CameraPlatform => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "desktop";
  const win = window as TelegramWindow;
  const userAgent = navigator.userAgent ?? "";
  if (
    win.TelegramWebviewProxy !== undefined ||
    win.TelegramWebview !== undefined ||
    Boolean(win.Telegram?.WebApp?.initData) ||
    /Telegram/i.test(userAgent)
  ) {
    return "telegram";
  }
  if (/iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && (navigator.maxTouchPoints ?? 0) > 1)) {
    return "ios";
  }
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
};
