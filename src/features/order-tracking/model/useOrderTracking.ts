import { useCallback, useEffect, useRef, useState } from "react";
import type { AxiosError } from "axios";
import { orderActivityLogApi } from "../../../entities/order";
import type { ActivityLogResponse, TrackingEvent } from "../../../entities/order";

type UseOrderTrackingResult = {
  events: TrackingEvent[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  hasMore: boolean;
  loadMore: () => void;
};

const DEFAULT_LIMIT = 20;

const sortEvents = (items: TrackingEvent[]) =>
  [...items].sort((left, right) => {
    const leftTime = new Date(left.created_at).getTime();
    const rightTime = new Date(right.created_at).getTime();

    return rightTime - leftTime;
  });

const getErrorMessage = (error: unknown) => {
  const axiosError = error as AxiosError<{ message?: string; error?: string }>;
  return axiosError.response?.data?.message ?? axiosError.response?.data?.error ?? axiosError.message ?? "";
};

const normalizeEvent = (event: TrackingEvent): TrackingEvent => {
  const oldStatus = event.old_value?.status ?? event.from_status ?? undefined;
  const newStatus = event.new_value?.status ?? event.to_status ?? undefined;

  return {
    ...event,
    old_value: oldStatus ? { ...(event.old_value ?? {}), status: oldStatus } : event.old_value,
    new_value: newStatus ? { ...(event.new_value ?? {}), status: newStatus } : event.new_value,
  };
};

const getPayloadMeta = (payload: ActivityLogResponse | TrackingEvent[]) => {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      total: undefined,
      limit: DEFAULT_LIMIT,
    };
  }

  return {
    items: Array.isArray(payload.data) ? payload.data : [],
    total: payload.total,
    limit: payload.limit ?? DEFAULT_LIMIT,
  };
};

export const useOrderTracking = (orderId: string | number): UseOrderTrackingResult => {
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const requestIdRef = useRef(0);

  const fetchPage = useCallback(
    async (nextPage: number, replace: boolean) => {
      const currentRequestId = ++requestIdRef.current;

      setIsLoading(true);
      setIsError(false);
      setErrorMessage("");

      try {
        const response = await orderActivityLogApi.getByOrderId(orderId, {
          page: nextPage,
          limit: DEFAULT_LIMIT,
        });
        const payload = response.data;
        const { items, total, limit } = getPayloadMeta(payload);
        const incomingEvents = items.map(normalizeEvent);

        if (requestIdRef.current !== currentRequestId) {
          return;
        }

        setEvents((previousEvents) => {
          const mergedEvents = replace ? incomingEvents : [...previousEvents, ...incomingEvents];
          const uniqueEvents = mergedEvents.filter(
            (event, index, collection) =>
              collection.findIndex((item) => item.id === event.id) === index,
          );

          return sortEvents(uniqueEvents);
        });

        setPage(nextPage);

        const resolvedHasMore =
          typeof total === "number"
            ? nextPage * limit < total
            : incomingEvents.length >= limit;

        setHasMore(resolvedHasMore);
      } catch (error) {
        if (requestIdRef.current !== currentRequestId) {
          return;
        }

        setIsError(true);
        setErrorMessage(getErrorMessage(error));

        if (replace) {
          setEvents([]);
          setHasMore(false);
        }
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setIsLoading(false);
        }
      }
    },
    [orderId],
  );

  useEffect(() => {
    setEvents([]);
    setPage(1);
    setHasMore(false);
    void fetchPage(1, true);
  }, [fetchPage, orderId]);

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) {
      return;
    }

    void fetchPage(page + 1, false);
  }, [fetchPage, hasMore, isLoading, page]);

  return { events, isLoading, isError, errorMessage, hasMore, loadMore };
};
