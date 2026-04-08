import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";
import type { UpdateBranchDto } from "../model/types";

export const useUpdateBranch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBranchDto }) =>
      api.patch(API_ENDPOINTS.BRANCHES.BY_ID(id), payload),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.branches.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.branches.detail(variables.id) }),
      ]);
    },
  });
};
