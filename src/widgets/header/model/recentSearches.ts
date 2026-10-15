/**
 * Global qidiruvning «So'nggi qidiruvlar» ro'yxati (taxta `tizim-states-navigation` → «Qidiruv · bo'sh fokus»:
 * so'nggi 5 ta qidiruv). Faqat shu brauzerda saqlanadi — qulaylik uchun, muhim ma'lumot emas:
 * `localStorage` yopiq bo'lsa (shaxsiy oyna, bloklangan sayt ma'lumoti) ro'yxat jimgina bo'sh qoladi.
 */

export const RECENT_SEARCHES_KEY = "elchi:header:recent-searches";
export const RECENT_SEARCHES_LIMIT = 5;

const normalize = (query: string) => query.trim().replace(/\s+/g, " ");

export const readRecentSearches = (): string[] => {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string" && normalize(item).length > 0)
      .slice(0, RECENT_SEARCHES_LIMIT);
  } catch {
    return [];
  }
};

const write = (items: string[]) => {
  try {
    if (items.length === 0) window.localStorage.removeItem(RECENT_SEARCHES_KEY);
    else window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(items));
  } catch {
    // Saqlab bo'lmasa — ro'yxat shu sessiyada ham ko'rsatilmaydi, qidiruvning o'zi ishlayveradi.
  }
};

/** Qidiruvni ro'yxat boshiga qo'yadi (takror bo'lsa — ko'chiradi, katta-kichik harf farqsiz). Yangi ro'yxatni qaytaradi. */
export const rememberSearch = (query: string): string[] => {
  const value = normalize(query);
  if (!value) return readRecentSearches();
  const next = [value, ...readRecentSearches().filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(
    0,
    RECENT_SEARCHES_LIMIT,
  );
  write(next);
  return next;
};

export const clearRecentSearches = () => write([]);
