import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";

export interface BranchSettingDto {
  key: string;
  value: string;
}

export const useAddSetting = (branchId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BranchSettingDto) => api.post(API_ENDPOINTS.BRANCHES.SETTINGS(branchId), payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.branches.settings(branchId) });
    },
  });
};
