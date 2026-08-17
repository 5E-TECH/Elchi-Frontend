import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";

export const useConnectNotificationByToken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { token: string }) =>
      api.post(API_ENDPOINTS.NOTIFICATIONS.CONNECT_BY_TOKEN, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
};
