import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";

export interface AddEmployeeDto {
  user_id: string;
  position: string;
}

export const useAddEmployee = (branchId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AddEmployeeDto) => api.post(API_ENDPOINTS.BRANCHES.EMPLOYEES(branchId), payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.branches.employees(branchId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.branches.detail(branchId) }),
      ]);
    },
  });
};
