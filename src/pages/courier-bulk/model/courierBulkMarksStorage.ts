import type { CourierBulkAction, CourierBulkScanMode } from "./courierBulk";

/**
 * «Tezkor amal» belgilari brauzerda saqlanadi (BeePost `courier-bulk-scan-state` naqshi): sahifa yangilansa, boshqa
 * bo'limga o'tib qaytilsa yoki telefon brauzeri varaqni qayta yuklasa ham kuryer skanerlagan «bekor» / «ertaga»
 * belgilari yo'qolmaydi. Kalit foydalanuvchi bo'yicha (bitta qurilmada ikki xodim bo'lsa aralashmaydi), 24 soatdan
 * eski belgilar tashlanadi — kechagi «bekor» bugungi yakunlashga o'tib ketmasin.
 */
const KEY_PREFIX = "courier-bulk-marks:v1:";
export const COURIER_BULK_MARKS_TTL_MS = 24 * 60 * 60 * 1000;

const ACTIONS: ReadonlySet<string> = new Set<CourierBulkAction>(["sold", "cancel", "tomorrow"]);

export type CourierBulkSavedMarks = {
  actions: Record<string, CourierBulkAction>;
  scanMode: CourierBulkScanMode;
};

const storageKey = (userKey: string) => `${KEY_PREFIX}${userKey || "anonymous"}`;

const storage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const readCourierBulkMarks = (userKey: string, now = Date.now()): CourierBulkSavedMarks | null => {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(storageKey(userKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { actions?: unknown; scanMode?: unknown; savedAt?: unknown };
    const savedAt = Number(parsed?.savedAt);
    if (!Number.isFinite(savedAt) || now - savedAt > COURIER_BULK_MARKS_TTL_MS) {
      store.removeItem(storageKey(userKey));
      return null;
    }
    const actions: Record<string, CourierBulkAction> = {};
    if (parsed.actions && typeof parsed.actions === "object") {
      for (const [orderId, action] of Object.entries(parsed.actions as Record<string, unknown>)) {
        if (typeof action === "string" && ACTIONS.has(action)) actions[orderId] = action as CourierBulkAction;
      }
    }
    return { actions, scanMode: parsed.scanMode === "tomorrow" ? "tomorrow" : "cancel" };
  } catch {
    return null;
  }
};

export const writeCourierBulkMarks = (userKey: string, marks: CourierBulkSavedMarks, now = Date.now()) => {
  const store = storage();
  if (!store) return;
  try {
    if (Object.keys(marks.actions).length === 0 && marks.scanMode === "cancel") {
      store.removeItem(storageKey(userKey));
      return;
    }
    store.setItem(storageKey(userKey), JSON.stringify({ ...marks, savedAt: now }));
  } catch {
    // Xotira to'la yoki taqiqlangan (maxfiy rejim) — belgilar faqat sahifa xotirasida qoladi.
  }
};

/** Ro'yxatda yo'q buyurtmalar belgisi tashlanadi (sotilgan / boshqa kuryerga o'tgan); o'zgarmasa — ayni obyekt. */
export const pruneCourierBulkActions = (
  actions: Record<string, CourierBulkAction>,
  orderIds: ReadonlySet<string>,
): Record<string, CourierBulkAction> => {
  const stale = Object.keys(actions).filter((orderId) => !orderIds.has(orderId));
  if (stale.length === 0) return actions;
  const next = { ...actions };
  stale.forEach((orderId) => delete next[orderId]);
  return next;
};
