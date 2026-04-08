import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";

export const useDeleteSetting = (branchId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settingId: string) => api.delete(API_ENDPOINTS.BRANCHES.SETTING_BY_ID(branchId, settingId)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.branches.settings(branchId) });
    },
  });
};
