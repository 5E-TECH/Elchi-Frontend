import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OperatorPaymentListParams } from "../model/types";
import {
  cancelOperatorPayment,
  getMyOperatorBalance,
  getMyOperatorEarningsTotal,
  getMyOperatorPayments,
  getOperatorBalances,
  getOperatorPayments,
  recordOperatorPayment,
} from "./operatorPaymentApi";

/**
 * So'rov kalitlari. Elchi kassasiga ta'sir qilmaydi (F2qp6FtE) — yozish/bekor qilish faqat shu kalitlarni eskirtiradi,
 * kassa (`[cashbox]`) va moliya keshlari tegilmaydi.
 */
export const operatorPaymentKeys = {
  all: ["operator-payments"] as const,
  balances: ["operator-payments", "balances"] as const,
  lists: ["operator-payments", "list"] as const,
  list: (params: OperatorPaymentListParams) => ["operator-payments", "list", params] as const,
  me: ["operator-payments", "me"] as const,
  myBalance: ["operator-payments", "me", "balance"] as const,
  myPayments: (params: { limit: number; offset: number }) => ["operator-payments", "me", "payments", params] as const,
  myEarningsTotal: ["operator-payments", "me", "earnings-total"] as const,
};

/** `GET finance/operator-payments/balances` (market). Xatoni sahifa o'zi chizadi (`silentError`). */
export const useOperatorBalances = (options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: operatorPaymentKeys.balances,
    queryFn: getOperatorBalances,
    enabled: options.enabled ?? true,
    meta: { silentError: true },
  });

/** `GET finance/operator-payments` (market) — sahifa/filtr almashganda eski ro'yxat turadi. */
export const useOperatorPayments = (params: OperatorPaymentListParams, options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: operatorPaymentKeys.list(params),
    queryFn: () => getOperatorPayments(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    meta: { silentError: true },
  });

const useInvalidateOperatorPayments = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: operatorPaymentKeys.all });
};

/**
 * Yozish (`Idempotency-Key` bilan). Natija noma'lum bo'lsa ham (504, tarmoq) ro'yxat va hisob qayta o'qiladi —
 * qayta urinish o'sha kalit bilan xavfsiz.
 */
export const useRecordOperatorPayment = () => {
  const invalidate = useInvalidateOperatorPayments();
  return useMutation({ mutationFn: recordOperatorPayment, onSettled: invalidate });
};

export const useCancelOperatorPayment = () => {
  const invalidate = useInvalidateOperatorPayments();
  return useMutation({ mutationFn: cancelOperatorPayment, onSettled: invalidate });
};

/** `GET finance/operators/me/balance` (market operatori). */
export const useMyOperatorBalance = (options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: operatorPaymentKeys.myBalance,
    queryFn: getMyOperatorBalance,
    enabled: options.enabled ?? true,
    meta: { silentError: true },
  });

/** `GET finance/operators/me/payments` (market operatori; limit/offset). */
export const useMyOperatorPayments = (params: { limit: number; offset: number }, options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: operatorPaymentKeys.myPayments(params),
    queryFn: () => getMyOperatorPayments(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    meta: { silentError: true },
  });

/** «N ta sotilgan buyurtmadan» — `GET finance/operators/me/earnings?limit=1` jami soni (xato — ko'rsatilmaydi). */
export const useMyOperatorEarningsTotal = (options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: operatorPaymentKeys.myEarningsTotal,
    queryFn: getMyOperatorEarningsTotal,
    enabled: options.enabled ?? true,
    meta: { silentError: true },
  });
