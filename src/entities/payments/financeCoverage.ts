import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

export const useFinanceCoverage = () => {
  const client = useQueryClient();

  // ── Cashbox ──────────────────────────────────────────────────────────────

  const createCashbox = useMutation({
    mutationFn: (data: any) =>
      api.post(API_ENDPOINTS.FINANCE.CASHBOX_BASE, data).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["finance-cov"] }),
  });

  const useGetCashboxAllInfo = (enabled: boolean = true, params?: any) =>
    useQuery({
      queryKey: ["finance-cov", "cashbox-all-info", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.CASHBOX_ALL_INFO, { params })
          .then((res) => res.data),
      enabled,
    });

  const updateCashboxBalance = useMutation({
    mutationFn: (data: any) =>
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

  const useGetCashboxByUser = (id: string, enabled: boolean = true, params?: any) =>
    useQuery({
      queryKey: ["finance-cov", "cashbox-by-user", id, params],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.CASHBOX_BY_USER(id), { params })
          .then((res) => res.data),
      enabled,
    });

  // ── Financial balance ledger ──────────────────────────────────────────────

  const createFinancialBalanceEntry = useMutation({
    mutationFn: (data: any) =>
      api.post(API_ENDPOINTS.FINANCE.FINANCIAL_BALANCE_ENTRIES, data)
        .then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["finance-cov"] }),
  });

  const useGetFinancialBalanceHistory = (enabled: boolean = true, params?: any) =>
    useQuery({
      queryKey: ["finance-cov", "financial-balance-history", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.FINANCIAL_BALANCE_HISTORY, { params })
          .then((res) => res.data),
      enabled,
    });

  // ── Health ────────────────────────────────────────────────────────────────

  const useGetFinanceHealth = (enabled: boolean = true) =>
    useQuery({
      queryKey: ["finance-cov", "health"],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.HEALTH).then((res) => res.data),
      enabled,
    });

  // ── Operator payments / balance / earnings / payouts ─────────────────────

  const createOperatorPayment = useMutation({
    mutationFn: (data: any) =>
      api.post(API_ENDPOINTS.FINANCE.OPERATOR_PAYMENTS, data)
        .then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["finance-cov"] }),
  });

  const useGetOperatorBalance = (operatorId: string, enabled: boolean = true) =>
    useQuery({
      queryKey: ["finance-cov", "operator-balance", operatorId],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.OPERATOR_BALANCE(operatorId))
          .then((res) => res.data),
      enabled,
    });

  const useGetOperatorEarnings = (operatorId: string, enabled: boolean = true, params?: any) =>
    useQuery({
      queryKey: ["finance-cov", "operator-earnings", operatorId, params],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.OPERATOR_EARNINGS(operatorId), { params })
          .then((res) => res.data),
      enabled,
    });

  const useGetOperatorPayouts = (operatorId: string, enabled: boolean = true, params?: any) =>
    useQuery({
      queryKey: ["finance-cov", "operator-payouts", operatorId, params],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.OPERATOR_PAYOUTS(operatorId), { params })
          .then((res) => res.data),
      enabled,
    });

  // ── Salary ────────────────────────────────────────────────────────────────

  const createSalary = useMutation({
    mutationFn: (data: any) =>
      api.post(API_ENDPOINTS.FINANCE.SALARY, data).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["finance-cov"] }),
  });

  const updateSalary = useMutation({
    mutationFn: (data: any) =>
      api.patch(API_ENDPOINTS.FINANCE.SALARY, data).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["finance-cov"] }),
  });

  const useGetSalaryByUser = (userId: string, enabled: boolean = true, params?: any) =>
    useQuery({
      queryKey: ["finance-cov", "salary-by-user", userId, params],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.SALARY_BY_USER(userId), { params })
          .then((res) => res.data),
      enabled,
    });

  return {
    // Cashbox
    createCashbox,
    useGetCashboxAllInfo,
    updateCashboxBalance,
    useGetManagerPayableToHq,
    useGetManagerSettlement,
    useGetCashboxUserMain,
    useGetCashboxByUser,
    // Financial ledger
    createFinancialBalanceEntry,
    useGetFinancialBalanceHistory,
    // Health
    useGetFinanceHealth,
    // Operator
    createOperatorPayment,
    useGetOperatorBalance,
    useGetOperatorEarnings,
    useGetOperatorPayouts,
    // Salary
    createSalary,
    updateSalary,
    useGetSalaryByUser,
  };
};
