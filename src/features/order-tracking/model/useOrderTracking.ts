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
const HIDDEN_TRACKING_ACTIONS = new Set(["custody_change", "custody_changed"]);

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

const normalizeAction = (value?: string | null) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

const shouldShowEvent = (event: TrackingEvent) =>
  !HIDDEN_TRACKING_ACTIONS.has(normalizeAction(event.action));

const getSystemStatusActorInferenceMode = (event: TrackingEvent) => {
  const oldStatus = normalizeAction(event.old_value?.status ?? event.from_status);
  const newStatus = normalizeAction(event.new_value?.status ?? event.to_status);
  const transition = `${oldStatus}->${newStatus}`;

  if (transition === "new->received") return "nearby";
  if (transition === "on_the_road->waiting") return "next";

  return null;
};

const isSystemActor = (event: TrackingEvent) => {
  const actorName = normalizeAction(event.actor?.name ?? event.actor?.username);
  const actorRole = normalizeAction(event.actor?.role);
  const changedByRole = normalizeAction(event.changed_by_role);

  return actorName === "system" || actorRole === "system" || changedByRole === "system";
};

const isHumanActor = (event: TrackingEvent) => {
  const actorName = normalizeAction(event.actor?.name ?? event.actor?.username ?? event.user_name);
  const actorRole = normalizeAction(event.actor?.role ?? event.changed_by_role);

  return Boolean(actorName && actorName !== "system" && actorRole && actorRole !== "system");
};

const withInferredActor = (event: TrackingEvent, source: TrackingEvent): TrackingEvent => ({
  ...event,
  changed_by: source.changed_by,
  changed_by_role: source.actor?.role ?? source.changed_by_role,
  actor: source.actor ?? event.actor,
  user_name: source.user_name,
});

const inferSystemStatusActors = (items: TrackingEvent[]) => {
  const chronologicalEvents = [...items].sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
  );

  return chronologicalEvents.map((event, index) => {
    const inferenceMode = getSystemStatusActorInferenceMode(event);

    if (!inferenceMode || !isSystemActor(event)) {
      return event;
    }

    const nextHumanEvent = chronologicalEvents.slice(index + 1).find(isHumanActor);

    if (nextHumanEvent || inferenceMode === "next") {
      return nextHumanEvent ? withInferredActor(event, nextHumanEvent) : event;
    }

    const previousHumanEvent = chronologicalEvents
      .slice(0, index)
      .reverse()
      .find(isHumanActor);

    return previousHumanEvent ? withInferredActor(event, previousHumanEvent) : event;
  });
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

export const useOrderTracking = (orderId: string | number, enabled = true): UseOrderTrackingResult => {
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

      if (!enabled) {
        setIsLoading(false);
        return;
      }

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
        const incomingEvents = items.map(normalizeEvent).filter(shouldShowEvent);

        if (requestIdRef.current !== currentRequestId) {
          return;
        }

        setEvents((previousEvents) => {
          const mergedEvents = replace ? incomingEvents : [...previousEvents, ...incomingEvents];
          const uniqueEvents = mergedEvents.filter(
            (event, index, collection) =>
              collection.findIndex((item) => item.id === event.id) === index,
          );

          return sortEvents(inferSystemStatusActors(uniqueEvents));
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
    [enabled, orderId],
  );

  useEffect(() => {
    setEvents([]);
    setPage(1);
    setHasMore(false);

    if (!enabled) {
      setIsLoading(false);
      setIsError(false);
      setErrorMessage("");
      return;
    }

    void fetchPage(1, true);
  }, [enabled, fetchPage, orderId]);

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) {
      return;
    }

    void fetchPage(page + 1, false);
  }, [fetchPage, hasMore, isLoading, page]);

  return { events, isLoading, isError, errorMessage, hasMore, loadMore };
};
