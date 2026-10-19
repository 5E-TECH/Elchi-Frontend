import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { getCurrentBranchId } from "../../../shared/lib/currentBranch";
import { sanitizeDispatchOrder, type DispatchOrder } from "./dispatchOrder";

/**
 * KURYERGA BIRIKTIRISH SAVATI — QURILMADA (ega qarori D2; Trello v1eLN2tV, skaner 2-bosqich).
 *
 * Skanerlangan buyurtmalar (`/dispatch` — USB, kamera; `/scan/:token` — «Kuryerga biriktirish»; 3-bosqichda
 * universal skanerning «Kuryerga biriktirish» rejimi) bitta savatga yig'iladi. Sahifa yopilsa, yangilansa yoki
 * kamera ichida boshqa joyga o'tilsa ham savat yo'qolmaydi — kuryer kelguncha yig'ib turish mumkin.
 *
 *   - Kalit foydalanuvchi va filialga bog'langan (`elchi:dispatch-basket:v1:<userId>:<branchId>`): umumiy
 *     qurilmada boshqa xodim yoki boshqa filialga o'tgan xodim eski savatni ko'rmaydi.
 *   - Eskirgan yozuv tekshiriladi: `DISPATCH_BASKET_TTL_MS` (12 soat — bitta ish kuni) dan eski buyurtma o'qishda
 *     tashlanadi (kechagi savat bugungi kuryerga tushib ketmasin); noto'g'ri shakldagi yozuv ham tashlanadi.
 *   - `localStorage` yopiq bo'lishi mumkin (maxfiy oyna, Safari, bloklangan) — har o'qish va yozish `try/catch`
 *     ichida, savat shu sessiyada xotirada ishlayveradi.
 *   - Boshqa varaqdagi o'zgarish (`storage` hodisasi) shu varaqqa ham keladi.
 *
 * Savat — faqat qurilma holati: server bilan solishtirish biriktirishda (`POST orders/assign-to-courier` rad
 * etilgan buyurtmalarni sababi bilan qaytaradi).
 */

export const DISPATCH_BASKET_TTL_MS = 12 * 60 * 60 * 1000;
/** Ehtiyot chegarasi: savatda bundan ko'p buyurtma saqlanmaydi (eng eskilari tushadi). */
export const DISPATCH_BASKET_LIMIT = 500;
const STORAGE_PREFIX = "elchi:dispatch-basket:v1:";

export type DispatchBasketScope = { userId: string | null; branchId: string | null };

export type DispatchBasketItem = {
  order: DispatchOrder;
  /** Kuryerga biriktirishga tanlangan (yangi qo'shilgani — tanlangan). */
  selected: boolean;
  /** Qo'shilgan vaqt (ms) — eskirish va «yangisi birinchi» tartibi. */
  addedAt: number;
};

export const dispatchBasketStorageKey = (scope: DispatchBasketScope) =>
  `${STORAGE_PREFIX}${scope.userId || "anon"}:${scope.branchId || "-"}`;

const EMPTY: readonly DispatchBasketItem[] = Object.freeze([]);
/** Sessiya xotirasi (manba): kalit → yozuvlar. Birinchi murojaatda qurilmadan o'qiladi. */
const memory = new Map<string, readonly DispatchBasketItem[]>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

const sanitizeItem = (value: unknown, now: number): DispatchBasketItem | null => {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const order = sanitizeDispatchOrder(source.order);
  const addedAt = typeof source.addedAt === "number" && Number.isFinite(source.addedAt) ? source.addedAt : null;
  if (!order || addedAt === null) return null;
  // Eskirgan (yoki kelajakdagi — soat buzilgan) yozuv tashlanadi.
  if (now - addedAt > DISPATCH_BASKET_TTL_MS || addedAt - now > DISPATCH_BASKET_TTL_MS) return null;
  return { order, selected: source.selected !== false, addedAt };
};

/** Qurilmadagi matn → yozuvlar; `dirty` — nimadir tashlandi (eskirgan, buzilgan), qurilmaga qayta yoziladi. */
const parse = (raw: string | null, now: number): { items: readonly DispatchBasketItem[]; dirty: boolean } => {
  if (!raw) return { items: EMPTY, dirty: false };
  try {
    const parsed: unknown = JSON.parse(raw);
    const list = (parsed as { items?: unknown } | null)?.items;
    if (!Array.isArray(list)) return { items: EMPTY, dirty: true };
    const seen = new Set<string>();
    const items: DispatchBasketItem[] = [];
    for (const value of list) {
      const item = sanitizeItem(value, now);
      if (!item || seen.has(item.order.id)) continue;
      seen.add(item.order.id);
      items.push(item);
    }
    const kept = items.slice(-DISPATCH_BASKET_LIMIT);
    return { items: kept.length > 0 ? kept : EMPTY, dirty: kept.length !== list.length };
  } catch {
    return { items: EMPTY, dirty: true };
  }
};

const readStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, items: readonly DispatchBasketItem[]) => {
  try {
    if (items.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify({ items }));
  } catch {
    // Saqlab bo'lmadi (kvota, bloklangan) — savat shu sessiyada xotirada qoladi.
  }
};

const load = (key: string): readonly DispatchBasketItem[] => {
  const cached = memory.get(key);
  if (cached) return cached;
  const { items, dirty } = parse(readStorage(key), Date.now());
  memory.set(key, items);
  if (dirty) writeStorage(key, items);
  return items;
};

const commit = (key: string, items: readonly DispatchBasketItem[]) => {
  const next = items.length > 0 ? items.slice(-DISPATCH_BASKET_LIMIT) : EMPTY;
  memory.set(key, next);
  writeStorage(key, next);
  emit();
};

let storageListening = false;
const listenStorage = () => {
  if (storageListening || typeof window === "undefined") return;
  storageListening = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== null && !event.key.startsWith(STORAGE_PREFIX)) return;
    // Boshqa varaq o'zgartirdi (yoki hammasi tozalandi — `key === null`): keyingi o'qish qurilmadan.
    if (event.key === null) memory.clear();
    else memory.delete(event.key);
    emit();
  });
};

const subscribe = (listener: () => void) => {
  listenStorage();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const tokenKey = (value: string) => value.trim().toLowerCase();

/** Savat (qo'shilish tartibida — oxirgisi eng yangi). */
export const readDispatchBasket = (scope: DispatchBasketScope): readonly DispatchBasketItem[] =>
  load(dispatchBasketStorageKey(scope));

/** Buyurtma (raqami yoki tokeni bo'yicha) savatda bormi. */
export const isInDispatchBasket = (scope: DispatchBasketScope, idOrToken: string) => {
  const key = tokenKey(idOrToken);
  return readDispatchBasket(scope).some(
    (item) => item.order.id.toLowerCase() === key || tokenKey(item.order.token) === key,
  );
};

export type AddToDispatchBasketResult = "added" | "duplicate";

/**
 * Buyurtmani savatga qo'shadi va tanlaydi. Savatda bor bo'lsa (raqami yoki tokeni) — qayta qo'shilmaydi,
 * faqat tanlanadi (`"duplicate"`).
 */
export const addToDispatchBasket = (
  scope: DispatchBasketScope,
  order: DispatchOrder,
  now = Date.now(),
): AddToDispatchBasketResult => {
  const key = dispatchBasketStorageKey(scope);
  const items = load(key);
  const id = order.id.toLowerCase();
  const token = tokenKey(order.token);
  const existing = items.find(
    (item) => item.order.id.toLowerCase() === id || tokenKey(item.order.token) === token,
  );
  if (existing) {
    if (!existing.selected) commit(key, items.map((item) => (item === existing ? { ...item, selected: true } : item)));
    return "duplicate";
  }
  commit(key, [...items, { order, selected: true, addedAt: now }]);
  return "added";
};

export const removeFromDispatchBasket = (scope: DispatchBasketScope, orderIds: Iterable<string>) => {
  const ids = new Set(orderIds);
  const key = dispatchBasketStorageKey(scope);
  const items = load(key);
  const next = items.filter((item) => !ids.has(item.order.id));
  if (next.length !== items.length) commit(key, next);
};

export const setDispatchBasketSelected = (scope: DispatchBasketScope, orderIds: Iterable<string>, selected: boolean) => {
  const ids = new Set(orderIds);
  const key = dispatchBasketStorageKey(scope);
  const items = load(key);
  if (!items.some((item) => ids.has(item.order.id) && item.selected !== selected)) return;
  commit(key, items.map((item) => (ids.has(item.order.id) ? { ...item, selected } : item)));
};

/** Eskirgan yozuvlarni qurilmadan ham olib tashlaydi (sahifa ochilganda). */
export const pruneDispatchBasket = (scope: DispatchBasketScope, now = Date.now()) => {
  const key = dispatchBasketStorageKey(scope);
  const items = load(key);
  const fresh = items.filter((item) => now - item.addedAt <= DISPATCH_BASKET_TTL_MS);
  if (fresh.length !== items.length) commit(key, fresh);
};

/** Faqat testlar uchun: sessiya xotirasini tozalaydi (qurilma — `localStorage.clear()` bilan). */
export const resetDispatchBaskets = () => {
  memory.clear();
  emit();
};

/** Joriy foydalanuvchi va filial (savat kaliti). */
export const useDispatchBasketScope = (): DispatchBasketScope => {
  const rawUserId = useSelector((state: RootState) => (state.user.user as { id?: unknown } | null)?.id);
  const branchId = useSelector(getCurrentBranchId);
  const userId = typeof rawUserId === "string" || typeof rawUserId === "number" ? String(rawUserId) : null;
  return useMemo(() => ({ userId, branchId: branchId || null }), [branchId, userId]);
};

/** Savat holati va amallari (React). Ochilganda eskirgan yozuvlar tozalanadi. */
export const useDispatchBasket = (scope: DispatchBasketScope) => {
  const key = dispatchBasketStorageKey(scope);
  const getSnapshot = useCallback(() => load(key), [key]);
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    pruneDispatchBasket(scope);
  }, [scope]);

  const orders = useMemo(() => items.map((item) => item.order), [items]);
  const selectedIds = useMemo(
    () => new Set(items.filter((item) => item.selected).map((item) => item.order.id)),
    [items],
  );

  return {
    items,
    orders,
    selectedIds,
    add: useCallback((order: DispatchOrder) => addToDispatchBasket(scope, order), [scope]),
    remove: useCallback((orderIds: Iterable<string>) => removeFromDispatchBasket(scope, orderIds), [scope]),
    setSelected: useCallback(
      (orderIds: Iterable<string>, selected: boolean) => setDispatchBasketSelected(scope, orderIds, selected),
      [scope],
    ),
    has: useCallback((idOrToken: string) => isInDispatchBasket(scope, idOrToken), [scope]),
  };
};
