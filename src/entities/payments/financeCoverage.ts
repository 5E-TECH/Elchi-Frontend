import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { silentErrorMeta, type SilentErrorOption } from "../../shared/lib/queryErrorEvents";
import { refreshCashboxQueries } from "./index";

/** Operatorga to'lov (`POST finance/operator-payments`) — body backend DTO'si, `Idempotency-Key` bitta mantiqiy to'lovga bitta. */
export type OperatorPaymentRequest = {
  payload: { operator_id: string; amount: number; note?: string };
  idempotencyKey: string;
};

export const useFinanceCoverage = () => {
  const client = useQueryClient();

  // ── Cashbox ──────────────────────────────────────────────────────────────

  const createCashbox = useMutation({
    mutationFn: (data: unknown) =>
      api.post(API_ENDPOINTS.FINANCE.CASHBOX_BASE, data).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["finance-cov"] }),
  });

  const updateCashboxBalance = useMutation({
    mutationFn: (data: unknown) =>
      api.patch(API_ENDPOINTS.FINANCE.CASHBOX_BALANCE, data).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["finance-cov"] }),
  });

  const useGetManagerPayableToHq = (enabled: boolean = true, params?: any) =>
    useQuery({
      queryKey: ["finance-cov", "manager-payable-to-hq", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.MANAGER_PAYABLE_TO_HQ, { params })
          .then((res) => res.data),
      enabled,
    });

  const useGetManagerSettlement = (enabled: boolean = true, params?: any) =>
    useQuery({
      queryKey: ["finance-cov", "manager-settlement", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.MANAGER_SETTLEMENT, { params })
          .then((res) => res.data),
      enabled,
    });

  const useGetCashboxUserMain = (id: string, enabled: boolean = true, params?: any) =>
    useQuery({
      queryKey: ["finance-cov", "cashbox-user-main", id, params],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.CASHBOX_USER_MAIN(id), { params })
          .then((res) => res.data),
      enabled,
    });

  // ── Financial balance ledger ──────────────────────────────────────────────

  /**
   * Qo'lda daftar yozuvi. `idempotencyKey` — oyna sessiyasi kaliti: gateway
   * uni yozuv bilan birga xeshlab takroriy bosishni bir marta yozadi.
   */
  const createFinancialBalanceEntry = useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: unknown; idempotencyKey?: string }) =>
      api.post(API_ENDPOINTS.FINANCE.FINANCIAL_BALANCE_ENTRIES, data, {
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      })
        .then((res) => res.data),
    // XAtqsRNH (aac031, 26eb9d): daftar yozuvi kassa balansini o'zgartiradi — `finance-cov` (tarix, tahlil) bilan birga
    // `[cashbox]` (jumladan `/financial-balance` tepasidagi kartalar `[cashbox, "financial-balance"]`) ham darhol yangilanadi.
    onSuccess: () => refreshCashboxQueries(client),
  });

  const useGetFinancialBalanceHistory = (enabled: boolean = true, params?: any) =>
    useQuery({
      queryKey: ["finance-cov", "financial-balance-history", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.FINANCIAL_BALANCE_HISTORY, { params })
          .then((res) => res.data),
      enabled,
    });

  const useGetFinancialBalanceAnalytics = (enabled: boolean = true, params?: any) =>
    useQuery({
      queryKey: ["finance-cov", "financial-balance-analytics", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.FINANCIAL_BALANCE_ANALYTICS, { params })
          .then((res) => res.data),
      enabled,
    });

  const useGetFinancialBalanceTopImpacts = (enabled: boolean = true, params?: any) =>
    useQuery({
      queryKey: ["finance-cov", "financial-balance-top-impacts", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.FINANCIAL_BALANCE_TOP_IMPACTS, { params })
          .then((res) => res.data),
      enabled,
      // vmLTsAok: server sahifalaydi — keyingi sahifa yuklanguncha oldingisi (jami, sahifalagich) ko'rinib turadi;
      // davr o'zgarsa eski davr ma'lumoti ko'rsatilmaydi.
      placeholderData: (previousData, previousQuery) => {
        const previous = previousQuery?.queryKey[2] as { fromDate?: string; toDate?: string } | undefined;
        return previous?.fromDate === params?.fromDate && previous?.toDate === params?.toDate ? previousData : undefined;
      },
    });

  // ── Health ────────────────────────────────────────────────────────────────

  const useGetFinanceHealth = (enabled: boolean = true) =>
    useQuery({
      queryKey: ["finance-cov", "health"],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.HEALTH).then((res) => res.data),
      enabled,
    });

  // ── Operator balance / earnings / payouts (to'lov — `pages/finance-operators`, Idempotency-Key bilan) ──

  const useGetOperatorBalance = (operatorId: string, enabled: boolean = true, options?: SilentErrorOption) =>
    useQuery({
      queryKey: ["finance-cov", "operator-balance", operatorId],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.OPERATOR_BALANCE(operatorId))
          .then((res) => res.data),
      enabled,
      ...silentErrorMeta(options),
    });

  const useGetOperatorEarnings = (operatorId: string, enabled: boolean = true, params?: any, options?: SilentErrorOption) =>
    useQuery({
      queryKey: ["finance-cov", "operator-earnings", operatorId, params],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.OPERATOR_EARNINGS(operatorId), { params })
          .then((res) => res.data),
      enabled,
      ...silentErrorMeta(options),
    });

  const useGetOperatorPayouts = (operatorId: string, enabled: boolean = true, params?: any, options?: SilentErrorOption) =>
    useQuery({
      queryKey: ["finance-cov", "operator-payouts", operatorId, params],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.OPERATOR_PAYOUTS(operatorId), { params })
          .then((res) => res.data),
      enabled,
      ...silentErrorMeta(options),
    });

  /**
   * Operatorga to'lov (OPS → «Moliya operatorlari»). Pul kassadan chiqadi — `refreshCashboxQueries`: operator balansi,
   * daromad va to'lovlar (`finance-cov`) bilan birga kassa (`[cashbox]`), tarix va bosh sahifa ham yangilanadi (aac031).
   */
  const createOperatorPayment = useMutation({
    mutationFn: ({ payload, idempotencyKey }: OperatorPaymentRequest) =>
      api
        .post(API_ENDPOINTS.FINANCE.OPERATOR_PAYMENTS, payload, { headers: { "Idempotency-Key": idempotencyKey } })
        .then((res) => res.data),
    onSuccess: () => refreshCashboxQueries(client),
  });

  // ── Salary ────────────────────────────────────────────────────────────────

  const createSalary = useMutation({
    mutationFn: (data: unknown) =>
      api.post(API_ENDPOINTS.FINANCE.SALARY, data).then((res) => res.data),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ["finance-cov"] }),
        client.invalidateQueries({ queryKey: ["cashbox"] }),
      ]),
  });

  const updateSalary = useMutation({
    mutationFn: (data: unknown) =>
      api.patch(API_ENDPOINTS.FINANCE.SALARY, data).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["finance-cov"] }),
  });

  const useGetSalaryByUser = (userId: string, enabled: boolean = true, params?: any) =>
    useQuery({
      queryKey: ["finance-cov", "salary-by-user", userId, params],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.SALARY_BY_USER(userId), { params })
          .then((res) => res.data)
          .catch((error) => {
            if (error?.response?.status === 404) {
              return { data: [] };
            }
            throw error;
          }),
      enabled,
      retry: false,
    });

  return {
    // Cashbox
    createCashbox,
    updateCashboxBalance,
    useGetManagerPayableToHq,
    useGetManagerSettlement,
    useGetCashboxUserMain,
    // Financial ledger
    createFinancialBalanceEntry,
    useGetFinancialBalanceHistory,
    useGetFinancialBalanceAnalytics,
    useGetFinancialBalanceTopImpacts,
    // Health
    useGetFinanceHealth,
    // Operator
    useGetOperatorBalance,
    useGetOperatorEarnings,
    useGetOperatorPayouts,
    createOperatorPayment,
    // Salary
    createSalary,
    updateSalary,
    useGetSalaryByUser,
  };
};
