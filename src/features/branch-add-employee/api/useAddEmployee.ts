import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";

export interface AddEmployeeDto {
  user_id: string;
}

export const useAddEmployee = (branchId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AddEmployeeDto) =>
      api.post(API_ENDPOINTS.BRANCHES.USERS(branchId), payload),
    // Hamma filial so'rovlari (xodimlar, tafsilot va ro'yxat): ro'yxatdagi XODIMLAR soni ham o'zgaradi —
    // aks holda «← Filiallar» da 30 s gacha eski son turadi (cI5gqN90). `queryKeys.users` — `GET /users` qatoridagi
    // `branch_id` ham eskiradi: «Xodim qo'shish» oynasi filialsizlarni shu maydon bo'yicha ajratadi (kalitda filial
    // yo'q, 30 s staleTime) — qo'shilgan xodim keyingi ochilishda «filialsiz» bo'lib qaytmaydi (aks holda 409).
    // Kutilmaydi: oyna yopilishi `GET /users` (har rol uchun bittadan) qayta yuklanishini kutmasin.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      // Foydalanuvchi tafsiloti (`/all-users/:id`) sarlavhasidagi filial nomi.
      void queryClient.invalidateQueries({ queryKey: ["user"] });
      return queryClient.invalidateQueries({ queryKey: queryKeys.branches.all });
    },
  });
};
