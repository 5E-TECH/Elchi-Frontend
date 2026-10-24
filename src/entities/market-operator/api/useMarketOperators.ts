import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MarketOperatorCommission, MarketOperatorListParams } from "../model/types";
import {
  createMarketOperator,
  deleteMarketOperator,
  getMarketOperators,
  updateMarketOperatorCommission,
  updateMarketOperatorWarehouseAccess,
} from "./marketOperatorApi";

/** So'rov kalitlari — shu entity ichida (`shared/config/queryKeys.ts` boshqa PR'lar egaligida). */
export const marketOperatorKeys = {
  all: ["market-operators"] as const,
  list: (params: MarketOperatorListParams) => ["market-operators", "list", params] as const,
};

/**
 * `GET /market-operators` — market o'z operatorlari. Xatoni sahifa o'zi chizadi (`QueryBoundary` → `ErrorState`),
 * shuning uchun umumiy xabar chiqmaydi (`silentError`). Sahifa/filtr almashganda eski ro'yxat turadi.
 */
export const useMarketOperators = (params: MarketOperatorListParams, options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: marketOperatorKeys.list(params),
    queryFn: () => getMarketOperators(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    meta: { silentError: true },
  });

const useInvalidateOperators = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: marketOperatorKeys.all });
};

/** `POST /market-operators` (faqat ism, telefon, parol). Ro'yxatni chaqiruvchi yangilaydi (komissiya PATCH'idan keyin). */
export const useCreateMarketOperator = () => useMutation({ mutationFn: createMarketOperator });

export const useUpdateMarketOperatorCommission = () => {
  const invalidate = useInvalidateOperators();
  return useMutation({
    mutationFn: ({ id, commission }: { id: string; commission: MarketOperatorCommission }) =>
      updateMarketOperatorCommission(id, commission),
    onSettled: invalidate,
  });
};

export const useDeleteMarketOperator = () => {
  const invalidate = useInvalidateOperators();
  return useMutation({ mutationFn: deleteMarketOperator, onSettled: invalidate });
};

/** Yaratish oqimi tugagach (PATCH muvaffaqiyatli yoki yiqilgan) ro'yxatni yangilash. */
export const useRefreshMarketOperators = useInvalidateOperators;

/**
 * XtcEyQjb: «Ombordagi qoldiqni ko'radi» kaliti. OPTIMISTIK EMAS: kalit server javobigacha eski holatda turadi;
 * muvaffaqiyatda ro'yxat yangilanadi, xatoda o'zgarmaydi (xabarni chaqiruvchi ko'rsatadi).
 */
export const useUpdateMarketOperatorWarehouseAccess = () => {
  const invalidate = useInvalidateOperators();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => updateMarketOperatorWarehouseAccess(id, enabled),
    onSuccess: invalidate,
  });
};
