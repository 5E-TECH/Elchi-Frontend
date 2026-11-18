import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OperatorAccountPageParams, OperatorPaymentListParams } from "../model/types";
import {
  cancelOperatorPayment,
  getMyOperatorBalance,
  getMyOperatorEarningsTotal,
  getMyOperatorPayments,
  getOperatorAccountBalance,
  getOperatorAccountEarnings,
  getOperatorAccountPayments,
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
  /** B1te60bD — bitta operator hisobi (superadmin/admin ko'radi). */
  account: (operatorId: string) => ["operator-payments", "operator", operatorId] as const,
  accountBalance: (operatorId: string) => ["operator-payments", "operator", operatorId, "balance"] as const,
  accountPayments: (operatorId: string, params: OperatorAccountPageParams) =>
    ["operator-payments", "operator", operatorId, "payments", params] as const,
  accountEarnings: (operatorId: string, params: OperatorAccountPageParams) =>
    ["operator-payments", "operator", operatorId, "earnings", params] as const,
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

/**
 * B1te60bD — operator hisobi, faqat o'qish (`GET finance/operators/:operator_id/balance`; SUPERADMIN, ADMIN, MANAGER).
 * `operatorId` — market operatori foydalanuvchi id'si.
 */
export const useOperatorAccountBalance = (operatorId: string, options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: operatorPaymentKeys.accountBalance(operatorId),
    queryFn: () => getOperatorAccountBalance(operatorId),
    enabled: (options.enabled ?? true) && Boolean(operatorId),
    meta: { silentError: true },
  });

/** `GET finance/operators/:operator_id/payments` (limit/offset; bekor qilinganlar ham, yangisi tepada). */
export const useOperatorAccountPayments = (
  operatorId: string,
  params: OperatorAccountPageParams,
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: operatorPaymentKeys.accountPayments(operatorId, params),
    queryFn: () => getOperatorAccountPayments(operatorId, params),
    enabled: (options.enabled ?? true) && Boolean(operatorId),
    placeholderData: keepPreviousData,
    meta: { silentError: true },
  });

/** `GET finance/operators/:operator_id/earnings` (limit/offset; har sotilgan buyurtma komissiyasi, yangisi tepada). */
export const useOperatorAccountEarnings = (
  operatorId: string,
  params: OperatorAccountPageParams,
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: operatorPaymentKeys.accountEarnings(operatorId, params),
    queryFn: () => getOperatorAccountEarnings(operatorId, params),
    enabled: (options.enabled ?? true) && Boolean(operatorId),
    placeholderData: keepPreviousData,
    meta: { silentError: true },
  });
