import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";
import type { InboxListResult, InboxNotification } from "../../../entities/notification-inbox";

// A single invalidation point: list + detail + unread-count all share the
// `notifications-inbox` key prefix, so one invalidate refreshes every view.
const useInvalidateInbox = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.notificationsInbox.all });
};

const isInboxList = (value: unknown): value is InboxListResult =>
  Boolean(value) && typeof value === "object" && Array.isArray((value as InboxListResult).items);

export const useMarkInboxRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      api.patch(API_ENDPOINTS.NOTIFICATIONS.INBOX_READ(id), { read }),
    // Optimistically flip the row's read-state (and the unread counters) so the
    // UI reacts instantly; roll back on error, reconcile with the server on settle.
    onMutate: async ({ id, read }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notificationsInbox.all });
      const previous = queryClient.getQueriesData({ queryKey: queryKeys.notificationsInbox.all });

      queryClient.setQueriesData({ queryKey: queryKeys.notificationsInbox.all }, (old: unknown) => {
        if (isInboxList(old)) {
          let delta = 0;
          const items = old.items.map((n: InboxNotification) => {
            if (n.id === id && n.is_read !== read) {
              delta = read ? -1 : 1;
              return { ...n, is_read: read, read_at: read ? n.read_at : null };
            }
            return n;
          });
          if (delta === 0) return old;
          return { ...old, items, unread: Math.max(0, old.unread + delta) };
        }
        if (typeof old === "number") {
          return Math.max(0, old + (read ? -1 : 1));
        }
        return old;
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationsInbox.all }),
  });
};

export const useMarkAllInboxRead = () => {
  const invalidate = useInvalidateInbox();
  return useMutation({
    mutationFn: () => api.patch(API_ENDPOINTS.NOTIFICATIONS.INBOX_READ_ALL),
    onSuccess: invalidate,
  });
};

export const useDeleteInboxNotification = () => {
  const invalidate = useInvalidateInbox();
  return useMutation({
    mutationFn: (id: string) => api.delete(API_ENDPOINTS.NOTIFICATIONS.INBOX_BY_ID(id)),
    onSuccess: invalidate,
  });
};
