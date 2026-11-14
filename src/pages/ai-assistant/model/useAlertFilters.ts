import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  applyAlertSearch,
  cleanAlertSearch,
  EMPTY_ALERT_FILTERS,
  readAlertSearch,
  type AlertSearchPatch,
} from "./alertFilters";

/**
 * «Ogohlantirishlar» filtrlari va sahifasi — URL yagona manba (`alertFilters.ts`). Hamma o'zgarish `replace` bilan
 * (filtr tarixni to'ldirmaydi; oyna ochish — alohida, `push`). Noto'g'ri qiymatlar birinchi chizishda URL'dan
 * olib tashlanadi. `clampPage` — javobdan keyin sahifa oxirgisidan katta bo'lsa (qatorlar kamaygan yoki eski havola).
 */
export const useAlertFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = useMemo(() => readAlertSearch(searchParams), [searchParams]);

  useEffect(() => {
    const cleaned = cleanAlertSearch(searchParams);
    if (cleaned) setSearchParams(cleaned, { replace: true });
  }, [searchParams, setSearchParams]);

  const update = useCallback(
    (patch: AlertSearchPatch) => setSearchParams((current) => applyAlertSearch(current, patch), { replace: true }),
    [setSearchParams],
  );

  const clear = useCallback(() => update(EMPTY_ALERT_FILTERS), [update]);

  /** Oxirgi sahifadan tashqarida — mavjud oxirgi sahifaga (`totalPages` 0 bo'lsa — 1). */
  const clampPage = useCallback(
    (totalPages: number) => {
      const last = Math.max(1, totalPages);
      if (search.page > last) update({ page: last });
    },
    [search.page, update],
  );

  return { ...search, searchParams, update, clear, clampPage };
};
