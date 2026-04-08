import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";
import type { BranchSettingDto } from "./useAddSetting";

export const useUpdateSetting = (branchId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: BranchSettingDto }) =>
      api.patch(API_ENDPOINTS.BRANCHES.SETTING_BY_ID(branchId, id), payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.branches.settings(branchId) });
    },
  });
};
