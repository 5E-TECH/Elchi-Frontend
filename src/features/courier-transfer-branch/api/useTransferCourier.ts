import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import type { TransferCourierVariables } from "../model/types";
import { transferCourierToBranch } from "./courierTransferApi";

/**
 * O'tkazishdan keyin eskirishi mumkin bo'lgan hamma narsa: ikkala filial
 * (ro'yxat, tafsilot, xodimlar), kuryer ro'yxatlari, foydalanuvchi
 * sahifasi/ro'yxati, viloyat bo'yicha kuryerlar (hudud o'zgaradi) va tekshiruv.
 */
const invalidateCourierTransferQueries = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.branches.all }),
    queryClient.invalidateQueries({ queryKey: ["couriers"] }),
    queryClient.invalidateQueries({ queryKey: ["user"] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
    queryClient.invalidateQueries({ queryKey: ["mails", "couriers-by-region"] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.courierTransfer.all }),
  ]);

export const useTransferCourier = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ courierId, branchId }: TransferCourierVariables) =>
      transferCourierToBranch(courierId, branchId),
    // XATODA HAM yangilanadi: gateway vaqti tugasa (504) server o'tkazishni
    // baribir oxiriga yetkazishi mumkin, 409 da esa tekshiruv yangi sabablarni
    // ko'rsatishi kerak. Kutilmaydi — sekin tekshiruv (3 ta xizmat) xato yoki
    // muvaffaqiyat xabarini kechiktirmasin; oyna tugmasi tekshiruv
    // yangilanguncha o'chiq turadi.
    onSettled: () => {
      void invalidateCourierTransferQueries(queryClient);
    },
  });
};
