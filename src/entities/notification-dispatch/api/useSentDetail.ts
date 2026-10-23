import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { isDispatchLive } from "../model/status";
import type { SentDetailParams } from "../model/types";
import { getSentDetail } from "./sentApi";

/** Yuborish tugaguncha (yoki kanal navbatda turguncha) tafsilot shu oraliqda yangilanadi. */
export const SENT_DETAIL_LIVE_INTERVAL_MS = 5_000;

type UseSentDetailOptions = {
  enabled?: boolean;
  /** `true` — ish tugaguncha `refetchInterval` (tafsilot oynasi). Sukut `false`. */
  live?: boolean;
};

/**
 * `GET /notifications/sent/:dispatch_id` (superadmin, admin). Xatoni chaqiruvchi o'zi chizadi (`QueryBoundary` /
 * ogohlantirish) — global xabar chiqmaydi. 404 — «Xabar topilmadi» (ilova sukuti `shouldRetryQuery` 4xx ni qayta
 * so'ramaydi).
 */
export const useSentDetail = (
  dispatchId: string | null | undefined,
  params: SentDetailParams = {},
  { enabled = true, live = false }: UseSentDetailOptions = {},
) =>
  useQuery({
    queryKey: queryKeys.notificationsSent.detail(dispatchId ?? "", params),
    queryFn: () => getSentDetail(dispatchId as string, params),
    enabled: Boolean(dispatchId) && enabled,
    // Sahifa almashganda eski sahifa turadi; boshqa xabarniki — yo'q (boshqa xabar ko'rinib qolmasin).
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === dispatchId ? previous : undefined,
    refetchInterval: (query) => {
      const data = query.state.data;
      return live && data && isDispatchLive(data.status, data.channel_status) ? SENT_DETAIL_LIVE_INTERVAL_MS : false;
    },
    meta: { silentError: true },
  });
