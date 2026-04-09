import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { PaginationScope } from "../../features/pagination/model/paginationSlice";

interface UsePaginationOptions {
  key: PaginationScope;
  defaultPage?: number;
  defaultLimit: number;
  pageParam?: string;
  limitParam?: string;
}

const parsePositiveInt = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return Math.floor(parsed);
};

export const usePagination = ({
  key: _key,
  defaultPage = 1,
  defaultLimit,
  pageParam = "page",
  limitParam = "limit",
}: UsePaginationOptions) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawPage = searchParams.get(pageParam);
  const rawLimit = searchParams.get(limitParam);

  const page = useMemo(
    () => parsePositiveInt(rawPage) ?? defaultPage,
    [defaultPage, rawPage],
  );
  const limit = useMemo(
    () => parsePositiveInt(rawLimit) ?? defaultLimit,
    [defaultLimit, rawLimit],
  );

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
