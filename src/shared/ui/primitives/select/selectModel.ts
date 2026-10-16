/**
 * TANLASH RO'YXATI MANTIG'I — `Select` va `PopupSelect` uchun sof funksiyalar (DOM'siz, test qilinadi).
 *
 *   normalizeSearchText  — qidiruv uchun matn: kichik harf, o'zbekcha apostrof turlari (ʻ ʼ ‘ ’ `) → '
 *   matchesQuery         — variant qidiruvga mosmi (qism bo'yicha, registrsiz)
 *   splitMatch           — mos qismni ajratish (maket: «mos qism qalin», `<strong>`)
 *   findEnabledIndex …   — klaviatura bilan yurish: o'chirilgan variantlar o'tkazib yuboriladi
 *   findTypeaheadIndex   — yopiq/ochiq ro'yxatda harf yozib variantga o'tish (WAI-ARIA listbox type-ahead)
 */

type Navigable = { disabled?: boolean };
type Labelled = Navigable & { label: string };

/** «Oʻzbekiston», «O‘zbekiston», «O'zbekiston» — bir xil qidiriladi. */
const APOSTROPHES = new Set(["‘", "’", "ʻ", "ʼ", "`", "´"]);

/**
 * Qidiruv uchun matn. Uzunlik SAQLANADI (har belgi alohida o'zgartiriladi) — mos qismning o'rni
 * asl matnda ham shu indeksda (`splitMatch`).
 */
export const normalizeSearchText = (text: string): string => {
  let out = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (APOSTROPHES.has(char)) {
      out += "'";
      continue;
    }
    const lower = char.toLowerCase();
    out += lower.length === 1 ? lower : char;
  }
  return out;
};

/** `haystack` ichida `query` bormi (bo'sh qidiruv — hammasi mos). */
export const matchesQuery = (haystack: string, query: string): boolean => {
  const needle = normalizeSearchText(query.trim());
  if (!needle) return true;
  return normalizeSearchText(haystack).includes(needle);
};

export type TextSegment = { text: string; match: boolean };

/** Matnni birinchi mos qism bo'yicha bo'laklaydi: `[{ text: "Bar", match: true }, { text: "aka Shop", match: false }]`. */
export const splitMatch = (text: string, query: string): TextSegment[] => {
  const needle = normalizeSearchText(query.trim());
  if (!needle) return [{ text, match: false }];
  const at = normalizeSearchText(text).indexOf(needle);
  if (at < 0) return [{ text, match: false }];
  return [
    { text: text.slice(0, at), match: false },
    { text: text.slice(at, at + needle.length), match: true },
    { text: text.slice(at + needle.length), match: false },
  ].filter((segment) => segment.text.length > 0);
};

/**
 * `start` dan `step` yo'nalishida birinchi faol (o'chirilmagan) variant. `wrap` — oxiridan boshiga
 * aylanadi (↑ ↓); `false` — chegarada to'xtaydi (Home / End, PageUp / PageDown). Topilmasa `-1`.
 */
export const findEnabledIndex = (items: ReadonlyArray<Navigable>, start: number, step: 1 | -1, wrap = true): number => {
  const count = items.length;
  if (!count) return -1;
  for (let offset = 0; offset < count; offset += 1) {
    let index = start + offset * step;
    if (wrap) index = ((index % count) + count) % count;
    else if (index < 0 || index >= count) return -1;
    if (!items[index]?.disabled) return index;
  }
  return -1;
};

export const firstEnabledIndex = (items: ReadonlyArray<Navigable>) => findEnabledIndex(items, 0, 1, false);
export const lastEnabledIndex = (items: ReadonlyArray<Navigable>) => findEnabledIndex(items, items.length - 1, -1, false);

/** Keyingi / oldingi faol variant (aylanma). Hech narsa tanlanmagan bo'lsa (`-1`) — birinchi / oxirgi. */
export const stepIndex = (items: ReadonlyArray<Navigable>, current: number, step: 1 | -1): number => {
  if (current < 0) return step > 0 ? firstEnabledIndex(items) : lastEnabledIndex(items);
  return findEnabledIndex(items, current + step, step, true);
};

/** PageUp / PageDown: `size` qadam, chegarada to'xtaydi; o'chirilgan variantga tushsa — yaqinidagi faol. */
export const pageIndex = (items: ReadonlyArray<Navigable>, current: number, step: 1 | -1, size = 10): number => {
  const count = items.length;
  if (!count) return -1;
  const target = current < 0 ? (step > 0 ? 0 : count - 1) : Math.min(count - 1, Math.max(0, current + step * size));
  const ahead = findEnabledIndex(items, target, step, false);
  return ahead >= 0 ? ahead : findEnabledIndex(items, target, step > 0 ? -1 : 1, false);
};

/**
 * Type-ahead: yozilgan harflar bilan BOSHLANADIGAN birinchi faol variant (joriydan keyin, aylanma).
 * Bitta harf (yoki bir xil harf qayta-qayta: «sss») — har bosishda keyingi mos variant; bir nechta harf
 * («sam») — joriy variant hali mos bo'lsa, o'sha qoladi.
 */
export const findTypeaheadIndex = (items: ReadonlyArray<Labelled>, buffer: string, current: number): number => {
  const typed = normalizeSearchText(buffer);
  const count = items.length;
  if (!typed || !count) return -1;
  const repeated = typed.split("").every((char) => char === typed[0]);
  const needle = repeated ? typed[0] : typed;
  const start = repeated || current < 0 ? current + 1 : current;
  for (let offset = 0; offset < count; offset += 1) {
    const index = (((start + offset) % count) + count) % count;
    const item = items[index];
    if (!item.disabled && normalizeSearchText(item.label).startsWith(needle)) return index;
  }
  return -1;
};

/** Bosilgan tugma matn harfimi (type-ahead / qidiruv uchun): bitta belgi, Ctrl/Cmd/Alt'siz. */
export const isPrintableKey = (event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }) =>
  event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
