import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";

/**
 * Filial kassasi qarzga ishlaydimi — `PATCH /branches/:id { cashbox_debt_enabled }` (faqat admin/superadmin; HQ'da
 * backend 400). Yoqiq bo'lsa HQ filialdan qarzidan ortiq qabul qila oladi (filial kassasi minusga tushadi).
 */
export const useUpdateBranchCashboxDebt = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, cashbox_debt_enabled }: { id: string; cashbox_debt_enabled: boolean }) =>
      api.patch(API_ENDPOINTS.BRANCHES.BY_ID(id), { cashbox_debt_enabled }),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.branches.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.branches.detail(variables.id) }),
      ]);
    },
  });
};
