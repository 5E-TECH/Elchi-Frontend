import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";
import type { UpdateNotificationDto } from "../model/types";

export const useUpdateNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateNotificationDto }) =>
      api.patch(API_ENDPOINTS.NOTIFICATIONS.BY_ID(id), payload),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.detail(variables.id) }),
      ]);
    },
  });
};
