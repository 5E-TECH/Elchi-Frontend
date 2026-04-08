import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";
import type { CreateBranchDto } from "../model/types";

export const useCreateBranch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateBranchDto) => api.post(API_ENDPOINTS.BRANCHES.BASE, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.branches.all });
    },
  });
};
