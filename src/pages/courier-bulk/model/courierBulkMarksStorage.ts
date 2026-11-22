import type { CourierBulkAction, CourierBulkScanMode } from "./courierBulk";

/**
 * «Tezkor amal» belgilari brauzerda saqlanadi (BeePost `courier-bulk-scan-state` naqshi): sahifa yangilansa, boshqa
 * bo'limga o'tib qaytilsa yoki telefon brauzeri varaqni qayta yuklasa ham kuryer skanerlagan «bekor» / «ertaga»
 * belgilari yo'qolmaydi. Kalit foydalanuvchi bo'yicha (bitta qurilmada ikki xodim bo'lsa aralashmaydi).
 *
 * Belgilar faqat BUGUNGI (Toshkent kuni) — kechagi «bekor» / «ertaga» bugungi yakunlashga o'tib ketmasin va bugungi
 * skan «Qayta skaner — oldin skaner qilingan» demasin (skan auditi #58, #76). Ilgari 24 soatlik muddat har yozuvda
 * qayta boshlanardi (`savedAt` har safar yangilanardi, sahifa esa har ochilishda yozadi) — har kuni ochiladigan
 * sahifada belgilar hech qachon eskirmasdi. Endi yozuvda kun kaliti (`day`); boshqa kun yoki kunsiz (eski) yozuv
 * tashlanadi.
 */
const KEY_PREFIX = "courier-bulk-marks:v1:";
const DAY_MS = 24 * 60 * 60 * 1000;
/** Toshkent — UTC+5, yozgi vaqt yo'q. */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

const TASHKENT_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tashkent",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Belgilar kuni — Toshkent sanasi `YYYY-MM-DD` (qurilma vaqt mintaqasiga qaramay). */
export const courierBulkMarksDay = (now = Date.now()) => TASHKENT_DAY.format(new Date(now));

/** Toshkentda keyingi yarim tungacha qolgan vaqt (ms) — ochiq sahifa kun almashganda belgilarni tashlaydi. */
export const msUntilNextCourierBulkDay = (now = Date.now()) => {
  const local = now + TASHKENT_OFFSET_MS;
  return Math.floor(local / DAY_MS) * DAY_MS + DAY_MS - local;
};

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
    const parsed = JSON.parse(raw) as { actions?: unknown; scanMode?: unknown; day?: unknown };
    if (parsed?.day !== courierBulkMarksDay(now)) {
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
    store.setItem(storageKey(userKey), JSON.stringify({ ...marks, day: courierBulkMarksDay(now) }));
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
