import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import type { SentListParams } from "../model/types";
import { getSentList } from "./sentApi";

/** Ro'yxatda «Yuborilmoqda» qatori bo'lsa sahifa shu oraliqda yangilanadi (yakuniy holat ro'yxatga tushsin). */
export const SENT_LIST_LIVE_INTERVAL_MS = 10_000;

/**
 * `GET /notifications/sent` (superadmin, admin) — «Yuborilganlar» ro'yxati, yangisi birinchi. Sahifa yoki filtr
 * almashganda eski sahifa turadi (jadval xiralashadi). Xatoni sahifa o'zi chizadi — global xabar chiqmaydi.
 */
export const useSentList = (params: SentListParams, { enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: queryKeys.notificationsSent.list(params),
    queryFn: () => getSentList(params),
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      query.state.data?.items.some((item) => item.status === "running") ? SENT_LIST_LIVE_INTERVAL_MS : false,
    meta: { silentError: true },
  });
