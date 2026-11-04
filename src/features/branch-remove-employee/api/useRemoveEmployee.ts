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
    // aks holda «← Filiallar» da 30 s gacha eski son turadi (cI5gqN90). `queryKeys.users` — `GET /users` qatoridagi
    // `branch_id` ham eskiradi: «Xodim qo'shish» oynasi filialsizlarni shu maydon bo'yicha ajratadi (kalitda filial
    // yo'q, 30 s staleTime) — olib tashlangan xodim boshqa filial oynasida darhol ko'rinadi.
    // Kutilmaydi: tasdiq oynasi yopilishi `GET /users` qayta yuklanishini kutmasin.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      return queryClient.invalidateQueries({ queryKey: queryKeys.branches.all });
    },
  });
};
