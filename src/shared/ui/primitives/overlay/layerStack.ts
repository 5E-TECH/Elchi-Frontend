import { getStackingZ } from "./layers";

/**
 * OCHIQ QATLAMLAR STEKI — Esc va tashqariga bosish faqat ENG USTDAGI qatlamga tegishli.
 *
 * Dialog ichida ro'yxat ochiq bo'lsa, Esc avval ro'yxatni yopadi (oyna qoladi); keyingi Esc —
 * oynani. Fokus qamog'i (`useFocusTrap`, eski `shared/lib/useFocusTrap` ham shu orqali) va
 * yopish (`useDismiss`) bitta stekda — eski v1 oyna ustida yangi tasdiqlash oynasi ochilsa
 * ham Esc faqat yangisini yopadi.
 *
 * «Eng ustda» = ekranda ustda turgani: element qatlamining z-index'i katta bo'lgani (`getStackingZ`),
 * teng bo'lsa — keyin ochilgani. Faqat ochilish tartibiga tayanilmaydi: bir commit'da ochilgan
 * ichma-ich qatlamlarda bolaning effekti otadan OLDIN ishlaydi.
 */
type Entry = { token: symbol; getElements?: () => ReadonlyArray<Element | null> };

const stack: Entry[] = [];

/**
 * Qatlamni stekka qo'yadi; qaytgan belgi bilan keyin olib tashlanadi.
 * `getElements` — qatlam elementlari (panel, langar); daraja — ulardan eng yuqori z-index.
 * Berilmasa faqat ochilish tartibi.
 */
export const pushLayer = (name = "layer", getElements?: () => ReadonlyArray<Element | null>): symbol => {
  const token = Symbol(name);
  stack.push({ token, getElements });
  return token;
};

export const removeLayer = (token: symbol) => {
  const index = stack.findIndex((entry) => entry.token === token);
  if (index !== -1) stack.splice(index, 1);
};

const rankOf = (entry: Entry) => {
  let rank = 0;
  for (const element of entry.getElements?.() ?? []) {
    if (element) rank = Math.max(rank, getStackingZ(element));
  }
  return rank;
};

/** Shu qatlam eng ustdami. */
export const isTopLayer = (token: symbol) => {
  let top: Entry | null = null;
  let topRank = -Infinity;
  for (const entry of stack) {
    const rank = rankOf(entry);
    // `>=` — teng qatlamda keyin ochilgani ustda.
    if (rank >= topRank) {
      top = entry;
      topRank = rank;
    }
  }
  return top?.token === token;
};

/** Ochiq qatlamlar soni (test va tashxis uchun). */
export const getOpenLayerCount = () => stack.length;
