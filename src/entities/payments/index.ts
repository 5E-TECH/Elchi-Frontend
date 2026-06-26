import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

export const cashbox = "cashbox";
export const shift = "shift";
export const financeHistory = "finance-history";

export interface FinanceHistoryActor {
  id: string | number;
  name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
  phone?: string | null;
  role?: string | null;
  status?: string | null;
}

export interface FinanceHistoryCashbox {
  id: string;
  balance: number;
  balance_cash?: number;
  balance_card?: number;
  cashbox_type: string;
  user_id?: string | null;
  user?: FinanceHistoryActor | null;
}

export interface FinanceHistoryOrderProduct {
  id: string;
  name?: string | null;
  image_url?: string | null;
}

export interface FinanceHistoryOrderItem {
  id: string;
  product_id: string;
  quantity: number;
  product?: FinanceHistoryOrderProduct | null;
}

export interface FinanceHistoryRegion {
  id: string;
  name: string;
}

export interface FinanceHistoryDistrict {
  id: string;
  name: string;
  region?: FinanceHistoryRegion | null;
}

export interface FinanceHistoryOrder {
  id: string;
  status?: string;
  where_deliver?: string;
  total_price?: number;
  to_be_paid?: number;
  paid_amount?: number;
  comment?: string | null;
  operator?: string | null;
  address?: string | null;
  market?: FinanceHistoryActor | null;
  customer?: (FinanceHistoryActor & {
    extra_number?: string | null;
    address?: string | null;
    district?: FinanceHistoryDistrict | null;
    region?: FinanceHistoryRegion | null;
  }) | null;
  district?: FinanceHistoryDistrict | null;
  region?: FinanceHistoryRegion | null;
  items?: FinanceHistoryOrderItem[];
}

export interface FinanceHistoryDetail {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  operation_type?: string;
  cashbox_id?: string;
  source_type?: string;
  source_id?: string | null;
  source_user_id?: string | null;
  amount: number;
  balance_after?: number;
  payment_method?: string | null;
  comment?: string | null;
  created_by?: string | null;
  payment_date?: string | null;
  cashbox?: FinanceHistoryCashbox | null;
  order?: FinanceHistoryOrder | null;
  user?: FinanceHistoryActor | null;
  source_user?: FinanceHistoryActor | null;
  sourceUser?: FinanceHistoryActor | null;
  created_by_user?: FinanceHistoryActor | null;
  createdByUser?: FinanceHistoryActor | null;
}

export interface FinanceHistoryDetailResponse {
  statusCode: number;
  message: string;
  data: FinanceHistoryDetail;
}

const normalizeFinanceHistoryParams = (params?: any) => {
  if (!params) return params;

  const { fromDate, toDate, ...rest } = params;
  return {
    ...rest,
    ...(fromDate && { from_date: fromDate }),
    ...(toDate && { to_date: toDate }),
  };
};

export const useCashBox = () => {
  const client = useQueryClient();

  const refreshCashboxQueries = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: [cashbox], refetchType: "active" }),
      client.invalidateQueries({ queryKey: ["finance-cov"], refetchType: "active" }),
      client.invalidateQueries({ queryKey: ["markets"], refetchType: "active" }),
      client.invalidateQueries({ queryKey: ["couriers"], refetchType: "active" }),
      client.invalidateQueries({ queryKey: ["branches"], refetchType: "active" }),
    ]);
  };

  const createPaymentCourier = useMutation({
    mutationFn: (data: any) => api.post(API_ENDPOINTS.CASHBOX.PAYMENT_COURIER, data),
    onSuccess: refreshCashboxQueries,
  });

  const createPaymentBranchToMain = useMutation({
    mutationFn: (data: any) => api.post(API_ENDPOINTS.CASHBOX.PAYMENT_BRANCH_TO_MAIN, data),
    onSuccess: refreshCashboxQueries,
  });

  const createPaymentMarket = useMutation({
    mutationFn: (data: any) => api.post(API_ENDPOINTS.CASHBOX.PAYMENT_MARKET, data),
    onSuccess: refreshCashboxQueries,
  });

  const useGetCashBoxById = (
    id: string | undefined,
    bool: boolean = true,
    params?: any,
  ) =>
    useQuery({
      queryKey: [cashbox, "by-user", id, params],
      queryFn: () =>
        api
          .get(API_ENDPOINTS.FINANCE.CASHBOX_BY_USER(id as string), { params })
          .then((res) => res.data),
      enabled: bool && Boolean(id),
    });

  const useGetCashBoxHistoryById = (id: string | null, bool: boolean = true) =>
    useQuery({
      queryKey: [cashbox, "history-by-id", id],
      queryFn: () => api.get(API_ENDPOINTS.CASHBOX_HISTORY.BY_ID(id as string)).then((res) => res.data),
      enabled: bool && Boolean(id),
    });

  const useGetCashboxMyCashbox = (params?: any) =>
    useQuery({
      queryKey: [cashbox, "my-cashbox", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.CASHBOX.MY_CASHBOX, { params }).then((res) => res.data),
    });

  const useGetCashBoxInfo = (bool: boolean = true, params?: any) =>
    useQuery({
      queryKey: [cashbox, "all-info", params],
      queryFn: () =>
        api
          .get(API_ENDPOINTS.FINANCE.CASHBOX_ALL_INFO, { params })
          .then((res) => res.data),
      enabled: bool,
    });

  const useGetCashBoxMain = (params?: any) =>
    useQuery({
      queryKey: [cashbox, "main", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.CASHBOX_MAIN, { params }).then((res) => res.data),
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

  const useGetFinanceHistory = (params?: any, enabled: boolean = true) => {
    const normalizedParams = normalizeFinanceHistoryParams(params);

    return useQuery({
      queryKey: [cashbox, "finance-history", normalizedParams],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.HISTORY, { params: normalizedParams }).then((res) => res.data),
      enabled,
    });
  };

  const useGetFinanceHistoryById = (id: string | null, enabled: boolean = true) =>
    useQuery<FinanceHistoryDetailResponse>({
      queryKey: [financeHistory, id],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.HISTORY_BY_ID(id as string)).then((res) => res.data),
      enabled: enabled && !!id,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    });

  // ==================== SHIFT (SMENA) HOOKS ====================

  const useGetCurrentShift = () =>
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

  const useGetShiftHistory = (params?: { page?: number; limit?: number }) =>
    useQuery({
      queryKey: [shift, "history", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.CASHBOX.SHIFT_HISTORY, { params }).then((res) => res.data),
    });

  const useGetFinancialBalance = () =>
    useQuery({
      queryKey: [cashbox, "financial-balance"],
      queryFn: () => api.get(API_ENDPOINTS.FINANCE.CASHBOX_FINANCIAL_BALANCE).then((res) => res.data),
    });

  return {
    useGetCashBoxById,
    useGetCashBoxInfo,
    useGetCashboxMyCashbox,
    useGetCashBoxHistoryById,
    useGetCashBoxMain,
    createPaymentCourier,
    createPaymentBranchToMain,
    createPaymentMarket,
    cashboxSpand,
    cashboxFill,
    useGetFinanceHistory,
    useGetFinanceHistoryById,
    // Shift hooks
    useGetCurrentShift,
    openShift,
    closeShift,
    useGetShiftHistory,
    useGetFinancialBalance,
  };
};
