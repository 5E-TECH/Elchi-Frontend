import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";

export const useDeleteBranch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(API_ENDPOINTS.BRANCHES.BY_ID(id)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.branches.all });
    },
  });
};
