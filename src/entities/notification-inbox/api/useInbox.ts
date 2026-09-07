import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getInbox, getInboxById, getInboxUnreadCount } from "./inboxApi";
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

// Polled so the header bell badge stays roughly live without websockets.
export const useUnreadCount = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.notificationsInbox.unreadCount,
    queryFn: getInboxUnreadCount,
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
