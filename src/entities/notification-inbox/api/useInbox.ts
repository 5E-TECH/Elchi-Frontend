import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { unreadCountPollInterval } from "../../../shared/lib/realtime";
import { getInbox, getInboxById, getInboxCounts, getInboxUnreadCount } from "./inboxApi";
import type { InboxListParams } from "../model/types";
import { silentErrorMeta, type SilentErrorOption } from "../../../shared/lib/queryErrorEvents";

export const useInboxList = (params: InboxListParams, options?: SilentErrorOption) =>
  useQuery({
    queryKey: queryKeys.notificationsInbox.list(params),
    queryFn: () => getInbox(params),
    staleTime: 15_000,
    ...silentErrorMeta(options),
  });

export const useInboxDetail = (id?: string) =>
  useQuery({
    queryKey: id ? queryKeys.notificationsInbox.detail(id) : queryKeys.notificationsInbox.all,
    queryFn: () => getInboxById(id as string),
    enabled: Boolean(id),
  });

/** Kategoriya chiplari sanog'i — xato bo'lsa chiplar sanoqsiz qoladi. */
export const useInboxCounts = () =>
  useQuery({
    queryKey: queryKeys.notificationsInbox.counts,
    queryFn: getInboxCounts,
    staleTime: 15_000,
    meta: { silentError: true },
  });

// Badge jonli kanaldan (`RealtimeSync`, uRkw6lk0) yangilanadi; polling — zaxira: socket ulangan bo'lsa 5 daqiqada
// bir marta, uzilgan bo'lsa 60 s da (uzilish paytida sanoq darhol qayta so'raladi).
export const useUnreadCount = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.notificationsInbox.unreadCount,
    queryFn: getInboxUnreadCount,
    enabled,
    staleTime: 30_000,
    refetchInterval: unreadCountPollInterval,
    refetchOnWindowFocus: true,
    // Har daqiqada fonda so'raladi — xato bo'lsa bildirishnoma bilan bezovta qilinmaydi.
    meta: { silentError: true },
  });
