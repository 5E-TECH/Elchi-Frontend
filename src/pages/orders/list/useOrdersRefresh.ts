import { useCallback, useEffect, useRef, useState } from "react";
import { useScannerCameraMounted } from "../../../shared/lib/scanner";
import { SKELETON_DELAY_MS, useDelayedFlag } from "../../../shared/ui/primitives/useLoadingPhase";

/**
 * «BUYURTMALAR» RO'YXATINI YANGILASH (OR-1; ega javoblari orders-refresh S1–S4, 2026-10-19).
 *
 *  - Avtomatik: har 60 s (faqat ko'rinadigan brauzer tabida — `refetchIntervalInBackground: false`, TanStack
 *    sukuti) va ilovaga qaytganda (`refetchOnWindowFocus` — faqat shu so'rovlarda, global sukut `false`). Qaytganda
 *    so'rov faqat ma'lumot eskirgan bo'lsa ketadi (global `staleTime` 30 s, `app/lib/provider.tsx`): 30 s ichida
 *    qaytilsa — qayta so'ralmaydi.
 *  - Qo'shimcha xarajat tasdig'i kutilayotgan bo'lsa 30 s lik polling bilan birlashadi (kichigi).
 *  - Oyna (sotish / bekor / qaytarish) yoki kamera ochiq bo'lsa avtomatik yangilanish to'xtaydi — ostidagi qator
 *    o'zgarib ketmaydi; tasdiq pollingi (oyna «Tasdiq kutilmoqda» holatida) esa davom etadi.
 *  - «Oxirgi yangilanish» — ro'yxat so'rovining `dataUpdatedAt` i (oxirgi muvaffaqiyatli javob).
 *  - «Yangilanmoqda…» belgisi va tugmalar `loading` i fon so'rovi 400 ms dan uzoq cho'zilsagina (taxta
 *    `tizim-loading` 11-naqsh) — filtr/sahifa almashganda (oldingi ma'lumot ko'rsatilayotganda) emas.
 *  - Yangilash yiqilsa va ro'yxat bor bo'lsa — eski qatorlar qoladi, ustida «Ro'yxat yangilanmadi» (× bilan
 *    yopiladi, S3). Yopilgan ogohlantirish keyingi muvaffaqiyatli yangilanishgacha qaytmaydi (har daqiqadagi
 *    avtomatik urinish uni qayta-qayta ochmasin); qo'lda «Yangilash» dan keyin esa — faqat o'sha urinish ham
 *    yiqilsa (so'rov ketayotganda eski xato qayta ko'rinmaydi).
 *  - `refreshAll()` — ro'yxat, tab sonlari va qadalgan (raqam bo'yicha aniq topilgan) buyurtma birga (S4).
 */

export const ORDERS_REFRESH_INTERVAL_MS = 60_000;

/**
 * «Yangilash» tugmalari belgisi (`data-orders-refresh`, `OrdersRefreshMeta`): ogohlantirish yopilganda fokus
 * ko'rinadigan biriga qaytadi (`OrdersRefreshAlert`).
 */
export const ORDERS_REFRESH_BUTTON_SELECTOR = "[data-orders-refresh]";

/**
 * Ro'yxat so'rovining `refetchInterval` i. `approvalPoll` — tasdiq pollingi (`pollWhileApprovalPending`):
 * u to'xtatilgan (oyna ochiq) holatda ham ishlaydi — oyna aynan tasdiq natijasini kutadi.
 */
export const getOrdersRefetchInterval = (paused: boolean, approvalPoll: number | false = false): number | false => {
  if (paused) return approvalPoll;
  return approvalPoll === false ? ORDERS_REFRESH_INTERVAL_MS : Math.min(approvalPoll, ORDERS_REFRESH_INTERVAL_MS);
};

/** Avtomatik yangilanish to'xtatilganmi: sahifadagi oyna ochiq yoki skaner kamerasi shu sahifa ustida. */
export const useOrdersRefreshPaused = (dialogOpen: boolean) => {
  const cameraOpen = useScannerCameraMounted();
  return dialogOpen || cameraOpen;
};

/** `useQuery` natijasidan kerakli qism (testda oddiy ob'ekt ham bo'ladi). */
export type RefreshableQuery = {
  data: unknown;
  dataUpdatedAt: number;
  /** Oxirgi xato vaqti (`useQuery` beradi) — yopilgan ogohlantirishni yangi xatodan ajratish uchun. */
  errorUpdatedAt?: number;
  isFetching: boolean;
  isError: boolean;
  isPlaceholderData?: boolean;
  refetch: () => Promise<unknown>;
};

export type OrdersRefreshState = {
  /** Oxirgi muvaffaqiyatli yuklash vaqti (ms); ma'lumot yo'q bo'lsa `0`. */
  lastUpdatedAt: number;
  /** Fon yangilanishi 400 ms dan uzoq: badge, tugmalar `loading`, tab sonlari xira. */
  refreshing: boolean;
  /** «Ro'yxat yangilanmadi» ko'rinadimi (ma'lumot bor, oxirgi yangilash yiqilgan, yopilmagan). */
  errorVisible: boolean;
  /** Ro'yxat so'rovi hozir ketmoqda («Qayta urinish» tugmasi band). */
  fetching: boolean;
  /** × — ogohlantirishni yopish. */
  dismissError: () => void;
  /** «Yangilash» / «Qayta urinish»: ro'yxat + qo'shimcha so'rovlar (tab sonlari, qadalgan buyurtma). */
  refreshAll: () => Promise<void>;
};

export const useOrdersRefresh = ({
  list,
  extras = [],
}: {
  list: RefreshableQuery;
  /** Birga yangilanadigan so'rovlar (yoqilmagani — `null`). */
  extras?: readonly (Pick<RefreshableQuery, "refetch"> | null | false | undefined)[];
}): OrdersRefreshState => {
  const hasData = list.data !== undefined && list.data !== null;
  const background = hasData && list.isFetching && !list.isPlaceholderData;
  const refreshing = useDelayedFlag(background, SKELETON_DELAY_MS);

  // Yopilganda qaysi ma'lumot va qaysi xato ko'rsatilayotgan edi. Avtomatik urinishlarda — shu ma'lumot turguncha
  // yashirin; qo'lda «Yangilash» dan keyin (`manual`) — faqat yangi xato (`errorUpdatedAt` boshqa) ko'rsatadi.
  const [dismissed, setDismissed] = useState<{ dataAt: number; errorAt: number; manual: boolean } | null>(null);
  const hidden =
    dismissed !== null &&
    (dismissed.manual
      ? (list.errorUpdatedAt ?? 0) === dismissed.errorAt
      : list.dataUpdatedAt === dismissed.dataAt);
  const errorVisible = hasData && list.isError && !hidden;

  // So'nggi so'rovlar — barqaror `refreshAll` / `dismissError` ichida o'qiladi (chizishdan keyin yoziladi).
  const latest = useRef({ list, extras });
  useEffect(() => {
    latest.current = { list, extras };
  });

  const dismissError = useCallback(() => {
    const current = latest.current.list;
    setDismissed({ dataAt: current.dataUpdatedAt, errorAt: current.errorUpdatedAt ?? 0, manual: false });
  }, []);

  const refreshAll = useCallback(async () => {
    const { list: current, extras: more } = latest.current;
    // Bosilgan paytdagi xato «ko'rilgan» deb yoziladi: yopilgandan keyin avtomatik urinishlar yangi xato bergan
    // bo'lsa ham, so'rov ketayotganda ogohlantirish qaytmaydi — faqat SHU urinish yiqilsa (yangi `errorUpdatedAt`).
    const currentErrorAt = current.errorUpdatedAt ?? 0;
    setDismissed((previous) => (previous ? { ...previous, manual: true, errorAt: currentErrorAt } : previous));
    const queries = [current, ...more].filter((query): query is Pick<RefreshableQuery, "refetch"> => Boolean(query));
    await Promise.allSettled(queries.map((query) => query.refetch()));
  }, []);

  return {
    lastUpdatedAt: hasData ? list.dataUpdatedAt : 0,
    refreshing,
    errorVisible,
    fetching: list.isFetching,
    dismissError,
    refreshAll,
  };
};
