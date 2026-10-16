/**
 * Eski (v1) tanlash ro'yxatlarining namuna matni qoidasi — `SearchableSelect` va `FilterSelect` o'ramlari uchun.
 *
 * Sahifalar namuna sifatida ko'pincha «Barchasi» / «Все» / «All» beradi (filtr bo'sh = hammasi). Yorliq
 * yashirin bo'lsa, maydonda yolg'iz «Barchasi» nima ekani tushunarsiz — shuning uchun u
 * «Tanlang <yorliq>» ko'rinishiga keltiriladi («Tanlang market»). Boshqa namuna matni o'zgarmaydi.
 */
const ALL_WORDS = ["all", "barchasi", "все"];
const ALL_PREFIXES = ["all ", "barcha ", "все "];

export const isAllPlaceholder = (placeholder: string): boolean => {
  const normalized = placeholder.trim().toLowerCase();
  return ALL_WORDS.includes(normalized) || ALL_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

/** `selectWord` — `common:select` («Tanlang» / «Выберите» / «Select»). */
export const resolveSelectPlaceholder = (placeholder: string, label: string, selectWord: string): string =>
  isAllPlaceholder(placeholder) ? `${selectWord} ${label.toLowerCase()}` : placeholder;
