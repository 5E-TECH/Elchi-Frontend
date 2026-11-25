import { useSyncExternalStore } from "react";

/**
 * ISH KUNI (Trello xhiXv3w3) — backend `libs/common/src/time/business-day.ts` bilan AYNI qoida.
 *
 * «Kun almashish soati» (Ops → «Kun tartibi», sukut `00:00`) butun tizimning kunini belgilaydi: dashboard, buyurtmalar
 * filtri, moliya kunlik hisoboti, Excel va kunlik pochtalar. Masalan `05:00` da «26-noyabr» = 26.11 05:00 → 27.11 05:00,
 * ya'ni 27.11 01:30 da «Bugun» hali 26-noyabr. Soat o'zgarsa yangi qoida keyingi kun almashishidan amal qiladi
 * (`schedule` — `{ from, time }` ro'yxati), o'tgan kunlar qayta hisoblanmaydi.
 *
 * Jadval `GET orders/intake-settings` javobidagi `day_change_schedule` dan keladi (`entities/order-intake`). U kelguncha
 * yoki soat `00:00` bo'lsa — qurilmaning kalendar sanasi (avvalgi xatti-harakat).
 *
 * Sana tanlagichlar «Bugun / Hafta / Oy» ni shu yerdan oladi va `YYYY-MM-DD` yuboradi — backend uni ish kuni deb
 * talqin qiladi.
 */
export type BusinessDayRule = { from: string; time: string };

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const pad2 = (value: number) => String(value).padStart(2, "0");
const minutesOf = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
/** `05:00` → +300; `18:00` → −360 (kun kecha 18:00 da boshlanadi). */
const offsetOf = (clock: string) => {
  const minutes = minutesOf(clock);
  return minutes < 720 ? minutes : minutes - 1440;
};
const isDayKey = (value: unknown): value is string =>
  typeof value === "string" &&
  DAY.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const addDays = (key: string, days: number) =>
  new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** Backend javobidagi ro'yxat → tozalangan, `from` bo'yicha tartiblangan qoidalar. */
export const normalizeBusinessDaySchedule = (value: unknown): BusinessDayRule[] => {
  if (!Array.isArray(value)) return [];
  const byDay = new Map<string, string>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const from = (item as { from?: unknown }).from;
    const time = String((item as { time?: unknown }).time ?? "").trim();
    if (isDayKey(from) && CLOCK.test(time)) byDay.set(from, time);
  }
  const rules: BusinessDayRule[] = [];
  let previous = "00:00";
  for (const from of [...byDay.keys()].sort()) {
    const time = byDay.get(from) ?? "00:00";
    if (time === previous) continue;
    rules.push({ from, time });
    previous = time;
  }
  return rules;
};

let rules: BusinessDayRule[] = [];
let signature = "[]";
const listeners = new Set<() => void>();

/** Jadvalni almashtiradi (intake holati kelganda); o'zgarsa obunachilar qayta chiziladi. */
export const setBusinessDaySchedule = (value: unknown) => {
  const next = normalizeBusinessDaySchedule(value);
  const nextSignature = JSON.stringify(next);
  if (nextSignature === signature) return;
  rules = next;
  signature = nextSignature;
  listeners.forEach((listener) => listener());
};

export const getBusinessDaySchedule = (): readonly BusinessDayRule[] => rules;

const ruleFor = (key: string, list: readonly BusinessDayRule[]) => {
  let found: BusinessDayRule | null = null;
  for (const rule of list) {
    if (rule.from <= key) found = rule;
    else break;
  }
  return found;
};

/** Ish kuni `key` ning boshi (epoch ms). */
export const businessDayStartMs = (key: string, list: readonly BusinessDayRule[] = rules) => {
  const rule = ruleFor(key, list);
  return Date.parse(`${key}T00:00:00Z`) - TASHKENT_OFFSET_MS + (rule ? offsetOf(rule.time) : 0) * 60_000;
};

/**
 * Lahza tushgan ish kunining sanasi (`YYYY-MM-DD`). Qoida yo'q — qurilmaning kalendar sanasi (avvalgidek).
 */
export const businessDayKey = (at: Date = new Date(), list: readonly BusinessDayRule[] = rules): string => {
  if (!list.length) {
    return `${String(at.getFullYear()).padStart(4, "0")}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`;
  }
  const t = at.getTime();
  let key = new Date(t + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
  while (businessDayStartMs(key, list) > t) key = addDays(key, -1);
  while (businessDayStartMs(addDays(key, 1), list) <= t) key = addDays(key, 1);
  return key;
};

/** Bugungi ISH KUNI sanasi — «Bugun» tez tanlovi. */
export const businessToday = (now: Date = new Date()) => businessDayKey(now);

/** Joriy ish kuni qaysi soatda boshlangan (`HH:MM`) — sana tanlagich izohi. */
export const currentBusinessDayChangeTime = (now: Date = new Date(), list: readonly BusinessDayRule[] = rules) =>
  list.length ? (ruleFor(businessDayKey(now, list), list)?.time ?? "00:00") : "00:00";

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Joriy kun almashish soati (`HH:MM`, jadval kelganda qayta chiziladi). `00:00` — izoh kerak emas.
 */
export const useBusinessDayChangeTime = () =>
  useSyncExternalStore(subscribe, () => currentBusinessDayChangeTime(), () => "00:00");

/** Bugungi ish kuni sanasi (jadval kelganda qayta chiziladi). */
export const useBusinessToday = () => useSyncExternalStore(subscribe, () => businessToday(), () => businessToday());
