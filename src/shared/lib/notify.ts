import type { ReactNode } from "react";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  QALQIB CHIQUVCHI XABAR (toast) — dizayn v2, 3-bosqich
 *  Taxtalar: `tizim-feedback` 01–02, `tizim-errors` 03, `tizim-motion` («Qalqib chiquvchi xabar»)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Amal natijasi haqida qisqa xabar. React'dan TASHQARIDA ham chaqiriladi (axios interceptor, mutatsiya
 *  callback'i, oddiy funksiya) — holat modul darajasidagi kichik do'konda, ko'rinishi `<Toaster />` da
 *  (`src/shared/ui/primitives/Toaster.tsx`, ilovada bir marta `app/providers/UiHost.tsx` orqali).
 *
 *    notify.success(t("payments.transferred"), { description: t("payments.transferredText", { amount }) });
 *    notify.error(t("reports.loadFailed"), { action: { label: t("common.retry"), onClick: refetch } });
 *    const id = notify.info(…); notify.dismiss(id);
 *
 *  Matn qoidasi (taxta): sarlavha — nima bo'ldi (2–4 so'z), izoh — tafsilot yoki keyingi qadam.
 *  Bitta xabarda ko'pi bilan BITTA amal tugmasi («Bekor qilish», «Qayta urinish»).
 *
 *  Vaqt (taxta 01): muvaffaqiyat va ma'lumot — 4 s, ogohlantirish — 6 s, amalli xabar — 6 s,
 *  xato — foydalanuvchi yopguncha. Kursor yoki fokus xabar ustida bo'lsa vaqt to'xtaydi (`pause`).
 *  Bir vaqtda ko'pi bilan 3 ta: to'rtinchisi kelsa eng eskisi yopiladi. Bir xil xabar (ton + matn
 *  bir xil, yoki bir xil `id`) ko'rinib turgan bo'lsa — yangisi qo'shilmaydi, eskisining vaqti yangilanadi
 *  («takror xato bitta xabarga qo'shiladi»).
 *
 *  ⚠️ `duration` — MILLISEKUND (antd `message`/`notification` dagi soniya emas). `0` — o'zi yopilmaydi.
 */

export type NotifyTone = "success" | "info" | "warning" | "error";

export type NotifyAction = {
  /** Tugma matni (fe'l): «Bekor qilish», «Qayta urinish». */
  label: string;
  /** Bosilganda chaqiriladi; xabar shundan keyin yopiladi. */
  onClick: () => void;
};

export type NotifyOptions = {
  /** Izoh: tafsilot yoki keyingi qadam (bir jumla). */
  description?: ReactNode;
  /** Bitta amal tugmasi (havola ko'rinishida). */
  action?: NotifyAction;
  /** Ko'rinish vaqti, ms. `0` — foydalanuvchi yopguncha. Berilmasa — tonga qarab (yuqoridagi jadval). */
  duration?: number;
  /** Barqaror kalit: shu `id` dagi xabar ko'rinib turgan bo'lsa — yangisi qo'shilmaydi, o'sha yangilanadi. */
  id?: string;
};

export type ToastItem = {
  id: string;
  tone: NotifyTone;
  message: ReactNode;
  description?: ReactNode;
  action?: NotifyAction;
  /** Hal qilingan vaqt (ms); `0` — o'zi yopilmaydi. */
  duration: number;
  /** Mazmun o'zgargan sari oshadi — ekran o'quvchi yangilangan xabarni qayta eshitadi. */
  version: number;
  /** Yopilish harakati ketmoqda (200 ms), keyin ro'yxatdan olinadi. */
  closing: boolean;
};

/** Bir vaqtda ko'rinadigan xabarlar soni (taxta: «Ko'pi bilan 3 ta xabar»). */
export const MAX_TOASTS = 3;

/** Sukut vaqtlari, ms (taxta 01). Xato — `0`: foydalanuvchi yopguncha. */
export const TOAST_DURATION: Record<NotifyTone, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 0,
};

/** Amalli (masalan «Bekor qilish») xabar vaqti — 6 s (xatodan tashqari). */
export const TOAST_ACTION_DURATION = 6000;

/** Yopilish harakati (`tizim-motion`: 200 ms, o'ngga). */
export const TOAST_EXIT_MS = 200;

type Listener = () => void;

/**
 * Ekran o'quvchiga aytiladigan xabarlar: `status` (muvaffaqiyat, ma'lumot, ogohlantirish) va `alert` (xato),
 * e'lon tartibida. `Toaster` ularni doimiy jonli hududga bittadan QO'SHADI (`aria-atomic="false"`) —
 * faqat yangi qo'shilgan qator o'qiladi. Shuning uchun bir lahzada kelgan bir nechta xabar (masalan
 * «Excelga saqlandi» + ogohlantirish) bir-birini o'chirmaydi. Faqat YANGI yoki mazmuni o'zgargan xabar
 * qo'shiladi; takror xabar va boshqa xabarning yopilishi hech narsani qayta o'qitmaydi.
 */
export type ToastAnnouncements = { status: readonly ToastItem[]; alert: readonly ToastItem[] };

/** Vaqtni to'xtatish sabablari: kursor, klaviatura fokusi, yashirin tab. */
export type ToastPauseReason = "hover" | "focus" | "hidden";

type Timer = { handle: ReturnType<typeof setTimeout> | null; remaining: number; startedAt: number };

let toasts: readonly ToastItem[] = [];
const NO_ANNOUNCEMENTS: ToastAnnouncements = { status: [], alert: [] };
let announcements: ToastAnnouncements = NO_ANNOUNCEMENTS;
let sequence = 0;
const listeners = new Set<Listener>();
const timers = new Map<string, Timer>();
const exitTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pauseReasons = new Set<ToastPauseReason>();

const emit = () => {
  for (const listener of listeners) listener();
};

const setToasts = (next: readonly ToastItem[]) => {
  toasts = next;
  emit();
};

/** `id` dagi e'lonni olib tashlaydi (o'chirish ekran o'quvchiga aytilmaydi). */
const withoutAnnouncement = (id: string): ToastAnnouncements => {
  if (!announcements.status.some((item) => item.id === id) && !announcements.alert.some((item) => item.id === id)) {
    return announcements;
  }
  return {
    status: announcements.status.filter((item) => item.id !== id),
    alert: announcements.alert.filter((item) => item.id !== id),
  };
};

/** Xabarni e'lonlar oxiriga qo'shadi (shu `id` dagi eski e'lon — o'rniga). */
const announce = (toast: ToastItem) => {
  const rest = withoutAnnouncement(toast.id);
  const key = toast.tone === "error" ? "alert" : "status";
  announcements = { ...rest, [key]: [...rest[key], toast] };
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches === true;

const clearTimer = (id: string) => {
  const timer = timers.get(id);
  if (timer?.handle) clearTimeout(timer.handle);
  timers.delete(id);
};

const runTimer = (id: string, timer: Timer) => {
  timer.startedAt = Date.now();
  timer.handle = setTimeout(() => dismiss(id), timer.remaining);
};

/** Vaqtni (qayta) boshlaydi; to'xtatilgan bo'lsa — faqat qolgan vaqtni yozib qo'yadi. */
const startTimer = (id: string, duration: number) => {
  clearTimer(id);
  if (!(duration > 0) || !Number.isFinite(duration)) return;
  const timer: Timer = { handle: null, remaining: duration, startedAt: 0 };
  timers.set(id, timer);
  if (pauseReasons.size === 0) runTimer(id, timer);
};

const removeNow = (id: string) => {
  clearTimer(id);
  const exit = exitTimers.get(id);
  if (exit) clearTimeout(exit);
  exitTimers.delete(id);
  // Yopilgan xabar matni yashirin hududda qolmasin (o'chirish e'lon qilinmaydi).
  announcements = withoutAnnouncement(id);
  if (toasts.some((toast) => toast.id === id)) setToasts(toasts.filter((toast) => toast.id !== id));
};

/** Xabarni yopadi: 200 ms yopilish harakati, keyin ro'yxatdan olinadi («Harakatni kamaytirish» da darhol). */
function dismiss(id: string) {
  const target = toasts.find((toast) => toast.id === id);
  if (!target || target.closing) return;
  clearTimer(id);
  if (prefersReducedMotion()) {
    removeNow(id);
    return;
  }
  setToasts(toasts.map((toast) => (toast.id === id ? { ...toast, closing: true } : toast)));
  exitTimers.set(
    id,
    setTimeout(() => removeNow(id), TOAST_EXIT_MS),
  );
}

const resolveDuration = (tone: NotifyTone, options: NotifyOptions) => {
  if (options.duration != null) {
    if (import.meta.env.DEV && options.duration > 0 && options.duration < 100) {
      console.warn(`notify: duration=${options.duration} — millisekund kutiladi (antd'dagi soniya emas).`);
    }
    return Math.max(0, options.duration);
  }
  if (options.action && tone !== "error") return TOAST_ACTION_DURATION;
  return TOAST_DURATION[tone];
};

/** Bir xil xabarmi: bir xil `id`, yoki (`id` siz) bir xil ton + sarlavha + izoh. */
const findDuplicate = (tone: NotifyTone, message: ReactNode, options: NotifyOptions) =>
  toasts.find((toast) => {
    if (toast.closing) return false;
    if (options.id != null) return toast.id === options.id;
    return toast.tone === tone && toast.message === message && toast.description === options.description;
  });

const show = (tone: NotifyTone, message: ReactNode, options: NotifyOptions = {}): string => {
  const duration = resolveDuration(tone, options);
  const duplicate = findDuplicate(tone, message, options);

  if (duplicate) {
    // `id` bilan yangilash — yangi mazmun (ekran o'quvchi qayta eshitadi); takror xabar — faqat vaqt yangilanadi.
    const changed =
      duplicate.tone !== tone ||
      duplicate.message !== message ||
      duplicate.description !== options.description ||
      duplicate.action?.label !== options.action?.label;
    const updated: ToastItem = {
      ...duplicate,
      tone,
      message,
      description: options.description,
      action: options.action,
      duration,
      version: changed ? duplicate.version + 1 : duplicate.version,
    };
    if (changed) announce(updated);
    setToasts(toasts.map((toast) => (toast.id === duplicate.id ? updated : toast)));
    startTimer(duplicate.id, duration);
    return duplicate.id;
  }

  // Yopilayotgan eski nusxa (shu `id` bilan) — darhol olib tashlanadi, yangisi uning o'rnida.
  if (options.id != null) removeNow(options.id);

  sequence += 1;
  const id = options.id ?? `toast-${sequence}`;
  const item: ToastItem = {
    id,
    tone,
    message,
    description: options.description,
    action: options.action,
    duration,
    version: 0,
    closing: false,
  };
  announce(item);
  setToasts([...toasts, item]);
  startTimer(id, duration);

  // To'rtinchisi keldi — eng eskisi yopiladi (yopilayotganlar hisobga kirmaydi).
  const open = toasts.filter((toast) => !toast.closing);
  for (const toast of open.slice(0, Math.max(0, open.length - MAX_TOASTS))) dismiss(toast.id);

  return id;
};

/**
 * Xabar chiqarish. Har chaqiruv xabar `id` sini qaytaradi (`notify.dismiss(id)` uchun).
 * React'dan tashqarida ham ishlaydi; `<Toaster />` o'rnatilmagan bo'lsa xabar ko'rinmaydi, lekin xato bermaydi.
 */
export const notify = {
  success: (message: ReactNode, options?: NotifyOptions) => show("success", message, options),
  info: (message: ReactNode, options?: NotifyOptions) => show("info", message, options),
  warning: (message: ReactNode, options?: NotifyOptions) => show("warning", message, options),
  error: (message: ReactNode, options?: NotifyOptions) => show("error", message, options),
  /** Bitta xabarni (`id`) yoki, `id` siz, hammasini yopadi. */
  dismiss: (id?: string) => {
    if (id != null) {
      dismiss(id);
      return;
    }
    for (const toast of toasts) dismiss(toast.id);
  },
};

/**
 * `<Toaster />` va testlar uchun do'kon (sahifa kodi `notify` dan foydalanadi).
 * `useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot)`.
 */
export const toastStore = {
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: (): readonly ToastItem[] => toasts,
  /** E'lon qilinadigan so'nggi xabarlar (`Toaster` dagi yashirin `status` / `alert` hududlari). */
  getAnnouncements: (): ToastAnnouncements => announcements,
  /** Vaqtni to'xtatadi (kursor/fokus xabar ustida, tab yashirin). Sabablar alohida hisoblanadi. */
  pause: (reason: ToastPauseReason) => {
    if (pauseReasons.has(reason)) return;
    pauseReasons.add(reason);
    if (pauseReasons.size > 1) return;
    const now = Date.now();
    for (const timer of timers.values()) {
      if (!timer.handle) continue;
      clearTimeout(timer.handle);
      timer.handle = null;
      timer.remaining = Math.max(0, timer.remaining - (now - timer.startedAt));
    }
  },
  /** `pause` ni bekor qiladi; boshqa sabab qolmagan bo'lsa — qolgan vaqt davom etadi. */
  resume: (reason: ToastPauseReason) => {
    if (!pauseReasons.delete(reason) || pauseReasons.size > 0) return;
    for (const [id, timer] of timers) {
      if (!timer.handle) runTimer(id, timer);
    }
  },
  isPaused: () => pauseReasons.size > 0,
  /** Harakatsiz darhol olib tashlash (testlar). */
  remove: removeNow,
  /** Testlar: hamma xabar, vaqt va to'xtatishni tozalaydi. */
  reset: () => {
    for (const timer of timers.values()) if (timer.handle) clearTimeout(timer.handle);
    for (const exit of exitTimers.values()) clearTimeout(exit);
    timers.clear();
    exitTimers.clear();
    pauseReasons.clear();
    sequence = 0;
    announcements = NO_ANNOUNCEMENTS;
    setToasts([]);
  },
};
