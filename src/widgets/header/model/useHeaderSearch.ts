import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalSearch } from "../../../features/search/api/useGlobalSearch";
import { extractScannerToken } from "../../../shared/lib/scanToken";
import { clearRecentSearches, readRecentSearches, rememberSearch } from "./recentSearches";
import { groupSearchEntries, toSearchEntry, type SearchEntry, type SearchGroup } from "./searchEntry";

/**
 * GLOBAL QIDIRUV HOLATI — desktopdagi maydon va planshet/telefondagi qidiruv ekrani bitta holatdan o'qiydi
 * (taxta `tizim-states-navigation` → «Yuqori panel», `courier-dashboard-mobile-search`).
 *
 *   - yozish to'xtagach 0,4 soniyadan keyin so'raladi (maket: «yozish to'xtagach 0,4 soniyadan keyin»);
 *   - natijalar guruhlanadi (buyurtmalar → foydalanuvchilar → boshqa), ro'yxat oxiriga yetganda yana 10 ta;
 *   - maydon bo'sh va fokusda — «So'nggi qidiruvlar» (5 ta, shu brauzerda);
 *   - klaviatura: ↑ ↓ tanlash, Enter ochish, Esc yopish (`aria-activedescendant`).
 *   - QR havolasi (`…/scan/<token>`) qo'yilsa — token qidiriladi (eski `GlobalSearchInput` xulqi).
 */

export const SEARCH_DEBOUNCE_MS = 400;
const PAGE_SIZE = 10;

export type SearchOption =
  | { type: "recent"; id: string; query: string }
  | { type: "entry"; id: string; entry: SearchEntry };

export type SearchView = "closed" | "recent" | "loading" | "error" | "empty" | "results";

const normalizeQuery = (value: string) => {
  if (!value.includes("/scan/") || typeof window === "undefined") return value;
  const token = extractScannerToken(value, window.location.origin);
  return token && token.length >= 6 ? token : value;
};

export const useHeaderSearch = (idPrefix: string) => {
  const navigate = useNavigate();
  const [query, setQueryState] = useState("");
  const [debounced, setDebounced] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState<string[]>(() => readRecentSearches());

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const enabled = debounced.length > 0;
  const { data, isFetching, isError, isPlaceholderData } = useGlobalSearch({ q: debounced, page: 1, limit }, enabled);

  const items = useMemo(() => (enabled ? (data?.items ?? []) : []), [data?.items, enabled]);
  const total = data?.meta.total ?? 0;
  const hasMore = enabled && items.length < total;
  const entries = useMemo(() => items.map(toSearchEntry), [items]);
  const groups: SearchGroup[] = useMemo(() => groupSearchEntries(entries), [entries]);

  const trimmed = query.trim();
  /** Yozilgan, lekin hali so'ralmagan yoki javob kutilmoqda — maydon ichida spinner. */
  const pending = trimmed.length > 0 && (trimmed !== debounced || isFetching);

  const view: SearchView = !open
    ? "closed"
    : !trimmed
      ? recent.length > 0
        ? "recent"
        : "closed"
      : entries.length > 0
        ? "results"
        : isError && !isFetching
          ? "error"
          : pending
            ? "loading"
            : "empty";

  const options: SearchOption[] = useMemo(() => {
    if (view === "recent") {
      return recent.map((item, index) => ({ type: "recent" as const, id: `${idPrefix}-recent-${index}`, query: item }));
    }
    if (view === "results") {
      return groups.flatMap((group) =>
        group.entries.map((entry, index) => ({
          type: "entry" as const,
          id: `${idPrefix}-${group.kind}-${index}`,
          entry,
        })),
      );
    }
    return [];
  }, [groups, idPrefix, recent, view]);

  // Ro'yxat o'zgarsa tanlov chegaradan chiqmasin.
  const boundedActive = activeIndex < options.length ? activeIndex : -1;

  const setQuery = useCallback((value: string) => {
    setQueryState(normalizeQuery(value));
    setLimit(PAGE_SIZE);
    setActiveIndex(-1);
    setOpen(true);
  }, []);

  const clear = useCallback(() => {
    setQueryState("");
    setDebounced("");
    setLimit(PAGE_SIZE);
    setActiveIndex(-1);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const loadMore = useCallback(() => {
    if (!hasMore || isFetching) return;
    setLimit((previous) => Math.min(previous + PAGE_SIZE, Math.max(total, previous + PAGE_SIZE)));
  }, [hasMore, isFetching, total]);

  const clearRecent = useCallback(() => {
    clearRecentSearches();
    setRecent([]);
  }, []);

  /**
   * Tanlash: so'nggi qidiruv — maydonga qo'yiladi; natija — eslab qolinadi, sahifaga o'tiladi, ro'yxat yopiladi.
   * `true` — qidiruv yopilishi kerak (qidiruv ekrani ham).
   */
  const choose = useCallback(
    (option: SearchOption): boolean => {
      if (option.type === "recent") {
        setQueryState(option.query);
        setDebounced(option.query);
        setLimit(PAGE_SIZE);
        setActiveIndex(-1);
        setOpen(true);
        return false;
      }
      setRecent(rememberSearch(query));
      setOpen(false);
      setActiveIndex(-1);
      if (option.entry.href) navigate(option.entry.href);
      return true;
    },
    [navigate, query],
  );

  /** Maydondagi klaviatura. `true` qaytsa — hodisa ishlatildi. */
  const handleKey = useCallback(
    (key: string): "handled" | "chosen" | "escape" | null => {
      if (key === "ArrowDown" || key === "ArrowUp") {
        if (!open) {
          setOpen(true);
          return "handled";
        }
        if (options.length === 0) return "handled";
        const step = key === "ArrowDown" ? 1 : -1;
        const start = boundedActive === -1 ? (step === 1 ? -1 : 0) : boundedActive;
        setActiveIndex((start + step + options.length) % options.length);
        return "handled";
      }
      if (key === "Home" && open && options.length > 0 && boundedActive !== -1) {
        setActiveIndex(0);
        return "handled";
      }
      if (key === "End" && open && options.length > 0 && boundedActive !== -1) {
        setActiveIndex(options.length - 1);
        return "handled";
      }
      if (key === "Enter") {
        const option = options[boundedActive] ?? (view === "results" ? options[0] : undefined);
        if (!option) return null;
        return choose(option) ? "chosen" : "handled";
      }
      if (key === "Escape") {
        if (open && view !== "closed") {
          close();
          return "handled";
        }
        return "escape";
      }
      return null;
    },
    [boundedActive, choose, close, open, options, view],
  );

  return {
    query,
    setQuery,
    clear,
    open,
    setOpen,
    close,
    view,
    pending,
    groups,
    options,
    activeIndex: boundedActive,
    setActiveIndex,
    activeId: options[boundedActive]?.id,
    hasMore,
    // Yangi qidiruvda `limit` boshlang'ich qiymatga qaytadi — kattaroq `limit` bilan kutish = shu so'rovning davomi.
    loadingMore: isFetching && isPlaceholderData && limit > PAGE_SIZE && entries.length > 0,
    loadMore,
    recent,
    clearRecent,
    choose,
    handleKey,
    total,
  };
};

export type HeaderSearchState = ReturnType<typeof useHeaderSearch>;
