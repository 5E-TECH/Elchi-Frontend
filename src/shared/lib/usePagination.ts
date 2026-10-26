import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/** Qaysi ro'yxatning sahifalashi. Holat faqat URL'da (`?page=&limit=`) — Redux'da sahifalash yo'q (iR4B6hcP). */
export type PaginationScope = "orders" | "products" | "users" | "payments" | "mails" | "batches" | "returns";

interface UsePaginationOptions {
  key: PaginationScope;
  defaultPage?: number;
  defaultLimit: number;
  pageParam?: string;
  limitParam?: string;
  /**
   * Backend qabul qiladigan `limit` qiymatlari (masalan `GET /orders` — 10, 25, 50, 100). Berilsa, URL'dagi
   * boshqa qiymat (`?limit=5000`) e'tiborsiz qoldiriladi va `defaultLimit` ishlatiladi — aks holda so'rov 400
   * bilan yiqilib, sahifa hech qachon o'tmaydigan xatoda qolardi. Berilmasa — avvalgidek har musbat butun son.
   */
  allowedLimits?: readonly number[];
}

const parsePositiveInt = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return Math.floor(parsed);
};

/** Karta boshi shell chetiga yopishmasin — sahifa bo'limlari oralig'i (`gap-4`). */
const ANCHOR_GAP_PX = 16;

/**
 * Sahifa almashganda (ro'yxatning «2-sahifa» si) shell kontentini tepaga qaytaradi. Shell'ning yagona skroll
 * konteyneri — `[data-shell-slot=content]` ning ota-onasi `<main>` (`widgets/layout/dashboardLayout.tsx`);
 * shell o'zi faqat yo'l (`pathname`) o'zgarganda tepaga qaytaradi, `?page=` da esa joyida qoldiradi.
 * Shell'dan tashqarida (testlar, alohida sahifa) hech narsa qilmaydi.
 *
 * `anchor` — ro'yxat sahifaning pastida turganda (Moliya: KPI / balans / forma ostidagi tarix): sahifa boshiga
 * emas, ro'yxat kartasining boshiga qaytadi, va faqat karta boshi ekrandan yuqorida qolgan bo'lsa (ko'rinib
 * turgan ro'yxat sakramaydi).
 */
export const scrollShellContentToTop = (anchor?: Element | null) => {
  if (typeof document === "undefined") return;
  const slot = document.querySelector<HTMLElement>('[data-shell-slot="content"]');
  const scroller = slot?.closest<HTMLElement>("main") ?? slot?.parentElement ?? null;
  if (!scroller || scroller.scrollTop <= 0) return;
  if (!anchor || !scroller.contains(anchor)) {
    scroller.scrollTop = 0;
    return;
  }
  const offset = anchor.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  if (offset < 0) scroller.scrollTop = Math.max(0, scroller.scrollTop + offset - ANCHOR_GAP_PX);
};

export const usePagination = ({
  defaultPage = 1,
  defaultLimit,
  pageParam = "page",
  limitParam = "limit",
  allowedLimits,
}: UsePaginationOptions) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawPage = searchParams.get(pageParam);
  const rawLimit = searchParams.get(limitParam);

  const page = useMemo(
    () => parsePositiveInt(rawPage) ?? defaultPage,
    [defaultPage, rawPage],
  );
  const limit = useMemo(() => {
    const parsed = parsePositiveInt(rawLimit);
    if (parsed === null) return defaultLimit;
    return allowedLimits && !allowedLimits.includes(parsed) ? defaultLimit : parsed;
  }, [allowedLimits, defaultLimit, rawLimit]);

  const updatePagination = useCallback(
    (
      nextPage?: number,
      nextLimit?: number,
      options?: {
        preserveExistingLimit?: boolean;
      },
    ) => {
      setSearchParams((prev) => {
        const nextParams = new URLSearchParams(prev);
        const preserveExistingLimit = options?.preserveExistingLimit ?? false;
        let hasChanges = false;

        if (typeof nextPage === "number") {
          const targetPage = Math.max(1, Math.floor(nextPage));
          if (nextParams.get(pageParam) !== String(targetPage)) {
            nextParams.set(pageParam, String(targetPage));
            hasChanges = true;
          }
        }

        if (typeof nextLimit === "number") {
          const targetLimit = Math.max(1, Math.floor(nextLimit));
          if (nextParams.get(limitParam) !== String(targetLimit)) {
            nextParams.set(limitParam, String(targetLimit));
            hasChanges = true;
          }
        } else if (preserveExistingLimit && nextParams.has(limitParam) && nextParams.get(limitParam) !== String(limit)) {
          nextParams.set(limitParam, String(limit));
          hasChanges = true;
        }

        return hasChanges ? nextParams : prev;
      }, { replace: true });
    },
    [limit, limitParam, pageParam, setSearchParams],
  );

  const setPage = useCallback(
    (nextPage: number) => updatePagination(nextPage),
    [updatePagination],
  );

  const setLimit = useCallback(
    (nextLimit: number) => updatePagination(1, nextLimit),
    [updatePagination],
  );

  const resetPagination = useCallback(
    (nextLimit?: number) => {
      const targetLimit = Math.max(1, Math.floor(nextLimit ?? defaultLimit));

      setSearchParams((prev) => {
        const nextParams = new URLSearchParams(prev);
        const hasPageParam = nextParams.has(pageParam);
        const hasLimitParam = nextParams.has(limitParam);
        let hasChanges = false;

        if (hasPageParam && nextParams.get(pageParam) !== "1") {
          nextParams.set(pageParam, "1");
          hasChanges = true;
        }

        if (hasLimitParam && nextParams.get(limitParam) !== String(targetLimit)) {
          nextParams.set(limitParam, String(targetLimit));
          hasChanges = true;
        }

        return hasChanges ? nextParams : prev;
      }, { replace: true });
    },
    [defaultLimit, limitParam, pageParam, setSearchParams],
  );

  return {
    page,
    limit,
    setPage,
    setLimit,
    resetPagination,
  };
};
