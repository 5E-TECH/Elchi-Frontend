import { useCallback, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { orderActivityLogApi } from "../../../entities/order";
import { getApiErrorMessage } from "../../../shared/lib/apiError";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import type { ActivityLogResponse, TrackingEvent } from "../../../entities/order";

type UseOrderTrackingResult = {
  events: TrackingEvent[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  /** Xato HTTP kodi (403 — boshqa market buyurtmasi: «Qayta urinish» ma'nosiz). */
  errorStatus: number | null;
  hasMore: boolean;
  loadMore: () => void;
  /** Backend bergan jami yozuvlar soni (`total`); bermasa — `null` (sahifa yuklanganlar sonini ko'rsatadi). */
  total: number | null;
  /** Birinchi sahifani qayta so'rash (xato holatidagi «Qayta urinish»). */
  retry: () => void;
};

const DEFAULT_LIMIT = 20;
const HIDDEN_TRACKING_ACTIONS = new Set(["custody_change", "custody_changed"]);

/** React Query kaliti — buyurtma tarixi (sahifalar `useInfiniteQuery` ichida). */
export const orderTrackingQueryKey = (orderId: string | number) => ["order-tracking", String(orderId)] as const;

const sortEvents = (items: TrackingEvent[]) =>
  [...items].sort((left, right) => {
    const leftTime = new Date(left.created_at).getTime();
    const rightTime = new Date(right.created_at).getTime();

    return rightTime - leftTime;
  });

/** Faqat backend matni. Javob kelmagan (tarmoq) — bo'sh: blok `tracking.error` ni ko'rsatadi, xom "Network Error" emas. */
const getErrorMessage = (error: unknown) => getApiErrorMessage(error, "");

const normalizeEvent = (event: TrackingEvent): TrackingEvent => {
  const oldStatus = event.old_value?.status ?? event.from_status ?? undefined;
  const newStatus = event.new_value?.status ?? event.to_status ?? undefined;

  return {
    ...event,
    old_value: oldStatus ? { ...(event.old_value ?? {}), status: oldStatus } : event.old_value,
    new_value: newStatus ? { ...(event.new_value ?? {}), status: newStatus } : event.new_value,
  };
};

const normalizeAction = (value?: string | null) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

const shouldShowEvent = (event: TrackingEvent) =>
  !HIDDEN_TRACKING_ACTIONS.has(normalizeAction(event.action));

const getPayloadMeta = (payload: ActivityLogResponse | TrackingEvent[]) => {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      total: undefined,
      limit: DEFAULT_LIMIT,
    };
  }

  return {
    items: Array.isArray(payload?.data) ? payload.data : [],
    total: payload?.total,
    limit: payload?.limit ?? DEFAULT_LIMIT,
  };
};

type TrackingPage = ActivityLogResponse | TrackingEvent[];

/**
 * BUYURTMA TARIXI (`GET orders/:id/tracking`) — sahifalab («Ko'proq yuklash»), yangidan eskiga.
 *
 * - Bitta so'rov (D-18): React Query kalit bo'yicha birlashtiradi — `StrictMode` dagi ikki marta mount ham,
 *   sahifadagi qayta mount ham parallel ikkinchi so'rov yubormaydi. Amaldan keyin (sotish, bekor qilish …)
 *   sahifa blokni qayta mount qiladi — `staleTime: 0`, shuning uchun tarix qayta so'raladi.
 * - Tizim hodisalari (`changed_by_role: "system"`) O'ZGARTIRILMAYDI (D-04): ilgari aktyor qo'shni odam
 *   hodisasidan «taxmin» qilinardi (hatto 3 kun keyingisidan) va hodisa noto'g'ri odamga yozilardi; endi u
 *   «Tizim» bo'lib ko'rinadi (`describeTrackingEvent`).
 * - Xato blokning o'zida (umumiy xabar emas, qayta urinishsiz — avvalgidek; 403 da «Qayta urinish» ma'nosiz).
 */
export const useOrderTracking = (orderId: string | number, enabled = true): UseOrderTrackingResult => {
  const query = useInfiniteQuery({
    queryKey: orderTrackingQueryKey(orderId),
    queryFn: ({ pageParam }) =>
      orderActivityLogApi
        .getByOrderId(orderId, { page: pageParam, limit: DEFAULT_LIMIT })
        .then((response) => response.data as TrackingPage),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _pages, lastPageParam) => {
      const { items, total, limit } = getPayloadMeta(lastPage);
      const hasMore = typeof total === "number" ? lastPageParam * limit < total : items.length >= limit;
      return hasMore ? lastPageParam + 1 : undefined;
    },
    enabled: enabled && orderId !== "" && orderId !== null && orderId !== undefined,
    staleTime: 0,
    retry: false,
    meta: { silentError: true },
  });

  const { data, error, fetchNextPage, hasNextPage, isError, isFetching, isPending, refetch } = query;

  const events = useMemo(() => {
    const merged = (data?.pages ?? []).flatMap((page) =>
      getPayloadMeta(page).items.map(normalizeEvent).filter(shouldShowEvent),
    );
    const unique = merged.filter(
      (event, index, collection) => collection.findIndex((item) => item.id === event.id) === index,
    );
    return sortEvents(unique);
  }, [data]);

  const lastPage = data?.pages[data.pages.length - 1];
  const lastTotal = lastPage ? getPayloadMeta(lastPage).total : undefined;
  const total = typeof lastTotal === "number" && Number.isFinite(lastTotal) ? lastTotal : null;
  const isLoading = enabled && (isPending || isFetching);

  const loadMore = useCallback(() => {
    if (isFetching || !hasNextPage) return;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetching]);

  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    events: enabled ? events : [],
    isLoading,
    isError: enabled && isError,
    errorMessage: enabled && isError ? getErrorMessage(error) : "",
    errorStatus: enabled && isError ? (getErrorStatus(error) ?? null) : null,
    hasMore: enabled && Boolean(hasNextPage),
    loadMore,
    total: enabled ? total : null,
    retry,
  };
};
