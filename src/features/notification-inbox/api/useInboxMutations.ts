import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";

// A single invalidation point: list + detail + unread-count all share the
// `notifications-inbox` key prefix, so one invalidate refreshes every view.
const useInvalidateInbox = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.notificationsInbox.all });
};

export const useMarkInboxRead = () => {
  const invalidate = useInvalidateInbox();
  return useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      api.patch(API_ENDPOINTS.NOTIFICATIONS.INBOX_READ(id), { read }),
    onSuccess: invalidate,
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
