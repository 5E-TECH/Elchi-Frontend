import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

export const cashbox = "cashbox";
export const shift = "shift";

export const useCashBox = () => {
  const client = useQueryClient();

  const createPaymentCourier = useMutation({
    mutationFn: (data: any) => api.post(API_ENDPOINTS.CASHBOX.PAYMENT_COURIER, data),
    onSuccess: () => client.invalidateQueries({ queryKey: [cashbox] }),
  });

  const createPaymentMarket = useMutation({
    mutationFn: (data: any) => api.post(API_ENDPOINTS.CASHBOX.PAYMENT_MARKET, data),
    onSuccess: () => client.invalidateQueries({ queryKey: [cashbox] }),
  });

  const getCashBoxById = (
    id: string | undefined,
    bool: boolean = true,
    params?: any,
  ) =>
    useQuery({
      queryKey: [cashbox, id, params],
      queryFn: () =>
        api.get(API_ENDPOINTS.CASHBOX.USER_BY_ID(id as string), { params }).then((res) => res.data),
      enabled: bool,
    });

  const getCashBoxHistoryById = (id: string | null, bool: boolean = true) =>
    useQuery({
      queryKey: [cashbox, id],
      queryFn: () => api.get(API_ENDPOINTS.CASHBOX_HISTORY.BY_ID(id as string)).then((res) => res.data),
      enabled: bool,
    });

  const getCashboxMyCashbox = (params?: any) =>
    useQuery({
      queryKey: [cashbox, params],
      queryFn: () =>
        api.get(API_ENDPOINTS.CASHBOX.MY_CASHBOX, { params }).then((res) => res.data),
    });

  const getCashBoxInfo = (bool: boolean = true, params?: any) =>
    useQuery({
      queryKey: [cashbox, params],
      queryFn: () =>
        api
          .get(API_ENDPOINTS.FINANCE.CASHBOX_ALL_INFO, { params })
          .then((res) => res.data),
      enabled: bool,
    });

  const getCashBoxMain = (params?: any) =>
    useQuery({
      queryKey: [cashbox, params],
      queryFn: () =>
        api.get(API_ENDPOINTS.CASHBOX.MAIN, { params }).then((res) => res.data),
    });

  const cashboxSpand = useMutation({
    mutationFn: ({ data }: { data: any }) => api.patch(API_ENDPOINTS.CASHBOX.SPEND, data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [cashbox] });
    },
  });

  const cashboxFill = useMutation({
    mutationFn: ({ data }: { data: any }) => api.patch(API_ENDPOINTS.CASHBOX.FILL, data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["cashbox"] });
    },
  });

  const getFinanceHistory = (params?: any) =>
    useQuery({
      queryKey: [cashbox, "finance-history", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.HISTORY, { params }).then((res) => res.data),
    });

  // ==================== SHIFT (SMENA) HOOKS ====================

  const getCurrentShift = () =>
    useQuery({
      queryKey: [shift, "current"],
      queryFn: () => api.get(API_ENDPOINTS.CASHBOX.SHIFT_CURRENT).then((res) => res.data),
    });

  const openShift = useMutation({
    mutationFn: () => api.post(API_ENDPOINTS.CASHBOX.SHIFT_OPEN),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [shift] });
    },
  });

  const closeShift = useMutation({
    mutationFn: (comment?: string) =>
      api.post(API_ENDPOINTS.CASHBOX.SHIFT_CLOSE, { comment }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [shift] });
      client.invalidateQueries({ queryKey: [cashbox] });
    },
  });

  const getShiftHistory = (params?: { page?: number; limit?: number }) =>
    useQuery({
      queryKey: [shift, "history", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.CASHBOX.SHIFT_HISTORY, { params }).then((res) => res.data),
    });

  const getOperationTypes = () =>
    useQuery({
      queryKey: [cashbox, "operation-types"],
      queryFn: () => api.get(API_ENDPOINTS.FINANCE.OPERATION_TYPE).then((res) => res.data),
    });

  const getSourceTypes = () =>
    useQuery({
      queryKey: [cashbox, "source-types"],
      queryFn: () => api.get(API_ENDPOINTS.FINANCE.SOURCE_TYPE).then((res) => res.data),
    });

  const getCashboxTypes = () =>
    useQuery({
      queryKey: [cashbox, "cashbox-types"],
      queryFn: () => api.get(API_ENDPOINTS.FINANCE.CASHBOX_TYPE).then((res) => res.data),
    });

  const getFinancialBalance = () =>
    useQuery({
      queryKey: [cashbox, "financial-balance"],
      queryFn: () => api.get(API_ENDPOINTS.FINANCE.CASHBOX_FINANCIAL_BALANCE).then((res) => res.data),
    });

  return {
    getCashBoxById,
    getCashBoxInfo,
    getCashboxMyCashbox,
    getCashBoxHistoryById,
    getCashBoxMain,
    createPaymentCourier,
    createPaymentMarket,
    cashboxSpand,
    cashboxFill,
    getFinanceHistory,
    getOperationTypes,
    getSourceTypes,
    getCashboxTypes,
    // Shift hooks
    getCurrentShift,
    openShift,
    closeShift,
    getShiftHistory,
    getFinancialBalance,
  };
};
