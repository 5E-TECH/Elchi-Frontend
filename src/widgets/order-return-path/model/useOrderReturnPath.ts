import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  orderActivityLogApi,
  resolveCancelReturnStage,
  type ActivityLogResponse,
  type TrackingEvent,
} from "../../../entities/order";
import { buildReturnPath, type ReturnPath } from "./returnPath";

/** Backend `GET orders/:id/tracking` bir sahifada ko'pi bilan 100 ta (`Math.min(100, limit)`). */
const RETURN_PATH_LIMIT = 100;

export const orderReturnPathQueryKey = (orderId: string | number, version = 0) =>
  ["order-return-path", String(orderId), version] as const;

const readEvents = (
  payload: ActivityLogResponse | TrackingEvent[] | undefined,
): TrackingEvent[] => {
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.data) ? payload.data : [];
};

export interface UseOrderReturnPathResult {
  /** Bekor bo'lmagan buyurtma — `null` (karta chizilmaydi, so'rov ketmaydi). */
  path: ReturnPath | null;
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
}

/**
 * «Qaytarish yo'li» ma'lumoti: buyurtma bekor bosqichida bo'lsagina tarix so'raladi (100 ta, bitta sahifa —
 * bekor zanjiri 10 tadan oshmaydi). Sahifa sarlavhasi (usul) va karta bir xil kalitni ishlatadi — so'rov bitta.
 * Tarix kelmaguncha (yoki xato bo'lsa) ham bosqich va «kutilmoqda» qadami buyurtmaning o'zidan chiziladi.
 */
export const useOrderReturnPath = (
  order: { id?: string | number | null } | null | undefined,
  options: {
    hqName?: string | null;
    /** Amaldan keyin (topshirish, qaytarish) sahifa oshiradi — tarix qayta so'raladi. */
    version?: number;
    /** `false` — karta chizilmaydigan joy (kuryer tafsiloti): so'rov ketmaydi, `path` — `null`. */
    enabled?: boolean;
  } = {},
): UseOrderReturnPathResult => {
  const orderId = order?.id !== null && order?.id !== undefined ? String(order.id) : "";
  const stage = resolveCancelReturnStage(order);
  const enabled = (options.enabled ?? true) && Boolean(orderId) && stage !== null;
  const query = useQuery({
    queryKey: orderReturnPathQueryKey(orderId, options.version ?? 0),
    queryFn: () =>
      orderActivityLogApi
        .getByOrderId(orderId, { page: 1, limit: RETURN_PATH_LIMIT })
        .then((response) => response.data as ActivityLogResponse | TrackingEvent[]),
    enabled,
    staleTime: 0,
    retry: false,
    meta: { silentError: true },
  });

  const events = useMemo(() => readEvents(query.data), [query.data]);
  const path = useMemo(
    () => (enabled ? buildReturnPath(events, order, { hqName: options.hqName }) : null),
    [enabled, events, order, options.hqName],
  );

  return {
    path,
    isLoading: enabled && query.isPending,
    isError: enabled && query.isError,
    retry: () => void query.refetch(),
  };
};
