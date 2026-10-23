import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";

export const useRemoveEmployee = (branchId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      api.delete(API_ENDPOINTS.BRANCHES.USER_BY_ID(branchId, userId)),
    // Hamma filial so'rovlari (xodimlar, tafsilot va ro'yxat): ro'yxatdagi XODIMLAR soni ham o'zgaradi —
    // aks holda «← Filiallar» da 30 s gacha eski son turadi (cI5gqN90).
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.branches.all }),
  });
};
