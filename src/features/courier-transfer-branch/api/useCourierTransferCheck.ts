import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getCourierTransferCheck } from "./courierTransferApi";

/**
 * Kuryerni o'tkazish mumkinmi — pul, qo'ldagi buyurtma va qaytarilmagan
 * pochta tekshiruvi. Oyna o'z xato holatini ko'rsatadi (`silentError` —
 * global bildirishnoma chiqmaydi); natija doim yangi (`staleTime: 0`).
 */
export const useCourierTransferCheck = (courierId: string, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.courierTransfer.check(courierId),
    queryFn: () => getCourierTransferCheck(courierId),
    enabled: enabled && Boolean(courierId),
    meta: { silentError: true },
    retry: false,
    staleTime: 0,
  });
