import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS } from "../../../shared/api";
import { api } from "../../../shared/api/api";
import { readOrderOperatorErrorCode } from "../model/assignOperatorRules";

export interface AssignOrderOperatorResult {
  id: string;
  operator_id: string;
  operator: string | null;
  /** Buyurtma allaqachon sotilgan — operator ulushi yozildi (moliya navbati orqali). */
  earning_recorded: boolean;
}

/**
 * `PUT /orders/:id/operator` — operatori yo'q buyurtmaga operator biriktirish. Muvaffaqiyatdan keyin buyurtma
 * keshlari (tafsilot + ro'yxatlar) va sotilgan buyurtmada operator moliyasi (`finance-cov`) yangilanadi; 409 kodida
 * buyurtma qayta o'qiladi.
 */
export const useAssignOrderOperator = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, operatorId }: { orderId: string; operatorId: string }) =>
      api
        .put(API_ENDPOINTS.ORDERS.OPERATOR(orderId), { operator_id: operatorId })
        .then((res) => (res.data?.data ?? res.data) as AssignOrderOperatorResult),
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: ["orders"] });
      if (result?.earning_recorded) void client.invalidateQueries({ queryKey: ["finance-cov"] });
    },
    // 409 (operatorni boshqa xodim biriktirib bo'ldi / market o'zgardi) — sahifadagi buyurtma eskirgan: qayta o'qiladi,
    // «Operator» qatori haqiqiy holatni ko'rsatadi (xabar oynada qoladi).
    onError: (error) => {
      if (readOrderOperatorErrorCode(error)) void client.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};
