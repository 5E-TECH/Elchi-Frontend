import type { ConfirmContent } from "../ConfirmDialog";

/**
 * TASDIQLASH SO'ROVLARI NAVBATI — `useConfirm()` / `confirm()` shu yerga yozadi, `ConfirmHost` o'qiydi.
 *
 * Modul darajasidagi do'kon (React konteksti emas): `confirm()` ni har qayerdan — komponent, hodisa
 * ishlovchisi, mutatsiya yordamchisi — chaqirish mumkin, faqat ilovada `ConfirmHost` (`UiHost`) turgan
 * bo'lsin. Bir vaqtda bitta oyna: keyingi so'rov oldingisi yopilib, chiqish harakati tugagach ochiladi.
 */

export type ConfirmOptions = ConfirmContent & {
  /**
   * Tasdiqlangach bajariladigan amal (mutatsiya). Va'da qaytarsa — tugaguncha oyna ochiq, tugmalar
   * qulflangan va yuklanishda; muvaffaqiyatli tugasa `confirm()` → `true`; xato bo'lsa xato matni
   * oynada ko'rinadi va foydalanuvchi qayta urinadi yoki bekor qiladi (`false`).
   */
  onConfirm?: () => unknown;
};

export type ConfirmRequest = {
  id: number;
  options: ConfirmOptions;
  /** `false` — javob berildi, oyna yopilmoqda (chiqish harakati). */
  open: boolean;
};

type Snapshot = { hosts: readonly symbol[]; requests: readonly ConfirmRequest[] };

let snapshot: Snapshot = { hosts: [], requests: [] };
const resolvers = new Map<number, (value: boolean) => void>();
const listeners = new Set<() => void>();
let sequence = 0;

const update = (next: Partial<Snapshot>) => {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
};

export const subscribeConfirm = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getConfirmSnapshot = () => snapshot;

/**
 * `ConfirmHost` o'zini ro'yxatdan o'tkazadi. Bir nechta host (masalan test yordamchisi va ilova) bo'lsa,
 * faqat birinchisi chizadi — oyna ikki marta chiqmaydi.
 */
export const registerConfirmHost = (token: symbol) => {
  update({ hosts: [...snapshot.hosts, token] });
  return () => {
    update({ hosts: snapshot.hosts.filter((host) => host !== token) });
  };
};

/** Javob: `true` — tasdiqlandi (va `onConfirm` muvaffaqiyatli tugadi), `false` — bekor qilindi. */
export const settleConfirm = (id: number, value: boolean) => {
  const resolve = resolvers.get(id);
  if (!resolve) return;
  resolvers.delete(id);
  resolve(value);
  // Navbatda kutayotgan (hali ko'rsatilmagan) so'rov darhol olib tashlanadi: u hech qachon ochilmagan,
  // yopilish harakati va `onExited` bo'lmaydi — `open: false` bilan qolsa navbat boshiga chiqib,
  // keyingi barcha `confirm()` larni to'sib qo'yardi (masalan «Orqaga» → `cancelAllConfirms`).
  const shown = snapshot.requests[0]?.id === id;
  update({
    requests: shown
      ? snapshot.requests.map((request) => (request.id === id ? { ...request, open: false } : request))
      : snapshot.requests.filter((request) => request.id !== id),
  });
};

/** Oyna yopilish harakatidan keyin navbatdan olib tashlanadi (keyingisi ochiladi). */
export const removeConfirm = (id: number) => {
  if (resolvers.has(id)) settleConfirm(id, false);
  update({ requests: snapshot.requests.filter((request) => request.id !== id) });
};

/** Barcha ochiq so'rovlarni bekor qiladi (masalan brauzer «Orqaga» — sahifa almashdi). */
export const cancelAllConfirms = () => {
  for (const request of snapshot.requests) settleConfirm(request.id, false);
};

/**
 * Tasdiqlash oynasini ochadi va javobni kutadi.
 *
 *   const ok = await confirm({
 *     tone: "danger",
 *     title: t("products.deleteTitle"),
 *     description: t("products.deleteMessage", { name }),
 *     confirmLabel: t("common.delete"),
 *     confirmIcon: Trash2,
 *     irreversible: true,
 *     onConfirm: () => deleteProduct.mutateAsync(id),
 *   });
 *
 * `ConfirmHost` topilmasa (ilova provayderidan tashqarida) — `false` va konsolda xato: tasdiqsiz amal
 * bajarilmasin.
 */
export const confirm = (options: ConfirmOptions): Promise<boolean> => {
  if (snapshot.hosts.length === 0) {
    if (import.meta.env.DEV) {
      console.error("confirm(): ConfirmHost topilmadi — `UiHost` ilova provayderida turishi kerak.");
    }
    return Promise.resolve(false);
  }
  return new Promise<boolean>((resolve) => {
    sequence += 1;
    const id = sequence;
    resolvers.set(id, resolve);
    update({ requests: [...snapshot.requests, { id, options, open: true }] });
  });
};
