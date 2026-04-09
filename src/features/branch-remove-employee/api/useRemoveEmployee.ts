import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";

export const useRemoveEmployee = (branchId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      api.delete(API_ENDPOINTS.BRANCHES.USER_BY_ID(branchId, userId)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.branches.employees(branchId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.branches.detail(branchId) }),
      ]);
    },
  });
};
