import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS } from "../../../shared/api";
import { api } from "../../../shared/api/instance";
import { queryKeys } from "../../../shared/config/queryKeys";

export interface ToggleNotificationVariables {
  id: string;
  is_active: boolean;
}

/**
 * Guruh ulanishini nofaol qilish / faollashtirish — `PATCH /notifications/:id` tanasida FAQAT `{ is_active }`
 * (qXlFQp8Q: boshqa maydon yuborilmaydi — market, guruh ID va tur o'zgarmaydi). Backend `@Roles(SUPERADMIN, ADMIN)`.
 */
export const useToggleNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, is_active }: ToggleNotificationVariables) =>
      api.patch(API_ENDPOINTS.NOTIFICATIONS.BY_ID(id), { is_active }),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.detail(variables.id) }),
      ]);
    },
  });
};
