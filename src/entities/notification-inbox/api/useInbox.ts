import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getInbox, getInboxById, getInboxCounts, getInboxUnreadCount } from "./inboxApi";
import type { InboxListParams } from "../model/types";

export const useInboxList = (params: InboxListParams) =>
  useQuery({
    queryKey: queryKeys.notificationsInbox.list(params),
    queryFn: () => getInbox(params),
    staleTime: 15_000,
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

// Polled so the header bell badge stays roughly live without websockets.
export const useUnreadCount = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.notificationsInbox.unreadCount,
    queryFn: getInboxUnreadCount,
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    // Har daqiqada fonda so'raladi — xato bo'lsa bildirishnoma bilan bezovta qilinmaydi.
    meta: { silentError: true },
  });
