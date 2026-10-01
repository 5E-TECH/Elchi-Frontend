import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";

/**
 * POST /notifications/connect-by-token — `ConnectTelegramByTokenRequestDto`:
 * `text` (marketning maxfiy tokeni, ixtiyoriy `-create`/`-cancel` qo'shimchasi
 * bilan) va `group_id` IKKALASI majburiy. fix3b: ilgari `{ token }` yuborilardi
 * (doim 400); forma bu yo'lni endi ishlatmaydi — guruh botda yoki admin
 * formasida ulanadi.
 */
export const useConnectNotificationByToken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { text: string; group_id: string }) =>
      api.post(API_ENDPOINTS.NOTIFICATIONS.CONNECT_BY_TOKEN, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
};
